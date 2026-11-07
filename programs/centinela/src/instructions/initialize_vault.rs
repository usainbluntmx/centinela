use anchor_lang::prelude::*;

use crate::constants::VAULT_SEED;
use crate::error::CentinelaError;
use crate::state::Vault;

#[derive(Accounts)]
#[instruction(agent: Pubkey, per_tx_limit: u64, daily_limit: u64)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, owner.key().as_ref(), agent.as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_vault(
    ctx: Context<InitializeVault>,
    agent: Pubkey,
    per_tx_limit: u64,
    daily_limit: u64,
) -> Result<()> {
    require!(
        per_tx_limit > 0 && per_tx_limit <= daily_limit,
        CentinelaError::InvalidLimits
    );

    let vault = &mut ctx.accounts.vault;
    vault.owner = ctx.accounts.owner.key();
    vault.agent = agent;
    vault.per_tx_limit = per_tx_limit;
    vault.daily_limit = daily_limit;
    vault.spent_today = 0;
    vault.day_start = Clock::get()?.unix_timestamp;
    vault.paused = false;
    vault.total_paid = 0;
    vault.payments = 0;
    vault.allowlist = Vec::new();
    vault.bump = ctx.bumps.vault;

    Ok(())
}