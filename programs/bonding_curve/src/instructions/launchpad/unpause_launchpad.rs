use anchor_lang::prelude::*;
use crate::{
    state::{WhitelistLaunchData, FairLaunchData}, 
    consts::LAUNCHPAD_SEED_PREFIX,
    errors::LaunchPadCustomErrror
};

#[derive(Accounts)]
pub struct UnpauseLaunchPad<'info> {

    #[account(mut)]
    pub whitelist_data: Option<Account<'info, WhitelistLaunchData>>,
    
    #[account(mut)]
    pub fair_launch_data: Option<Account<'info, FairLaunchData>>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn unpause_launchpad(ctx: Context<UnpauseLaunchPad>) -> Result<()> {
    let mut unpaused_count = 0;

    // Unpause whitelist if it exists
    if let Some(whitelist_data) = &mut ctx.accounts.whitelist_data {

        whitelist_data.paused = false;
        unpaused_count += 1;
        msg!("Whitelist launch unpaused");
    }

    // Unpause fair launch if it exists
    if let Some(fair_launch_data) = &mut ctx.accounts.fair_launch_data {

        fair_launch_data.paused = false;
        unpaused_count += 1;
        msg!("Fair launch unpaused");
    }

    // Ensure at least one launch type was unpaused
    if unpaused_count == 0 {
        return Err(LaunchPadCustomErrror::InvalidLaunchType.into());
    }

    msg!("Successfully unpaused {} launch type(s)", unpaused_count);
    Ok(())
}

