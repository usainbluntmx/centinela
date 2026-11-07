use anchor_lang::prelude::*;
use anchor_lang::Lamports;

use crate::error::CentinelaError;
use crate::state::Vault;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, has_one = owner)]
    pub vault: Account<'info, Vault>,
}

pub fn handle_withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, CentinelaError::InvalidAmount);

    let vault_info = ctx.accounts.vault.to_account_info();
    let rent_min = Rent::get()?.minimum_balance(vault_info.data_len());
    let required = rent_min
        .checked_add(amount)
        .ok_or(CentinelaError::Overflow)?;
    require!(
        vault_info.lamports() >= required,
        CentinelaError::InsufficientVaultBalance
    );

    ctx.accounts.vault.sub_lamports(amount)?;
    ctx.accounts.owner.add_lamports(amount)?;

    Ok(())
}