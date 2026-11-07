pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("DdDajMsZDhLBua2shYV6CxSX2hNAQjJnJ6z7LDon2Din");

#[program]
pub mod centinela {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        agent: Pubkey,
        per_tx_limit: u64,
        daily_limit: u64,
    ) -> Result<()> {
        instructions::initialize_vault::handle_initialize_vault(ctx, agent, per_tx_limit, daily_limit)
    }

    pub fn update_limits(
        ctx: Context<OwnerAction>,
        per_tx_limit: u64,
        daily_limit: u64,
    ) -> Result<()> {
        instructions::config::handle_update_limits(ctx, per_tx_limit, daily_limit)
    }

    pub fn add_recipient(ctx: Context<OwnerAction>, recipient: Pubkey) -> Result<()> {
        instructions::config::handle_add_recipient(ctx, recipient)
    }

    pub fn remove_recipient(ctx: Context<OwnerAction>, recipient: Pubkey) -> Result<()> {
        instructions::config::handle_remove_recipient(ctx, recipient)
    }

    pub fn set_paused(ctx: Context<OwnerAction>, paused: bool) -> Result<()> {
        instructions::config::handle_set_paused(ctx, paused)
    }

    pub fn pay(ctx: Context<Pay>, amount: u64) -> Result<()> {
        instructions::pay::handle_pay(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handle_withdraw(ctx, amount)
    }
}