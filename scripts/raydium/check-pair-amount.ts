import { Percent } from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import { initSdk, connection, askQuestion, formatAmount } from './config';
import { PublicKey } from '@solana/web3.js';
import Decimal from 'decimal.js';

async function checkPairAmount() {
  try {
    const poolIdInput = await askQuestion("Pool ID: ");
    const amountInput = await askQuestion("Input amount: ");
    const baseInInput = await askQuestion("Choose input token (true = WSOL, false = custom token): ");
    const slippageInput = await askQuestion("Slippage (%): ");

    const slippage = new Percent(Number(slippageInput), 100);
    const baseIn = baseInInput.toLowerCase() === "true";

    console.log(`\n=== User Input ===`);
    console.log(`Pool ID: ${poolIdInput}`);
    console.log(`Input Amount: ${amountInput}`);
    console.log(`Base In: ${baseIn ? "WSOL" : "Custom Token"}`);
    console.log(`Slippage: ${slippageInput}%`);
    console.log("==================\n");

    const raydium = await initSdk();
    const poolId = new PublicKey(poolIdInput);
    const pool = await raydium.cpmm.getPoolInfoFromRpc(poolId.toString());

    if (!pool || pool.poolInfo.type !== 'Standard') {
      throw new Error('CPMM pool not found.');
    }

    const poolInfo = {
      ...pool.poolInfo,
      authority: pool.poolKeys.authority,
      config: { ...pool.poolInfo.config },
    };

    if (!pool.poolKeys?.authority) throw new Error('Pool authority is undefined.');
    if (pool.rpcData.baseReserve.isZero() || pool.rpcData.quoteReserve.isZero()) {
      throw new Error('Pool has no initial liquidity.');
    }

    const epochInfo = await connection.getEpochInfo();
    const pairAmount = raydium.cpmm.computePairAmount({
      poolInfo,
      baseReserve: pool.rpcData.baseReserve,
      quoteReserve: pool.rpcData.quoteReserve,
      amount: amountInput,
      slippage,
      epochInfo,
      baseIn,
    });

    console.log(`\n=== Pair Amount Calculation ===`);
    console.log(
      `Amount In: ${amountInput} ${baseIn ? poolInfo.mintA.address : poolInfo.mintB.address}`
    );
    console.log(
      `Amount Out: ${formatAmount(
        pairAmount.anotherAmount.amount,
        baseIn ? poolInfo.mintB.decimals : poolInfo.mintA.decimals
      )} ${baseIn ? poolInfo.mintB.address : poolInfo.mintA.address}`
    );
    console.log(
      `Max (with slippage): ${formatAmount(
        pairAmount.maxAnotherAmount.amount,
        baseIn ? poolInfo.mintB.decimals : poolInfo.mintA.decimals
      )}`
    );
    console.log(
      `Min (with slippage): ${formatAmount(
        pairAmount.minAnotherAmount.amount,
        baseIn ? poolInfo.mintB.decimals : poolInfo.mintA.decimals
      )}`
    );
    console.log("==============================\n");

    process.exit(0);
  } catch (error) {
    console.error('Error while checking pair amount:', error);
    process.exit(1);
  }
}

checkPairAmount();
