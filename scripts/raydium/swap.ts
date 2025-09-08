import { Percent, CurveCalculator, FeeOn, TxVersion } from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import { initSdk, connection, askQuestion, owner, txVersion, formatAmount } from './config';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createSyncNativeInstruction,
} from '@solana/spl-token';

async function swap() {
    try {
        const poolIdInput = await askQuestion("Pool ID: ");
        const amountInput = await askQuestion("Input amount: ");
        const baseInInput = await askQuestion("Choose input token (true = WSOL, false = custom token): ");
        const slippageInput = await askQuestion("Slippage (%): ");

        const slippage = Number(slippageInput);
        const baseIn = baseInInput.toLowerCase() === "true";

        console.log(`\n=== User Input ===`);
        console.log(`Pool ID: ${poolIdInput}`);
        console.log(`Input Amount: ${amountInput}`);
        console.log(`Base In: ${baseIn ? "WSOL" : "Custom Token"}`);
        console.log(`Slippage: ${slippageInput}%`);
        console.log("==================\n");

        const raydium = await initSdk();
        const poolId = new PublicKey(poolIdInput);
        const data = await raydium.cpmm.getPoolInfoFromRpc(poolId.toString());

        if (!data || data.poolInfo.type !== 'Standard') {
            throw new Error('CPMM pool not found.');
        }

        const poolInfo = data.poolInfo;
        const poolKeys = data.poolKeys;
        const rpcData = data.rpcData;

        if (!poolKeys?.authority) throw new Error('Pool authority is undefined.');
        if (rpcData.baseReserve.isZero() || rpcData.quoteReserve.isZero()) {
            throw new Error('Pool has no liquidity.');
        }

        const inputAmount = new BN(Math.floor(parseFloat(amountInput) * 1e9));
        const inputDecimals = baseIn ? poolInfo.mintA.decimals : poolInfo.mintB.decimals;
        const outputDecimals = baseIn ? poolInfo.mintB.decimals : poolInfo.mintA.decimals;

        if ((baseIn && poolInfo.mintA.symbol === 'WSOL') || (!baseIn && poolInfo.mintB.symbol === 'WSOL')) {
            const wsolMint = new PublicKey(poolInfo.mintA.symbol === 'WSOL' ? poolInfo.mintA.address : poolInfo.mintB.address);
            const wsolATA = await getAssociatedTokenAddress(wsolMint, owner.publicKey);

            const ataInfo = await connection.getAccountInfo(wsolATA);
            const transaction = new Transaction();

            if (!ataInfo) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        owner.publicKey,
                        wsolATA,
                        owner.publicKey,
                        wsolMint
                    )
                );
            }

            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: owner.publicKey,
                    toPubkey: wsolATA,
                    lamports: inputAmount.toNumber(),
                }),
                createSyncNativeInstruction(wsolATA)
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = owner.publicKey;

            const txId = await connection.sendTransaction(transaction, [owner]);
            await connection.confirmTransaction(txId, 'confirmed');
            console.log("Wrapped SOL into WSOL:", txId);
        }

        // === Estimate swap result ===
        const swapResult = CurveCalculator.swapBaseInput(
            inputAmount,
            baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
            baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
            rpcData.configInfo!.tradeFeeRate,
            rpcData.configInfo!.creatorFeeRate,
            rpcData.configInfo!.protocolFeeRate,
            rpcData.configInfo!.fundFeeRate,
            rpcData.feeOn === FeeOn.BothToken || rpcData.feeOn === FeeOn.OnlyTokenB
        );

        console.log("\n=== Swap Simulation ===");
        console.log(`Input: ${formatAmount(inputAmount, inputDecimals)} (${baseIn ? poolInfo.mintA.address : poolInfo.mintB.address})`);
        console.log(`Output: ${formatAmount(swapResult.outputAmount, outputDecimals)} (${baseIn ? poolInfo.mintB.address : poolInfo.mintA.address})`);
        console.log(`Fee: ${formatAmount(swapResult.tradeFee, outputDecimals)}`);
        console.log("=======================\n");

        // === Do actual swap ===
        console.log("Sending swap transaction...");
        const { execute } = await raydium.cpmm.swap({
            poolInfo,
            poolKeys,
            inputAmount,
            swapResult,
            slippage,
            baseIn,
            txVersion: TxVersion.V0,
        });

        const { txId } = await execute({ sendAndConfirm: true });
        console.log(`Swap successful! Tx: ${txId}`);
    } catch (error) {
        console.error("Error while swapping:", error);
        if ((error as any).logs) console.error("Logs:", (error as any).logs);
        process.exit(1);
    }
}

swap();
