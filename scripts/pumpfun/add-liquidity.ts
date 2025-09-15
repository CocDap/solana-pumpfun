import { PublicKey } from '@solana/web3.js';
import { wallet, askQuestion } from './config';
import { addLiquidityCore } from './pumfun';
import { NATIVE_MINT } from '@solana/spl-token';
import { baseMint, quoteMint, poolKey } from './constants';

const user = wallet.publicKey;
(async () => {
  try {
    const amountInput = await askQuestion("Input amount : ");
    const slippageInput = await askQuestion("Slippage (%): ");
    const baseInInput = await askQuestion("Choose input token (true = WSOL, false = memecoin): ");

    const slippage = Number(slippageInput);
    const baseIn = baseInInput.toLowerCase() === "true";

    console.log(`\n=== User Input ===`);
    console.log(`Input Amount: ${amountInput} ${baseIn ? 'WSOL' : 'Custom token'}`);
    console.log(`Input Token: ${baseIn ? 'WSOL (quote)' : 'Custom token (base)'}`);
    console.log(`Slippage: ${slippage}%`);
    console.log("==================\n");

    const sig = await addLiquidityCore(poolKey, baseMint, quoteMint, user, amountInput, slippage, baseIn);
    console.log('Liquidity added! Signature:', sig);
    process.exit(0);
  } catch (err) {
    console.error('Error adding liquidity:', err);
    process.exit(1);
  }
})();
