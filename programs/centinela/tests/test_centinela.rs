use {
    anchor_lang::{
        error::ERROR_CODE_OFFSET,
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    centinela::{error::CentinelaError, state::Vault},
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const SOL: u64 = 1_000_000_000;
const PER_TX: u64 = SOL / 10; // 0.1 SOL
const DAILY: u64 = SOL / 4; // 0.25 SOL

struct Env {
    svm: LiteSVM,
    program_id: Pubkey,
    owner: Keypair,
    agent: Keypair,
    recipient: Keypair,
    vault: Pubkey,
}

// ---------- Utilidades ----------

fn send(svm: &mut LiteSVM, ix: Instruction, signer: &Keypair) -> Result<(), String> {
    svm.expire_blockhash();
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&signer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[signer]).unwrap();
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{:?}", e.err))
}

fn custom(e: CentinelaError) -> u32 {
    ERROR_CODE_OFFSET + e as u32
}

const HAS_ONE: u32 = anchor_lang::error::ErrorCode::ConstraintHasOne as u32;

fn assert_fails_with(res: Result<(), String>, code: u32) {
    let err = res.expect_err("se esperaba que la transacción fallara");
    assert!(
        err.contains(&format!("Custom({})", code)),
        "error inesperado: {}",
        err
    );
}

fn balance(env: &Env, key: &Pubkey) -> u64 {
    env.svm.get_balance(key).unwrap_or(0)
}

fn vault_state(env: &Env) -> Vault {
    let acc = env.svm.get_account(&env.vault).unwrap();
    let mut data: &[u8] = &acc.data;
    Vault::try_deserialize(&mut data).unwrap()
}

// ---------- Constructores de instrucciones ----------

fn owner_ix(env: &Env, owner: Pubkey, data: Vec<u8>) -> Instruction {
    Instruction::new_with_bytes(
        env.program_id,
        &data,
        centinela::accounts::OwnerAction {
            owner,
            vault: env.vault,
        }
        .to_account_metas(None),
    )
}

fn add_recipient_ix(env: &Env, owner: Pubkey, recipient: Pubkey) -> Instruction {
    owner_ix(
        env,
        owner,
        centinela::instruction::AddRecipient { recipient }.data(),
    )
}

fn pay_ix(env: &Env, agent: Pubkey, recipient: Pubkey, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        env.program_id,
        &centinela::instruction::Pay { amount }.data(),
        centinela::accounts::Pay {
            agent,
            vault: env.vault,
            recipient,
        }
        .to_account_metas(None),
    )
}

fn withdraw_ix(env: &Env, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        env.program_id,
        &centinela::instruction::Withdraw { amount }.data(),
        centinela::accounts::Withdraw {
            owner: env.owner.pubkey(),
            vault: env.vault,
        }
        .to_account_metas(None),
    )
}

// ---------- Escenario base ----------
// Bóveda con límite de 0.1 SOL por pago, 0.25 SOL diarios y 1 SOL depositado.

fn setup() -> Env {
    let program_id = centinela::id();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/centinela.so"
    ));
    svm.add_program(program_id, bytes).unwrap();

    let owner = Keypair::new();
    let agent = Keypair::new();
    let recipient = Keypair::new();
    svm.airdrop(&owner.pubkey(), 10 * SOL).unwrap();
    svm.airdrop(&agent.pubkey(), SOL).unwrap();
    svm.airdrop(&recipient.pubkey(), SOL).unwrap();

    let vault = Pubkey::find_program_address(
        &[
            centinela::constants::VAULT_SEED,
            owner.pubkey().as_ref(),
            agent.pubkey().as_ref(),
        ],
        &program_id,
    )
    .0;

    let mut env = Env {
        svm,
        program_id,
        owner,
        agent,
        recipient,
        vault,
    };

    let init_ix = Instruction::new_with_bytes(
        program_id,
        &centinela::instruction::InitializeVault {
            agent: env.agent.pubkey(),
            per_tx_limit: PER_TX,
            daily_limit: DAILY,
        }
        .data(),
        centinela::accounts::InitializeVault {
            owner: env.owner.pubkey(),
            vault,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, init_ix, &env.owner).unwrap();

    // Depósito: cualquiera puede enviar SOL a la bóveda
    env.svm.airdrop(&vault, SOL).unwrap();

    env
}

fn setup_with_recipient() -> Env {
    let mut env = setup();
    let ix = add_recipient_ix(&env, env.owner.pubkey(), env.recipient.pubkey());
    send(&mut env.svm, ix, &env.owner).unwrap();
    env
}

// ---------- Tests ----------

#[test]
fn pago_valido() {
    let mut env = setup_with_recipient();
    let before = balance(&env, &env.recipient.pubkey());

    let ix = pay_ix(&env, env.agent.pubkey(), env.recipient.pubkey(), SOL / 20);
    send(&mut env.svm, ix, &env.agent).unwrap();

    assert_eq!(balance(&env, &env.recipient.pubkey()), before + SOL / 20);
    let state = vault_state(&env);
    assert_eq!(state.spent_today, SOL / 20);
    assert_eq!(state.payments, 1);
    assert_eq!(state.total_paid, SOL / 20);
}

#[test]
fn destinatario_no_autorizado() {
    let mut env = setup_with_recipient();
    let attacker = Keypair::new();

    let ix = pay_ix(&env, env.agent.pubkey(), attacker.pubkey(), SOL / 20);
    let res = send(&mut env.svm, ix, &env.agent);

    assert_fails_with(res, custom(CentinelaError::RecipientNotAllowed));
}

#[test]
fn excede_limite_por_pago() {
    let mut env = setup_with_recipient();

    let ix = pay_ix(&env, env.agent.pubkey(), env.recipient.pubkey(), SOL / 5);
    let res = send(&mut env.svm, ix, &env.agent);

    assert_fails_with(res, custom(CentinelaError::ExceedsPerTxLimit));
}

#[test]
fn excede_limite_diario() {
    let mut env = setup_with_recipient();

    for _ in 0..2 {
        let ix = pay_ix(&env, env.agent.pubkey(), env.recipient.pubkey(), PER_TX);
        send(&mut env.svm, ix, &env.agent).unwrap();
    }
    // 0.1 + 0.1 + 0.1 = 0.3 > 0.25
    let ix = pay_ix(&env, env.agent.pubkey(), env.recipient.pubkey(), PER_TX);
    let res = send(&mut env.svm, ix, &env.agent);

    assert_fails_with(res, custom(CentinelaError::ExceedsDailyLimit));
}

#[test]
fn boveda_pausada() {
    let mut env = setup_with_recipient();

    let pause = owner_ix(
        &env,
        env.owner.pubkey(),
        centinela::instruction::SetPaused { paused: true }.data(),
    );
    send(&mut env.svm, pause, &env.owner).unwrap();

    let ix = pay_ix(&env, env.agent.pubkey(), env.recipient.pubkey(), SOL / 20);
    assert_fails_with(
        send(&mut env.svm, ix, &env.agent),
        custom(CentinelaError::VaultPaused),
    );

    let unpause = owner_ix(
        &env,
        env.owner.pubkey(),
        centinela::instruction::SetPaused { paused: false }.data(),
    );
    send(&mut env.svm, unpause, &env.owner).unwrap();

    let ix = pay_ix(&env, env.agent.pubkey(), env.recipient.pubkey(), SOL / 20);
    send(&mut env.svm, ix, &env.agent).unwrap();
}

#[test]
fn firmante_no_es_el_agente() {
    let mut env = setup_with_recipient();
    let impostor = Keypair::new();
    env.svm.airdrop(&impostor.pubkey(), SOL).unwrap();

    let ix = pay_ix(&env, impostor.pubkey(), env.recipient.pubkey(), SOL / 20);
    let res = send(&mut env.svm, ix, &impostor);

    assert_fails_with(res, HAS_ONE);
}

#[test]
fn extrano_no_puede_configurar() {
    let mut env = setup();
    let intruder = Keypair::new();
    env.svm.airdrop(&intruder.pubkey(), SOL).unwrap();

    let ix = add_recipient_ix(&env, intruder.pubkey(), intruder.pubkey());
    let res = send(&mut env.svm, ix, &intruder);

    assert_fails_with(res, HAS_ONE);
}

#[test]
fn retiro_del_dueno() {
    let mut env = setup();
    let before = balance(&env, &env.owner.pubkey());

    let ix = withdraw_ix(&env, SOL / 2);
    send(&mut env.svm, ix, &env.owner).unwrap();

    // El dueño recibe 0.5 SOL menos la comisión de la transacción
    let after = balance(&env, &env.owner.pubkey());
    assert!(after > before + SOL / 2 - 10_000);

    // Retirar más de lo disponible debe fallar
    let ix = withdraw_ix(&env, SOL);
    assert_fails_with(
        send(&mut env.svm, ix, &env.owner),
        custom(CentinelaError::InsufficientVaultBalance),
    );
}

#[test]
fn reinicio_del_limite_diario() {
    let mut env = setup_with_recipient();

    for _ in 0..2 {
        let ix = pay_ix(&env, env.agent.pubkey(), env.recipient.pubkey(), PER_TX);
        send(&mut env.svm, ix, &env.agent).unwrap();
    }

    // Adelantar el reloj 24 horas
    let mut clock = env.svm.get_sysvar::<Clock>();
    clock.unix_timestamp += 86_400;
    env.svm.set_sysvar::<Clock>(&clock);

    let ix = pay_ix(&env, env.agent.pubkey(), env.recipient.pubkey(), PER_TX);
    send(&mut env.svm, ix, &env.agent).unwrap();

    assert_eq!(vault_state(&env).spent_today, PER_TX);
}

#[test]
fn limites_invalidos() {
    let mut env = setup();

    // Límite por pago mayor que el diario
    let ix = owner_ix(
        &env,
        env.owner.pubkey(),
        centinela::instruction::UpdateLimits {
            per_tx_limit: SOL,
            daily_limit: SOL / 2,
        }
        .data(),
    );
    assert_fails_with(
        send(&mut env.svm, ix, &env.owner),
        custom(CentinelaError::InvalidLimits),
    );
}

#[test]
fn lista_de_destinatarios_llena() {
    let mut env = setup();

    for _ in 0..5 {
        let ix = add_recipient_ix(&env, env.owner.pubkey(), Keypair::new().pubkey());
        send(&mut env.svm, ix, &env.owner).unwrap();
    }
    let ix = add_recipient_ix(&env, env.owner.pubkey(), Keypair::new().pubkey());
    assert_fails_with(
        send(&mut env.svm, ix, &env.owner),
        custom(CentinelaError::AllowlistFull),
    );
}