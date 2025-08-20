use anchor_lang::prelude::*;

#[account]
pub struct WhitelistLaunchData {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub start_time: i64,
    pub end_time: i64,
    pub token_price: u64,               // Price per token in lamports
    pub purchase_limit_per_wallet: u64, // Maximum tokens per wallet
    pub total_supply: u64,              // Total tokens available for sale
    pub sold_tokens: u64,               // Tokens sold so far
    pub whitelisted_users: Vec<Pubkey>, // List of whitelisted addresses
    pub buyers: Vec<Pubkey>,            // List of purchasers
    pub paused: bool,                   // Emergency pause state
    pub whitelist_duration: i64,        // Duration of whitelist period
    pub bump: u8,                       // PDA bump seed
}

#[account]
pub struct FairLaunchData {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub start_time: i64,
    pub end_time: i64,
    pub vault: Pubkey,              // SOL contribution vault
    pub soft_cap: u64,              // Minimum funding goal in lamports
    pub hard_cap: u64,              // Maximum funding goal in lamports
    pub min_contribution: u64,      // Minimum contribution per wallet in lamports
    pub max_contribution: u64,      // Maximum contribution per wallet in lamports
    pub max_tokens_per_wallet: u64, // Maximum tokens per wallet (anti-whale)
    pub distribution_delay: i64,    // Hours to wait before distribution (0 for immediate)
    pub total_raised: u64,          // Total amount raised so far
    pub paused: bool,               // Emergency pause state
    pub bump: u8,                   // PDA bump seed
}

impl WhitelistLaunchData {
    pub const ACCOUNT_SIZE: usize = 5000;

    pub fn new(
        authority: Pubkey,
        token_mint: Pubkey,
        start_time: i64,
        end_time: i64,
        token_price: u64,
        purchase_limit_per_wallet: u64,
        total_supply: u64,
        whitelist_duration: i64,
        bump: u8,
    ) -> Self {
        Self {
            authority,
            token_mint,
            start_time,
            end_time,
            token_price,
            purchase_limit_per_wallet,
            total_supply,
            sold_tokens: 0,
            whitelisted_users: vec![],
            buyers: vec![],
            paused: false,
            whitelist_duration,
            bump,
        }
    }
}

impl FairLaunchData {
    // Fixed size account
    pub const ACCOUNT_SIZE: usize = 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1000; // ~131 bytes

    pub fn new(
        authority: Pubkey,
        token_mint: Pubkey,
        start_time: i64,
        end_time: i64,
        vault: Pubkey,
        soft_cap: u64,
        hard_cap: u64,
        min_contribution: u64,
        max_contribution: u64,
        max_tokens_per_wallet: u64,
        distribution_delay: i64,
        bump: u8,
    ) -> Self {
        Self {
            authority,
            token_mint,
            start_time,
            end_time,
            vault,
            soft_cap,
            hard_cap,
            min_contribution,
            max_contribution,
            max_tokens_per_wallet,
            distribution_delay,
            total_raised: 0,
            paused: false,
            bump,
        }
    }
}

#[account]
pub struct BuyerAccount {
    pub buyer: Pubkey,
    pub amount: u64,
    pub whitelisted: bool,
    pub launchpad: Pubkey,
    pub bump: u8,
}

impl BuyerAccount {
    pub const ACCOUNT_SIZE: usize = 32 + 8 + 1 + 32 + 1; // ~75 bytes
}
