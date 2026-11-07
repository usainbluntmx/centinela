use anchor_lang::prelude::*;
use anchor_lang::Lamports;

use crate::constants::SECONDS_PER_DAY;
use crate::error::CentinelaError;
use crate::state::{PaymentApproved, Vault};

#[derive(Accounts)]
pub struct Pay<'info> {
    pub agent: Signer<'info>,

    #[account(mut, has_one = agent)]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub recipient: SystemAccount<'info>,
}

pub fn handle_pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
    let recipient_key = ctx.accounts.recipient.key();
    let vault = &mut ctx.accounts.vault;

    // 1. La bóveda no debe estar pausada
    require!(!vault.paused, CentinelaError::VaultPaused);

    // 2. Monto válido
    require!(amount > 0, CentinelaError::InvalidAmount);

    // 3. Destinatario autorizado
    require!(
        vault.allowlist.contains(&recipient_key),
        CentinelaError::RecipientNotAllowed
    );

    // 4. Límite por pago
    require!(
        amount <= vault.per_tx_limit,
        CentinelaError::ExceedsPerTxLimit
    );

    // 5. Límite diario (se reinicia cada 24 h)
    let now = Clock::get()?.unix_timestamp;
    if now - vault.day_start >= SECONDS_PER_DAY {
        vault.spent_today = 0;
        vault.day_start = now;
    }
    let new_spent = vault
        .spent_today
        .checked_add(amount)
        .ok_or(CentinelaError::Overflow)?;
    require!(
        new_spent <= vault.daily_limit,
        CentinelaError::ExceedsDailyLimit
    );

    // 6. Saldo suficiente sin tocar la renta mínima de la cuenta
    let vault_info = vault.to_account_info();
    let rent_min = Rent::get()?.minimum_balance(vault_info.data_len());
    let required = rent_min
        .checked_add(amount)
        .ok_or(CentinelaError::Overflow)?;
    require!(
        vault_info.lamports() >= required,
        CentinelaError::InsufficientVaultBalance
    );

    // Actualizar estado
    vault.spent_today = new_spent;
    vault.total_paid = vault
        .total_paid
        .checked_add(amount)
        .ok_or(CentinelaError::Overflow)?;
    vault.payments = vault
        .payments
        .checked_add(1)
        .ok_or(CentinelaError::Overflow)?;

    // Mover el SOL de la bóveda al destinatario
    vault.sub_lamports(amount)?;
    ctx.accounts.recipient.add_lamports(amount)?;

    emit!(PaymentApproved {
        vault: ctx.accounts.vault.key(),
        recipient: recipient_key,
        amount,
        spent_today: new_spent,
    });

    Ok(())
}