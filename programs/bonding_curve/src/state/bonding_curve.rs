use crate::consts::*;
use crate::errors::CommonCustomError;
use crate::state::curve_configuration::{
    BondingCurveType, CurveConfiguration, CurveConfigurationAccount,
};
use crate::utils::calc::*;
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

/// BONDING CURVE ACCOUNT
#[account]
pub struct BondingCurve {
    pub creator: Pubkey,
    pub total_supply: u64,    // Tracks the total token supply
    pub reserve_balance: u64, // Tracks the SOL reserve balance
    pub reserve_token: u64,   // Tracks the token reserve balance
    pub token: Pubkey,        // Public key of the token in the liquidity pool
    pub bump: u8,             // Bump seed for PDA
}

impl BondingCurve {
    // Discriminator (8) + Pubkey(32) + u64(8) + u64(8) + u64(8) + Pubkey(32) + u16(2) + u8(1)
    pub const ACCOUNT_SIZE: usize = 8 + 32 + 8 + 8 + 8 + 32 + 2 + 1;
    pub fn new(creator: Pubkey, token: Pubkey, bump: u8) -> Self {
        Self {
            creator,
            total_supply: 0,
            reserve_balance: 0,
            reserve_token: 0,
            token,
            bump,
        }
    }

    pub fn get_signer<'a>(bump: &'a u8, mint: &'a Pubkey) -> [&'a [u8]; 3] {
        [
            POOL_SEED_PREFIX.as_bytes(),
            mint.as_ref(),
            std::slice::from_ref(bump),
        ]
    }
}

pub trait BondingCurveAccount<'info> {
    fn get_sol_cost_for_token_buy(
        &mut self,
        amount: u64,
        bonding_curve_type: u8,
        reserve_ratio: u16,
    ) -> Result<u64>;
    fn get_sol_return_for_token_sell(
        &mut self,
        amount: u64,
        bonding_curve_type: u8,
        reserve_ratio: u16,
    ) -> Result<u64>;
    fn get_token_cost_for_sol_buy(
        &mut self,
        sol_amount: u64,
        bonding_curve_type: u8,
        reserve_ratio: u16,
    ) -> Result<u64>;
    fn get_token_return_for_sol_sell(
        &mut self,
        sol_amount: u64,
        bonding_curve_type: u8,
        reserve_ratio: u16,
    ) -> Result<u64>;

    // Add these new price calculation methods
    fn get_current_price(&self, bonding_curve_type: u8) -> Result<u64>;

    // Allows adding liquidity by depositing an amount of two tokens and getting back pool shares
    fn add_liquidity(
        &mut self,
        token_accounts: (
            &mut InterfaceAccount<'info, Mint>,
            &mut InterfaceAccount<'info, TokenAccount>,
            &mut InterfaceAccount<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        token_amount: u64,
        sol_amount: u64,
        locked_liquidity: bool,
        authority: &Signer<'info>,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()>;

    // Allows removing liquidity by burning pool shares and receiving back a proportionate amount of tokens
    fn remove_liquidity(
        &mut self,
        token_accounts: (
            // token mint
            &mut InterfaceAccount<'info, Mint>,
            // pool token account
            &mut InterfaceAccount<'info, TokenAccount>,
            // user token account
            &mut InterfaceAccount<'info, TokenAccount>,
        ),
        pool_sol_account: &mut AccountInfo<'info>,
        authority: &Signer<'info>,
        bump: u8,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()>;

    fn buy(
        &mut self,
        bonding_configuration_account: &mut Account<'info, CurveConfiguration>,
        token_accounts: (
            &mut InterfaceAccount<'info, Mint>,
            &mut InterfaceAccount<'info, TokenAccount>,
            &mut InterfaceAccount<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        sol_amount: u64,
        fee_percentage: u16,
        authority: &Signer<'info>,
        bonding_curve_type: u8,
        // target liquidity for migration
        target_liquidity: u64,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()>;

    fn sell(
        &mut self,
        bonding_configuration_account: &mut Account<'info, CurveConfiguration>,
        token_accounts: (
            &mut InterfaceAccount<'info, Mint>,
            &mut InterfaceAccount<'info, TokenAccount>,
            &mut InterfaceAccount<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        amount: u64,
        fee_percentage: u16,
        bump: u8,
        authority: &Signer<'info>,
        bonding_curve_type: u8,
        // target liquidity for migration
        target_liquidity: u64,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()>;

    fn buy_sol_with_token_cost(
        &mut self,
        bonding_configuration_account: &mut Account<'info, CurveConfiguration>,
        token_accounts: (
            &mut InterfaceAccount<'info, Mint>,
            &mut InterfaceAccount<'info, TokenAccount>,
            &mut InterfaceAccount<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        sol_amount: u64,
        fee_percentage: u16,
        bump: u8,
        authority: &Signer<'info>,
        bonding_curve_type: u8,
        target_liquidity: u64,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()>;

    fn sell_with_sol_amount(
        &mut self,
        bonding_configuration_account: &mut Account<'info, CurveConfiguration>,
        token_accounts: (
            &mut InterfaceAccount<'info, Mint>,
            &mut InterfaceAccount<'info, TokenAccount>,
            &mut InterfaceAccount<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        sol_amount: u64,
        fee_percentage: u16,
        bump: u8,
        authority: &Signer<'info>,
        bonding_curve_type: u8,
        target_liquidity: u64,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()>;

    fn transfer_sol_to_pool(
        &self,
        from: &Signer<'info>,
        to: &mut AccountInfo<'info>,
        amount: u64,
        system_program: &Program<'info, System>,
    ) -> Result<()>;

    fn transfer_sol_from_pool(
        &self,
        from: &mut AccountInfo<'info>,
        to: &Signer<'info>,
        amount: u64,
        bump: u8,
        system_program: &Program<'info, System>,
        seed: &[u8],
    ) -> Result<()>;

    fn transfer_token_from_pool(
        &self,
        from: &InterfaceAccount<'info, TokenAccount>,
        to: &InterfaceAccount<'info, TokenAccount>,
        token_mint: &InterfaceAccount<'info, Mint>,
        amount: u64,
        token_program: &Interface<'info, TokenInterface>,
    ) -> Result<()>;

    fn transfer_token_to_pool(
        &self,
        from: &InterfaceAccount<'info, TokenAccount>,
        to: &InterfaceAccount<'info, TokenAccount>,
        token_mint: &InterfaceAccount<'info, Mint>,
        amount: u64,
        authority: &Signer<'info>,
        token_program: &Interface<'info, TokenInterface>,
    ) -> Result<()>;
    // fn transfer_sol_to_admin(
    //     &self,
    //     from: &Signer<'info>,
    //     admin: &AccountInfo<'info>,
    //     amount: u64,
    //     system_program: &Program<'info, System>,
    // ) -> Result<()>;
}

impl<'info> BondingCurveAccount<'info> for Account<'info, BondingCurve> {
    fn get_sol_cost_for_token_buy(
        &mut self,
        amount: u64,
        bonding_curve_type: u8,
        reserve_ratio: u16,
    ) -> Result<u64> {
        let bonding_curve_type = BondingCurveType::try_from(bonding_curve_type)
            .map_err(|_| CommonCustomError::InvalidBondingCurveType)?;

        match bonding_curve_type {
            BondingCurveType::Quadratic => {
                quadratic_buy_cost(amount, reserve_ratio, self.total_supply)
            }
            BondingCurveType::Linear => {
                calc_sol_for_buy(amount, self.reserve_balance, self.reserve_token)
            }
        }
    }

    fn get_sol_return_for_token_sell(
        &mut self,
        amount: u64,
        bonding_curve_type: u8,
        reserve_ratio: u16,
    ) -> Result<u64> {
        let bonding_curve_type = BondingCurveType::try_from(bonding_curve_type)
            .map_err(|_| CommonCustomError::InvalidBondingCurveType)?;

        match bonding_curve_type {
            BondingCurveType::Quadratic => {
                quadratic_sell_cost(amount, reserve_ratio, self.total_supply)
            }
            BondingCurveType::Linear => {
                calc_sol_for_sell_token(amount, self.reserve_balance, self.reserve_token)
            }
        }
    }

    fn get_token_cost_for_sol_buy(
        &mut self,
        sol_amount: u64,
        bonding_curve_type: u8,
        reserve_ratio: u16,
    ) -> Result<u64> {
        let bonding_curve_type = BondingCurveType::try_from(bonding_curve_type)
            .map_err(|_| CommonCustomError::InvalidBondingCurveType)?;

        match bonding_curve_type {
            BondingCurveType::Linear => {
                calc_tokens_for_buy_sol(sol_amount, self.reserve_balance, self.reserve_token)
            }
            BondingCurveType::Quadratic => Err(CommonCustomError::InvalidBondingCurveType.into()),
        }
    }

    fn get_token_return_for_sol_sell(
        &mut self,
        sol_amount: u64,
        bonding_curve_type: u8,
        reserve_ratio: u16,
    ) -> Result<u64> {
        let bonding_curve_type = BondingCurveType::try_from(bonding_curve_type)
            .map_err(|_| CommonCustomError::InvalidBondingCurveType)?;

        match bonding_curve_type {
            BondingCurveType::Quadratic => Err(CommonCustomError::InvalidBondingCurveType.into()),
            BondingCurveType::Linear => {
                calc_tokens_for_sell_sol(sol_amount, self.reserve_balance, self.reserve_token)
            }
        }
    }

    fn get_current_price(&self, bonding_curve_type: u8) -> Result<u64> {
        calculate_current_price(
            self.reserve_balance,
            self.reserve_token,
            6,
            bonding_curve_type,
        )
    }

    // Allows adding liquidity by depositing an amount of two tokens and getting back pool shares
    fn add_liquidity(
        &mut self,
        token_accounts: (
            // token mint
            &mut InterfaceAccount<'info, Mint>,
            // pool token account
            &mut InterfaceAccount<'info, TokenAccount>,
            // user token account
            &mut InterfaceAccount<'info, TokenAccount>,
        ),

        pool_sol_vault: &mut AccountInfo<'info>,
        token_amount: u64,
        sol_amount: u64,
        locked_liquidity: bool,
        authority: &Signer<'info>,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        msg!("Adding liquidity to the pool");
        // Checking if the amount is greater than 0 and less than token balance
        let balance = token_accounts.2.amount;
        if token_amount == 0 || token_amount > balance {
            return err!(CommonCustomError::InvalidAmount);
        }
        // unable to  add liquidity if the bonding curve locked
        if locked_liquidity {
            return err!(CommonCustomError::LiquidityLocked);
        }
        // make sure the reserve balance is not exceed the target liquidity
        // TODO!

        msg!("transfer token to pool");
        self.transfer_token_to_pool(
            token_accounts.2,
            token_accounts.1,
            token_accounts.0,
            token_amount,
            authority,
            token_program,
        )?;

        msg!("transfer sol to pool");
        self.transfer_sol_to_pool(authority, pool_sol_vault, sol_amount, system_program)?;
        self.reserve_token += token_amount;
        self.reserve_balance += sol_amount;

        Ok(())
    }

    // Allows removing liquidity by burning pool shares and receiving back a proportionate amount of tokens
    fn remove_liquidity(
        &mut self,
        token_accounts: (
            // token mint
            &mut InterfaceAccount<'info, Mint>,
            // pool token account
            &mut InterfaceAccount<'info, TokenAccount>,
            // user token account
            &mut InterfaceAccount<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        authority: &Signer<'info>,
        bump: u8,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        self.transfer_token_from_pool(
            token_accounts.1,
            token_accounts.2,
            token_accounts.0,
            token_accounts.1.amount as u64,
            token_program,
        )?;
        let amount = pool_sol_vault.to_account_info().lamports() as u64;
        self.transfer_sol_from_pool(
            pool_sol_vault,
            authority,
            amount,
            bump,
            system_program,
            SOL_VAULT_PREFIX.as_bytes(),
        )?;
        Ok(())
    }

    fn buy(
        &mut self,
        bonding_configuration_account: &mut Account<'info, CurveConfiguration>,
        token_accounts: (
            &mut InterfaceAccount<'info, Mint>,
            &mut InterfaceAccount<'info, TokenAccount>,
            &mut InterfaceAccount<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        token_amount: u64,
        fee_percentage: u16,
        authority: &Signer<'info>,
        bonding_curve_type: u8,
        // target liquidity for migration
        target_liquidity: u64,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        let sol_cost = self.get_sol_cost_for_token_buy(
            token_amount,
            bonding_curve_type,
            bonding_configuration_account.reserve_ratio,
        )?;
        let creator = bonding_configuration_account.global_admin; //pubkey of creator
        msg!("Creator pubkey: {:?}", creator);
        let reserve_fee = sol_cost
            .checked_mul(bonding_configuration_account.reserve_ratio as u64)
            .unwrap()
            .checked_div(10_000)
            .unwrap();
        msg!("reserve fee in sol {:?}", reserve_fee);

        let fee_in_sol = sol_cost
            .checked_mul(fee_percentage as u64)
            .unwrap()
            .checked_div(10_000)
            .unwrap();

        msg!("fee in sol {:?}", fee_in_sol);
        let total_sol_cost = sol_cost
            .checked_add(fee_in_sol)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

        let total_user_pays = sol_cost
            .checked_add(reserve_fee)
            .unwrap()
            .checked_add(fee_in_sol)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;
        msg!("User pays total: {}", total_user_pays);

        if self.reserve_balance + token_amount > target_liquidity {
            return err!(CommonCustomError::TargetLiquidityReached);
        }
        self.total_supply = self
            .total_supply
            .checked_add(total_sol_cost)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

        self.reserve_balance = self
            .reserve_balance
            .checked_add(token_amount)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

        self.reserve_token = self
            .reserve_token
            .checked_sub(token_amount)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

        self.transfer_sol_to_pool(authority, pool_sol_vault, total_sol_cost, system_program)?;

        // self.transfer_reserve_fee_to_treasury(authority, treasury, reserve_fee, system_program)?;

        self.transfer_token_from_pool(
            token_accounts.1,
            token_accounts.2,
            token_accounts.0,
            token_amount,
            token_program,
        )?;
        // Collect fees
        bonding_configuration_account.calculate_fee(fee_in_sol)?;

        Ok(())
    }

    fn buy_sol_with_token_cost(
        &mut self,
        bonding_configuration_account: &mut Account<'info, CurveConfiguration>,
        token_accounts: (
            &mut InterfaceAccount<'info, Mint>,
            &mut InterfaceAccount<'info, TokenAccount>,
            &mut InterfaceAccount<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        sol_amount: u64,
        fee_percentage: u16,
        bump: u8,
        authority: &Signer<'info>,
        bonding_curve_type: u8,
        target_liquidity: u64,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        let token_cost = self.get_token_cost_for_sol_buy(
            sol_amount,
            bonding_curve_type,
            bonding_configuration_account.reserve_ratio,
        )?;
        let reserve_fee = token_cost
            .checked_mul(bonding_configuration_account.reserve_ratio as u64)
            .unwrap()
            .checked_div(10_000)
            .unwrap();
        msg!("reserve fee in sol {:?}", reserve_fee);
        let fee = (token_cost as u128)
            .checked_mul(fee_percentage as u128)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
            .checked_div(10000)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)? as u64;

        // if self.reserve_balance.checked_sub(sol_amount).unwrap_or(0) < target_liquidity {
        //     return err!(CommonCustomError::TargetLiquidityReached);
        // }

        self.total_supply = self
            .total_supply
            .checked_add(token_cost)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;
        self.reserve_balance = self
            .reserve_balance
            .checked_sub(sol_amount)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;
        self.reserve_token = self
            .reserve_token
            .checked_add(token_cost)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

        self.transfer_sol_from_pool(
            pool_sol_vault,
            authority,
            sol_amount,
            bump,
            system_program,
            SOL_VAULT_PREFIX.as_bytes(),
        )?;

        self.transfer_token_to_pool(
            token_accounts.2,
            token_accounts.1,
            token_accounts.0,
            token_cost,
            authority,
            token_program,
        )?;

        bonding_configuration_account.calculate_fee(fee)?;

        Ok(())
    }

    fn sell(
        &mut self,
        bonding_configuration_account: &mut Account<'info, CurveConfiguration>,
        token_accounts: (
            // token mint
            &mut InterfaceAccount<'info, Mint>,
            // pool token account
            &mut InterfaceAccount<'info, TokenAccount>,
            // user token account
            &mut InterfaceAccount<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        token_amount: u64,
        fee_percentage: u16,
        bump: u8,
        authority: &Signer<'info>,
        bonding_curve_type: u8,
        target_liquidity: u64,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        // Calc SOL returned when user sell token_amount
        let sol_returned = self.get_sol_return_for_token_sell(
            token_amount,
            bonding_curve_type,
            bonding_configuration_account.reserve_ratio,
        )?;
        msg!("User will receive {:?} lamports of SOL", sol_returned);

        let fee = (sol_returned as u128)
            .checked_mul(fee_percentage as u128)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
            .checked_div(10_000)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)? as u64;

        let user_receive = sol_returned
            .checked_sub(fee)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

        //Check pool liquidity
        if self.reserve_balance < sol_returned {
            return err!(CommonCustomError::NotEnoughSolInVault);
        }
        if self.reserve_balance - sol_returned < target_liquidity {
            return err!(CommonCustomError::TargetLiquidityReached);
        }

        self.total_supply = self
            .total_supply
            .checked_sub(token_amount)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;
        self.reserve_balance = self
            .reserve_balance
            .checked_sub(sol_returned)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;
        self.reserve_token = self
            .reserve_token
            .checked_add(token_amount)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

        self.transfer_token_to_pool(
            token_accounts.2, // user ATA
            token_accounts.1, // pool ATA
            token_accounts.0, // token mint
            token_amount,
            authority,
            token_program,
        )?;

        self.transfer_sol_from_pool(
            pool_sol_vault,
            authority,
            user_receive,
            bump,
            system_program,
            SOL_VAULT_PREFIX.as_bytes(),
        )?;

        bonding_configuration_account.calculate_fee(fee)?;

        Ok(())
    }
    fn sell_with_sol_amount(
        &mut self,
        bonding_configuration_account: &mut Account<'info, CurveConfiguration>,
        token_accounts: (
            &mut InterfaceAccount<'info, Mint>,         // token mint
            &mut InterfaceAccount<'info, TokenAccount>, // pool token account
            &mut InterfaceAccount<'info, TokenAccount>, // user token account
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        sol_amount: u64,
        fee_percentage: u16,
        bump: u8,
        authority: &Signer<'info>,
        bonding_curve_type: u8,
        target_liquidity: u64,
        token_program: &Interface<'info, TokenInterface>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        let token_amount = self.get_token_return_for_sol_sell(
            sol_amount,
            bonding_curve_type,
            bonding_configuration_account.reserve_ratio,
        )?;

        let fee = (sol_amount as u128)
            .checked_mul(fee_percentage as u128)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
            .checked_div(10000)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)? as u64;

        let sol_after_fee = sol_amount
            .checked_sub(fee)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

        // Check target liquidity
        if self.reserve_balance + sol_after_fee > target_liquidity {
            return err!(CommonCustomError::TargetLiquidityReached);
        }

        self.transfer_sol_to_pool(authority, pool_sol_vault, sol_amount, system_program)?;

        self.transfer_token_from_pool(
            token_accounts.1, // pool token account
            token_accounts.2, // user token account
            token_accounts.0, // token mint
            token_amount,
            token_program,
        )?;

        self.total_supply += token_amount;
        self.reserve_balance += sol_after_fee;
        self.reserve_token = self
            .reserve_token
            .checked_sub(token_amount)
            .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

        bonding_configuration_account.calculate_fee(fee)?;

        Ok(())
    }

    fn transfer_sol_to_pool(
        &self,
        from: &Signer<'info>,
        to: &mut AccountInfo<'info>,
        amount: u64,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        system_program::transfer(
            CpiContext::new(
                system_program.to_account_info(),
                system_program::Transfer {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }
    fn transfer_sol_from_pool(
        &self,
        from: &mut AccountInfo<'info>,
        to: &Signer<'info>,
        amount: u64,
        bump: u8,
        system_program: &Program<'info, System>,
        seed: &[u8],
    ) -> Result<()> {
        system_program::transfer(
            CpiContext::new_with_signer(
                system_program.to_account_info(),
                system_program::Transfer {
                    from: from.clone(),
                    to: to.to_account_info().clone(),
                },
                &[&[
                    // SOL_VAULT_PREFIX.as_bytes(),
                    seed,
                    self.token.key().as_ref(),
                    &[bump],
                ]],
            ),
            amount,
        )?;
        Ok(())
    }

    fn transfer_token_from_pool(
        &self,
        from: &InterfaceAccount<'info, TokenAccount>,
        to: &InterfaceAccount<'info, TokenAccount>,
        token_mint: &InterfaceAccount<'info, Mint>,
        amount: u64,
        token_program: &Interface<'info, TokenInterface>,
    ) -> Result<()> {
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                    mint: token_mint.to_account_info(),
                    authority: self.to_account_info(),
                },
                &[&[
                    POOL_SEED_PREFIX.as_bytes(),
                    self.token.key().as_ref(),
                    &[self.bump],
                ]],
            ),
            amount,
            token_mint.decimals,
        )?;
        Ok(())
    }

    fn transfer_token_to_pool(
        &self,
        from: &InterfaceAccount<'info, TokenAccount>,
        to: &InterfaceAccount<'info, TokenAccount>,
        token_mint: &InterfaceAccount<'info, Mint>,
        amount: u64,
        authority: &Signer<'info>,
        token_program: &Interface<'info, TokenInterface>,
    ) -> Result<()> {
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new(
                token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    from: from.to_account_info(),
                    mint: token_mint.to_account_info(),
                    to: to.to_account_info(),
                    authority: authority.to_account_info(),
                },
            ),
            amount,
            token_mint.decimals,
        )?;
        Ok(())
    }
    // fn transfer_sol_to_admin(
    //     &self,
    //     from: &Signer<'info>,
    //     admin: &AccountInfo<'info>,
    //     amount: u64,
    //     system_program: &Program<'info, System>,
    // ) -> Result<()> {
    //     let ix = anchor_lang::system_program::Transfer {
    //         from: from.to_account_info(),
    //         to: admin.clone(),
    //     };

    //     let cpi_ctx = CpiContext::new(system_program.to_account_info(), ix);

    //     system_program::transfer(cpi_ctx, amount)
    // }
}
