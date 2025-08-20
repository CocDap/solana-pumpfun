use anchor_lang::prelude::*;
use crate::{
    errors::LaunchPadCustomErrror, 
    state::{BuyerAccount, WhitelistLaunchData}, 
    consts::{LAUNCHPAD_SEED_PREFIX, WHITELIST_DATA_SEED_PREFIX, BUYER_SEED_PREFIX}
};

#[derive(Accounts)]
pub struct RemoveWhitelist<'info> {

    #[account(
        mut,
        seeds = [WHITELIST_DATA_SEED_PREFIX.as_bytes(), whitelist_data.token_mint.key().as_ref()],
        bump = whitelist_data.bump,
    )]
    pub whitelist_data: Account<'info, WhitelistLaunchData>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [BUYER_SEED_PREFIX.as_bytes(), whitelist_data.key().as_ref(), user.key().as_ref()],
        bump = buyer_account.bump,
    )]
    pub buyer_account: Account<'info, BuyerAccount>,
    
    /// CHECK: User to be removed from whitelist
    pub user: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn remove_whitelist(ctx: Context<RemoveWhitelist>, user: Pubkey) -> Result<()> {
    let whitelist_data = &mut ctx.accounts.whitelist_data;
    let buyer_account = &mut ctx.accounts.buyer_account;

    // Check if whitelist duration is not over
    let current_time = Clock::get()?.unix_timestamp;
    msg!("Current time: {}", current_time);
    msg!("Whitelist duration ends at: {}", whitelist_data.whitelist_duration);
    
    if current_time > whitelist_data.whitelist_duration {
        return Err(LaunchPadCustomErrror::WhitelistDurationOver.into());
    }
    
    // Check if launchpad is not paused
    if whitelist_data.paused {
        return Err(LaunchPadCustomErrror::LaunchpadPaused.into());
    }

    // Update buyer account
    buyer_account.whitelisted = false;

    // Remove user from whitelist
    whitelist_data.whitelisted_users.retain(|&x| x != user);
    msg!("User {} removed from whitelist", user);
    
    Ok(())
}



