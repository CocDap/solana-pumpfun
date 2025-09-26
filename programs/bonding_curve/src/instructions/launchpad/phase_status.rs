use anchor_lang::prelude::*;
use crate::consts::{FAIR_LAUNCH_DATA_SEED_PREFIX};
use crate::state::FairLaunchData;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum PhaseStatus {
    Upcoming,   
    Active,      
    Ended,       
    Successful,  
    Failed,      
}

#[derive(Accounts)]
pub struct PhaseStatusCtx<'info> {
    #[account(
        seeds = [FAIR_LAUNCH_DATA_SEED_PREFIX.as_bytes(), token_mint.key().as_ref()],
        bump
    )]
    pub fair_launch_data: Box<Account<'info, FairLaunchData>>,
    /// CHECK: This is the token mint for the fair launch
    pub token_mint: AccountInfo<'info>,
}

pub fn phase_status(ctx: Context<PhaseStatusCtx>) -> Result<()> {
    let fair = &ctx.accounts.fair_launch_data;
    let now = Clock::get()?.unix_timestamp;

    let status = if now < fair.start_time {
        PhaseStatus::Upcoming
    } else if fair.total_raised >= fair.hard_cap {
        PhaseStatus::Ended
    } else if now >= fair.start_time && now <= fair.end_time {
        PhaseStatus::Active
    } else {
        // now > end_time
        if fair.total_raised >= fair.soft_cap {
            PhaseStatus::Successful
        } else {
            PhaseStatus::Failed
        }
    };

    msg!("--- FairLaunchData info ---");
    msg!("FairLaunchData Pubkey: {}", ctx.accounts.fair_launch_data.key());
    msg!("authority: {}", fair.authority);
    msg!("token_mint: {}", fair.token_mint);
    msg!("vault (launchpad_vault): {}", fair.vault);
    msg!("contribution_vault (PDA): {}", fair.vault);
    msg!("start_time (unix): {}", fair.start_time);
    msg!("end_time   (unix): {}", fair.end_time);
    msg!("soft_cap (lamports): {}", fair.soft_cap);
    msg!("hard_cap (lamports): {}", fair.hard_cap);
    msg!("min_contribution (lamports): {}", fair.min_contribution);
    msg!("max_contribution (lamports): {}", fair.max_contribution);
    msg!("max_tokens_per_wallet: {}", fair.max_tokens_per_wallet);
    msg!("distribution_delay: {}", fair.distribution_delay);
    msg!("total_raised (lamports): {}", fair.total_raised);
    // nếu bạn lưu bump trong struct
    if let Some(bump_val) = fair.bump.checked_sub(0) { // just to show bump if exists
        msg!("bump: {}", bump_val);
    }
    msg!("Computed status: {:?}", status);
    msg!("---------------------------");

    Ok(())
}
