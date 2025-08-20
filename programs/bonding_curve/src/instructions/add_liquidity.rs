use crate::consts::*;
use crate::errors::CommonCustomError;
use crate::state::{BondingCurve, BondingCurveAccount, CurveConfiguration};
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

pub fn add_liquidity(ctx: Context<AddLiquidity>, sol_amount: u64, token_amount: u64) -> Result<()> {
    msg!("Trying to add liquidity to the pool");

    let bonding_curve = &mut ctx.accounts.bonding_curve_account;
    let bonding_curve_configuration = &ctx.accounts.bonding_curve_configuration;
    let user = &ctx.accounts.user;
    // check if the user is the creator of the pool
    if bonding_curve.creator != user.key() {
        return Err(CommonCustomError::InvalidAuthority.into());
    }

    let system_program = &ctx.accounts.system_program;
    let token_program = &ctx.accounts.token_program;
    let pool_sol_vault = &mut ctx.accounts.pool_sol_vault;

    let token_one_accounts = (
        &mut *ctx.accounts.token_mint,
        &mut *ctx.accounts.pool_token_account,
        &mut *ctx.accounts.user_token_account,
    );

    bonding_curve.add_liquidity(
        token_one_accounts,
        pool_sol_vault,
        token_amount,
        sol_amount,
        bonding_curve_configuration.locked_liquidity,
        user,
        token_program,
        system_program,
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(
        mut,
        seeds = [CURVE_CONFIGURATION_SEED.as_bytes(), token_mint.key().as_ref()],
        bump,
    )]
    pub bonding_curve_configuration: Box<Account<'info, CurveConfiguration>>,

    #[account(
        mut,
        seeds = [POOL_SEED_PREFIX.as_bytes(), token_mint.key().as_ref()],
        bump = bonding_curve_account.bump,
    )]
    pub bonding_curve_account: Box<Account<'info, BondingCurve>>,

    #[account(mut)]
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::token_program = token_program,
        associated_token::mint = token_mint,
        associated_token::authority = bonding_curve_account,
    )]
    pub pool_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK:
    #[account(
        mut,
        seeds = [SOL_VAULT_PREFIX.as_bytes(), token_mint.key().as_ref()],
        bump
    )]
    pub pool_sol_vault: AccountInfo<'info>,

    #[account(mut,
        associated_token::mint = token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub user_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
