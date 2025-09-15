import { PublicKey } from "@solana/web3.js";
import { wallet, askQuestion } from "./config";
import { swapCore } from "./pumfun";
import { NATIVE_MINT } from "@solana/spl-token";
import { baseMint, quoteMint, poolKey } from "./constants";
const user = wallet.publicKey;

(async () => {
  try {
    console.log('Swap Menu:');
    console.log('1 = Swap Custom token → WSOL');
    console.log('2 = Swap WSOL → Custom token');
    const dirInput = await askQuestion('Choose direction (1 or 2): ');
    const direction = dirInput === '1' ? 'customToWsol' : 'wsolToCustom';

    const exactInInput = await askQuestion('Do you want to enter the amount you SELL (true) or the amount you WANT TO RECEIVE (false)? ');
    const exactIn = exactInInput.toLowerCase() === 'true';

    const amount = await askQuestion('Enter amount: ');
    const slippage = Number(await askQuestion('Slippage (%): '));

    const sig = await swapCore({
      poolKey,
      baseMint,
      quoteMint,
      user,
      amountInput: amount,
      slippage,
      exactIn,
      direction,
    });

    console.log('Swap done:', sig);
    process.exit(0);
  } catch (err) {
    console.error('Swap failed:', err);
    process.exit(1);
  }
})();