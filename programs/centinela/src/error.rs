use anchor_lang::prelude::*;

#[error_code]
pub enum CentinelaError {
    #[msg("Vault is paused by its owner")]
    VaultPaused,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Recipient is not on the vault allowlist")]
    RecipientNotAllowed,
    #[msg("Amount exceeds the per-payment limit")]
    ExceedsPerTxLimit,
    #[msg("Amount exceeds the remaining daily limit")]
    ExceedsDailyLimit,
    #[msg("Vault balance is insufficient")]
    InsufficientVaultBalance,
    #[msg("Invalid limits: per-payment must be > 0 and <= daily limit")]
    InvalidLimits,
    #[msg("Allowlist is full")]
    AllowlistFull,
    #[msg("Recipient is already on the allowlist")]
    RecipientAlreadyAllowed,
    #[msg("Recipient not found on the allowlist")]
    RecipientNotFound,
    #[msg("Arithmetic overflow")]
    Overflow,
}