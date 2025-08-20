use crate::errors::CommonCustomError;
use anchor_lang::prelude::*;

/// Calculate the initial reserve amount needed for a desired initial price
///
/// Formula:
/// 1. Calculate market cap: initial_price * initial_supply_base
/// 2. Calculate reserve: (market_cap * reserve_ratio) / 10000
///
/// Example:
/// - 0.01 SOL price, 1000 tokens, 50% ratio
/// - Market cap = 0.01 * 1000 = 10 SOL
/// - Reserve = (10 * 50) / 100 = 5 SOL
pub fn calculate_initial_reserve_amount(
    initial_price: u64,
    initial_supply: u64,
    reserve_ratio: u16,
    token_decimals: u8,
) -> Result<u64> {
    // Validate inputs
    require!(reserve_ratio > 0, CommonCustomError::InvalidAmount);
    require!(initial_supply > 0, CommonCustomError::InvalidAmount);
    require!(initial_price > 0, CommonCustomError::InvalidAmount);

    // Convert initial supply to base units (e.g., 1000_000_000 -> 1000)
    let initial_supply_base = initial_supply
        .checked_div(10u64.pow(token_decimals as u32))
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    // Calculate initial market cap
    // Formula: initial_market_cap = initial_price * initial_supply_base
    let initial_market_cap: u128 = (initial_price as u128)
        .checked_mul(initial_supply_base as u128)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    // Calculate initial reserve amount
    // Formula: initial_reserve = (initial_market_cap * reserve_ratio) / 10000
    let initial_reserve = initial_market_cap
        .checked_mul(reserve_ratio as u128)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
        .checked_div(10000)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    // Validate the result is within u64 bounds
    if initial_reserve > u64::MAX as u128 {
        return Err(CommonCustomError::OverFlowUnderFlowOccured.into());
    }

    Ok(initial_reserve as u64)
}

pub fn linear_buy_cost(amount: u64, reserve_ratio: u16, total_supply: u64) -> Result<u64> {
    let new_supply = total_supply
        .checked_add(amount)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let new_supply_squared = (new_supply as u128)
        .checked_mul(new_supply as u128)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let total_supply_squared = (total_supply as u128)
        .checked_mul(total_supply as u128)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let numerator = new_supply_squared
        .checked_sub(total_supply_squared)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
        .checked_div(2)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let denominator = (reserve_ratio as u128)
        .checked_mul(10000)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let cost = numerator
        .checked_div(denominator)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    if cost > u64::MAX as u128 {
        return Err(CommonCustomError::OverFlowUnderFlowOccured.into());
    }

    Ok(cost as u64)
}

pub fn linear_sell_cost(amount: u64, reserve_ratio: u16, total_supply: u64) -> Result<u64> {
    if amount > total_supply {
        return Err(CommonCustomError::InsufficientBalance.into());
    }

    let new_supply = total_supply
        .checked_sub(amount)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let total_supply_squared = (total_supply as u128)
        .checked_mul(total_supply as u128)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let new_supply_squared = (new_supply as u128)
        .checked_mul(new_supply as u128)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let numerator = total_supply_squared
        .checked_sub(new_supply_squared)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
        .checked_div(2)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let denominator = (reserve_ratio as u128)
        .checked_mul(10000)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let reward = numerator
        .checked_div(denominator)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    if reward > u64::MAX as u128 {
        return Err(CommonCustomError::OverFlowUnderFlowOccured.into());
    }

    Ok(reward as u64)
}

pub fn quadratic_buy_cost(amount: u64, reserve_ratio: u16, total_supply: u64) -> Result<u64> {
    // Convert to u128 for intermediate calculations to prevent overflow
    let amount = amount as u128;
    let supply = total_supply as u128;
    let k = (reserve_ratio as u128)
        .checked_div(10000)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let term1 = k
        .checked_mul(supply)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
        .checked_mul(amount)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let term2 = k
        .checked_mul(amount)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
        .checked_mul(amount)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
        .checked_div(2)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let cost = term1
        .checked_add(term2)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    if cost > u64::MAX as u128 {
        return Err(CommonCustomError::OverFlowUnderFlowOccured.into());
    }

    Ok(cost as u64)
}

pub fn quadratic_sell_cost(amount: u64, reserve_ratio: u16, total_supply: u64) -> Result<u64> {
    if amount > total_supply {
        return Err(CommonCustomError::InsufficientBalance.into());
    }

    let amount = amount as u128;
    let supply = total_supply as u128;
    let k = (reserve_ratio as u128)
        .checked_div(10000)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let term1 = k
        .checked_mul(supply)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
        .checked_mul(amount)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let term2 = k
        .checked_mul(amount)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
        .checked_mul(amount)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?
        .checked_div(2)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let reward = term1
        .checked_sub(term2)
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    if reward > u64::MAX as u128 {
        return Err(CommonCustomError::OverFlowUnderFlowOccured.into());
    }

    Ok(reward as u64)
}

pub fn calculate_linear_current_price(
    sol_reserve: u64,
    token_reserve: u64,
    token_decimals: u8,
) -> Result<u64> {
    let token_reserve = token_reserve
        .checked_div(10u64.pow(token_decimals as u32))
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let sol_reserve = sol_reserve
        .checked_div(10u64.pow(9u32))
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let price: u64 = sol_reserve.checked_div(token_reserve).ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;


    Ok(price as u64)
}


// TODO

pub fn calculate_quadratic_current_price(
    sol_reserve: u64,
    token_reserve: u64,
    token_decimals: u8,
) -> Result<u64> {
    let token_reserve = token_reserve
        .checked_div(10u64.pow(token_decimals as u32))
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let sol_reserve = sol_reserve
        .checked_div(10u64.pow(9u32))
        .ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;

    let price: u64 = sol_reserve.checked_div(token_reserve).ok_or(CommonCustomError::OverFlowUnderFlowOccured)?;


    Ok(price as u64)
}


/// Calculate the current price based on bonding curve type
///
/// This function determines the instantaneous price of the token
/// at the current supply level for the specified curve type
pub fn calculate_current_price(
    sol_reserve: u64,
    token_reserve: u64,
    token_decimals: u8,
    bonding_curve_type: u8,
) -> Result<u64> {
    use crate::state::curve_configuration::BondingCurveType;

    let curve_type = BondingCurveType::try_from(bonding_curve_type)
        .map_err(|_| CommonCustomError::InvalidBondingCurveType)?;

    match curve_type {
        BondingCurveType::Linear => calculate_linear_current_price(sol_reserve, token_reserve, token_decimals),
        BondingCurveType::Quadratic => calculate_quadratic_current_price(sol_reserve, token_reserve, token_decimals),
    }   
}

