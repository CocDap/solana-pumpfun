import { PublicKey } from '@solana/web3.js';
import { wallet, askQuestion } from './config';
import { removeLiquidityCore } from './pumfun';
import { NATIVE_MINT } from '@solana/spl-token';
import { baseMint, quoteMint, poolKey } from './constants';

const user = wallet.publicKey;
(async () => {
  try {
    const lpAmountInput = await askQuestion("Input LP token amount to remove: ");
    const slippageInput = await askQuestion("Slippage (%): ");

    const slippage = Number(slippageInput);

    console.log(`\n=== User Input ===`);
    console.log(`LP Tokens to remove: ${lpAmountInput}`);
    console.log(`Slippage: ${slippage}%`);
    console.log("==================\n");

    const sig = await removeLiquidityCore(poolKey, baseMint, quoteMint, user, lpAmountInput, slippage);
    console.log('Liquidity removed! Signature:', sig);
    process.exit(0);
  } catch (err) {
    console.error('Error removing liquidity:', err);
    process.exit(1);
  }
})();
