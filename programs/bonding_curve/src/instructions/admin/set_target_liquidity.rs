use crate::errors::CommonCustomError;
use crate::state::{CurveConfiguration, CurveConfigurationAccount};
use anchor_lang::prelude::*;

pub fn set_target_liquidity(ctx: Context<SetTargetLiquidity>, new_target_liquidity: u64) -> Result<()> {
    msg!("Setting target liquidity to: {}", new_target_liquidity);

    let bonding_curve_configuration = &mut ctx.accounts.bonding_curve_configuration;

    // Use the trait method to update target liquidity
    bonding_curve_configuration.set_target_liquidity(new_target_liquidity)?;

    msg!("Target liquidity successfully updated to: {}", new_target_liquidity);
    Ok(())
}

#[derive(Accounts)]
pub struct SetTargetLiquidity<'info> {
    #[account(mut, has_one = global_admin @ CommonCustomError::InvalidAuthority)]
    pub bonding_curve_configuration: Box<Account<'info, CurveConfiguration>>,

    #[account(mut)]
    pub global_admin: Signer<'info>,
}


