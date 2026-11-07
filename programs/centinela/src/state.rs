use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub per_tx_limit: u64,
    pub daily_limit: u64,
    pub spent_today: u64,
    pub day_start: i64,
    pub paused: bool,
    pub total_paid: u64,
    pub payments: u64,
    #[max_len(5)]
    pub allowlist: Vec<Pubkey>,
    pub bump: u8,
}

#[event]
pub struct PaymentApproved {
    pub vault: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub spent_today: u64,
}