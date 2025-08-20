use anchor_lang::prelude::*;
use crate::{consts::{LAUNCHPAD_SEED_PREFIX, WHITELIST_DATA_SEED_PREFIX}, state::{WhitelistLaunchData}};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use crate::errors::{LaunchPadCustomErrror, CommonCustomError};

#[derive(Accounts)]
pub struct CreateWhitelistLaunch<'info> {

    #[account(
        init,
        seeds = [WHITELIST_DATA_SEED_PREFIX.as_bytes(), token_mint.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + WhitelistLaunchData::ACCOUNT_SIZE,
    )]
    pub whitelist_data: Box<Account<'info, WhitelistLaunchData>>,
    
    #[account(
        mint::token_program = token_program
    )]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,
    
    #[account(
        init_if_needed,
        token::token_program = token_program,
        associated_token::token_program = token_program,
        associated_token::mint = token_mint,
        associated_token::authority = whitelist_data,
        payer = authority,
    )]
    pub launchpad_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_whitelist_launch(
    ctx: Context<CreateWhitelistLaunch>, 
    token_price: u64, 
    purchase_limit_per_wallet: u64, 
    total_supply: u64,
    whitelist_duration: i64, 
    start_time: i64, 
    end_time: i64
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    msg!("Current time: {}", current_time);
    
    // Validate time ranges
    if start_time <= current_time {
        return Err(LaunchPadCustomErrror::InvalidTimeRange.into());
    }
    
    if end_time <= start_time {
        return Err(LaunchPadCustomErrror::InvalidTimeRange.into());
    }
    
    // Validate token price
    if token_price == 0 {
        return Err(CommonCustomError::InvalidAmount.into());
    }
    
    // Validate purchase limit
    if purchase_limit_per_wallet == 0 {
        return Err(CommonCustomError::InvalidAmount.into());
    }
    
    // Validate total supply
    if total_supply == 0 {
        return Err(CommonCustomError::InvalidAmount.into());
    }

    let whitelist_end_time = current_time.checked_add(whitelist_duration)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let whitelist_data = &mut ctx.accounts.whitelist_data;


    // Initialize WhitelistLaunchData
    whitelist_data.set_inner(WhitelistLaunchData::new(
        ctx.accounts.authority.key(),
        ctx.accounts.token_mint.key(),
        start_time,
        end_time,
        token_price,
        purchase_limit_per_wallet,
        total_supply,
        whitelist_end_time,
        ctx.bumps.whitelist_data,
    ));

    msg!("Whitelist launch created successfully");
    msg!("Token price: {}", token_price);
    msg!("Purchase limit per wallet: {}", purchase_limit_per_wallet);
    msg!("Total supply: {}", total_supply);
    msg!("Start time: {}", start_time);
    msg!("End time: {}", end_time);
    msg!("Whitelist duration: {}", whitelist_duration);

    Ok(())
}
