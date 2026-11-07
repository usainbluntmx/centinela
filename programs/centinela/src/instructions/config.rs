use anchor_lang::prelude::*;

use crate::constants::MAX_RECIPIENTS;
use crate::error::CentinelaError;
use crate::state::Vault;

#[derive(Accounts)]
pub struct OwnerAction<'info> {
    pub owner: Signer<'info>,

    #[account(mut, has_one = owner)]
    pub vault: Account<'info, Vault>,
}

pub fn handle_update_limits(
    ctx: Context<OwnerAction>,
    per_tx_limit: u64,
    daily_limit: u64,
) -> Result<()> {
    require!(
        per_tx_limit > 0 && per_tx_limit <= daily_limit,
        CentinelaError::InvalidLimits
    );
    let vault = &mut ctx.accounts.vault;
    vault.per_tx_limit = per_tx_limit;
    vault.daily_limit = daily_limit;
    Ok(())
}

pub fn handle_add_recipient(ctx: Context<OwnerAction>, recipient: Pubkey) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    require!(
        vault.allowlist.len() < MAX_RECIPIENTS,
        CentinelaError::AllowlistFull
    );
    require!(
        !vault.allowlist.contains(&recipient),
        CentinelaError::RecipientAlreadyAllowed
    );
    vault.allowlist.push(recipient);
    Ok(())
}

pub fn handle_remove_recipient(ctx: Context<OwnerAction>, recipient: Pubkey) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let index = vault
        .allowlist
        .iter()
        .position(|key| *key == recipient)
        .ok_or(CentinelaError::RecipientNotFound)?;
    vault.allowlist.remove(index);
    Ok(())
}

pub fn handle_set_paused(ctx: Context<OwnerAction>, paused: bool) -> Result<()> {
    ctx.accounts.vault.paused = paused;
    Ok(())
}