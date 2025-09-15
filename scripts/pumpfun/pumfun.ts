import {
    PublicKey,
    Transaction,
} from '@solana/web3.js';
import {
    PumpAmmSdk,
} from '@pump-fun/pump-swap-sdk';
import BN from 'bn.js';
import {
    ensureATA,
    wallet,
    connection,
    getFlexibleMintInfo,
    UserSwapMode,
    SwapOptions
} from './config';
import {
    getAccount,
    NATIVE_MINT
} from '@solana/spl-token';

const pumpAmmSdk = new PumpAmmSdk(connection);

export async function addLiquidityCore(
    poolKey: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    user: PublicKey,
    amountInput: string,
    slippage: number,
    baseIn: boolean
) {
    try {
        const baseTokenAccount = await ensureATA(baseMint, user);
        const quoteTokenAccount = await ensureATA(quoteMint, user);

        let inputAmountRaw: BN;

        if (baseIn) {
            inputAmountRaw = new BN(Math.floor(parseFloat(amountInput) * 1e9));

            try {
                const wsolAccount = await getAccount(connection, quoteTokenAccount);
                if (wsolAccount.amount < BigInt(inputAmountRaw.toString())) {
                    throw new Error(
                        `Insufficient WSOL balance. Required: ${amountInput} WSOL. ` +
                        `Please wrap more SOL first using "spl-token wrap <amount>".`
                    );
                }
            } catch (e) {
                throw new Error(
                    `No WSOL account found. Please wrap SOL into WSOL first using "spl-token wrap <amount>".`
                );
            }

            console.log(`Using existing WSOL ATA: ${quoteTokenAccount.toBase58()}`);
        } else {
            const baseMintInfo = await getFlexibleMintInfo(baseMint);
            const decimals = baseMintInfo.decimals;
            inputAmountRaw = new BN(Math.floor(parseFloat(amountInput) * Math.pow(10, decimals)));
            console.log(`Base token decimals: ${decimals}`);
        }

        // Fetch pool state
        const state = await pumpAmmSdk.liquiditySolanaState(
            poolKey,
            user,
            baseTokenAccount,
            quoteTokenAccount
        );

        let baseAmount: BN, quoteAmount: BN, lpToken: BN;

        if (baseIn) {
            ({ base: baseAmount, lpToken } =
                pumpAmmSdk.depositAutocompleteBaseAndLpTokenFromQuote(
                    state,
                    inputAmountRaw,
                    slippage
                ));
            quoteAmount = inputAmountRaw;
        } else {
            ({ quote: quoteAmount, lpToken } =
                pumpAmmSdk.depositAutocompleteQuoteAndLpTokenFromBase(
                    state,
                    inputAmountRaw,
                    slippage
                ));
            baseAmount = inputAmountRaw;
        }

        // 👉 Log chi tiết ảnh hưởng của slippage
        const slippageFraction = slippage / 100;
        const minBase = baseAmount.sub(baseAmount.muln(slippage).divn(100));
        const minQuote = quoteAmount.sub(quoteAmount.muln(slippage).divn(100));

        console.log(`Expected Base Amount: ${baseAmount.toString()}`);
        console.log(`Min Base Amount (with slippage ${slippage}%): ${minBase.toString()}`);
        console.log(`Expected Quote Amount: ${quoteAmount.toString()}`);
        console.log(`Min Quote Amount (with slippage ${slippage}%): ${minQuote.toString()}`);
        console.log(`LP Tokens to receive (approx): ${lpToken.toString()}`);

        // Build transaction
        const instructions = await pumpAmmSdk.depositInstructions(state, lpToken, slippage);
        const tx = new Transaction().add(...instructions);
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = user;
        tx.sign(wallet);

        const sig = await connection.sendTransaction(tx, [wallet]);
        await connection.confirmTransaction(sig, 'confirmed');

        return sig;
    } catch (err: any) {
        const errMsg = err?.message || err?.toString();

        if (errMsg.includes("Insufficient WSOL balance")) {
            console.error(errMsg);
            throw err;
        }
        if (errMsg.includes("No WSOL account found")) {
            console.error(errMsg);
            throw err;
        }
        if (errMsg.includes("insufficient funds") || errMsg.includes("Insufficient funds")) {
            throw new Error("Error: Insufficient SOL balance in your wallet.");
        }
        if (errMsg.includes("0x1") || errMsg.includes("custom program error: 0x1")) {
            throw new Error("Error: Insufficient token balance in your wallet.");
        }

        console.error("Unexpected error:", err);
        throw err;
    }
}

export async function removeLiquidityCore(
    poolKey: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    user: PublicKey,
    lpAmount: string,
    slippage: number
) {
    try {
        const baseTokenAccount = await ensureATA(baseMint, user);
        const quoteTokenAccount = await ensureATA(quoteMint, user);

        // LP token amount
        const inputLpRaw = new BN(Math.floor(parseFloat(lpAmount) * 1e9));

        const state = await pumpAmmSdk.liquiditySolanaState(poolKey, user, baseTokenAccount, quoteTokenAccount);

        // Calculate withdraw amounts
        const { base: baseOut, quote: quoteOut } = pumpAmmSdk.withdrawAutoCompleteBaseAndQuoteFromLpToken(
            state,
            inputLpRaw,
            slippage
        );

        console.log(`Removing LP: ${inputLpRaw.toString()}`);
        console.log(`Expect Base Out: ${baseOut.toString()}`);
        console.log(`Expect Quote Out: ${quoteOut.toString()}`);

        // Build instruction
        const instructions = await pumpAmmSdk.withdrawInstructions(state, inputLpRaw, slippage);
        const tx = new Transaction().add(...instructions);
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = user;
        tx.sign(wallet);

        const sig = await connection.sendTransaction(tx, [wallet]);
        await connection.confirmTransaction(sig, 'confirmed');

        return sig;
    } catch (err: any) {
        const errMsg = err?.message || err?.toString();

        if (errMsg.includes("insufficient funds")) {
            throw new Error("Error: Insufficient LP token balance.");
        }

        console.error("Unexpected error:", err);
        throw err;
    }
}

export async function swapCore(opts: SwapOptions) {
  try {
    const { poolKey, baseMint, quoteMint, user, amountInput, slippage, exactIn, direction } = opts;

    const baseTokenAccount = await ensureATA(baseMint, user);
    const quoteTokenAccount = await ensureATA(quoteMint, user);

    const baseDecimals = (await getFlexibleMintInfo(baseMint)).decimals;
    const quoteDecimals = (await getFlexibleMintInfo(quoteMint)).decimals;

    const state = await pumpAmmSdk.swapSolanaState(poolKey, user, baseTokenAccount, quoteTokenAccount);

    let amountRaw: BN;
    let instructions;

    if (direction === 'customToWsol') {
      if (exactIn) {
        amountRaw = new BN(Math.floor(parseFloat(amountInput) * 10 ** baseDecimals));
        instructions = await pumpAmmSdk.sellBaseInput(state, amountRaw, slippage);
        console.log(`Selling ${amountInput} Custom token → receive WSOL`);
      } else {
        amountRaw = new BN(Math.floor(parseFloat(amountInput) * 10 ** quoteDecimals));
        instructions = await pumpAmmSdk.sellQuoteInput(state, amountRaw, slippage);
        console.log(`Receiving exactly ${amountInput} WSOL (will sell Custom token)`);
      }
    } else if (direction === 'wsolToCustom') {
      if (exactIn) {
        // bán quote để lấy base
        amountRaw = new BN(Math.floor(parseFloat(amountInput) * 10 ** quoteDecimals));
        instructions = await pumpAmmSdk.buyQuoteInput(state, amountRaw, slippage);
        console.log(`Selling ${amountInput} WSOL → receive Custom token`);
      } else {
        // muốn nhận chính xác base
        amountRaw = new BN(Math.floor(parseFloat(amountInput) * 10 ** baseDecimals));
        instructions = await pumpAmmSdk.buyBaseInput(state, amountRaw, slippage);
        console.log(`Receiving exactly ${amountInput} Custom token (will sell WSOL)`);
      }
    } else {
      throw new Error(`❌ Invalid swap direction: ${direction}`);
    }

    if (!instructions || instructions.length === 0) {
      throw new Error('❌ No swap instructions generated.');
    }

    const tx = new Transaction().add(...instructions);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;
    tx.sign(wallet);

    const sig = await connection.sendTransaction(tx, [wallet]);
    await connection.confirmTransaction(sig, 'confirmed');
    return sig;
  } catch (err: any) {
    console.error('❌ Swap failed:', err.message || err);
    throw err;
  }
}