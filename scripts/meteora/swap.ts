import { Cluster, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import DLMM from "@meteora-ag/dlmm";
import BN from "bn.js";
import chalk from "chalk";
import {
    askQuestion,
    formatAmount,
    getConnection,
    getPoolAddress,
    owner,
} from "./config";

function logSection(title: string) {
    console.log(chalk.blue.bold(`\n=== ${title} ===`));
}

async function swap() {
    const connection = await getConnection();
    const poolAddress = await getPoolAddress(connection);
    const dlmmPool = await DLMM.create(connection, poolAddress, {
        cluster: "devnet" as Cluster,
    });

    const tokenX = dlmmPool.tokenX;
    const tokenY = dlmmPool.tokenY;

    console.log(chalk.green("Pool:"), chalk.yellow(poolAddress.toBase58()));

    const lbPair = dlmmPool.pubkey;
    const swapForYStr = await askQuestion(
        `Swap direction?\n  true  = ${tokenX.mint.address.toBase58()} → ${tokenY.mint.address.toBase58()}\n  false = ${tokenY.mint.address.toBase58()} → ${tokenX.mint.address.toBase58()}\nYour choice (true/false): `
    );
    const swapForY = swapForYStr.toLowerCase() === "true";

    const useExactInInput = await askQuestion("Use ExactIn? (true/false): ");
    const useExactIn = useExactInInput.toLowerCase() === "true";

    const rawSlippageStr = await askQuestion("Enter slippage tolerance (%): ");
    const rawSlippage = parseFloat(rawSlippageStr);
    const slippage = new BN(Math.floor(rawSlippage * 100));

    const tokenXDecimals = dlmmPool.tokenX.mint.decimals;
    const tokenYDecimals = dlmmPool.tokenY.mint.decimals;

    let inAmount: BN;
    let outAmount: BN;

    if (useExactIn) {
        const rawIn = await askQuestion("Enter input amount (human-readable): ");
        const dec = swapForY ? tokenXDecimals : tokenYDecimals;
        inAmount = new BN(Math.floor(parseFloat(rawIn) * 10 ** dec));
        outAmount = new BN(0);
    } else {
        const rawOut = await askQuestion("Enter desired output amount (human-readable): ");
        const dec = swapForY ? tokenYDecimals : tokenXDecimals;
        outAmount = new BN(Math.floor(parseFloat(rawOut) * 10 ** dec));
        inAmount = new BN(0);
    }

    const binArrays = await dlmmPool.getBinArrayForSwap(swapForY);

    let tx: Transaction;

    logSection("Swap Settings");

    const fromToken = swapForY ? tokenX : tokenY;
    const toToken = swapForY ? tokenY : tokenX;

    console.log("Direction:");
    console.log("  From:", chalk.cyan(` ${fromToken.mint.address.toBase58()}`));
    console.log("  To:  ", chalk.cyan(` ${toToken.mint.address.toBase58()}`));
    console.log("Mode:", useExactIn ? "Exact In" : "Exact Out");
    console.log("Slippage:", chalk.magenta(`${rawSlippage}%`));

    if (useExactIn) {
        const quote = await dlmmPool.swapQuote(
            inAmount,
            swapForY,
            slippage,
            binArrays,
            true
        );

        console.log("Input:", chalk.cyan(`${formatAmount(inAmount, fromToken.mint.decimals)} ${fromToken.mint.address.toBase58() || ""}`));
        console.log("Estimated Output:", chalk.green(`${formatAmount(quote.outAmount, toToken.mint.decimals)} ${toToken.mint.address.toBase58() || ""}`));
        console.log("Min Output:", chalk.red(`${formatAmount(quote.minOutAmount, toToken.mint.decimals)} ${toToken.mint.address.toBase58() || ""}`));

        tx = await dlmmPool.swap({
            inToken: fromToken.mint.address,
            outToken: toToken.mint.address,
            inAmount,
            minOutAmount: quote.minOutAmount,
            lbPair,
            user: owner.publicKey,
            binArraysPubkey: quote.binArraysPubkey,
        });
    } else {
        const quoteOut = await dlmmPool.swapQuoteExactOut(
            outAmount,
            swapForY,
            slippage,
            binArrays
        );

        console.log("Desired Output:", chalk.cyan(`${formatAmount(outAmount, toToken.mint.decimals)} ${toToken.mint.address || ""}`));
        console.log("Required Input:", chalk.green(`${formatAmount(quoteOut.inAmount, fromToken.mint.decimals)} ${fromToken.mint.address || ""}`));
        console.log("Max Input:", chalk.red(`${formatAmount(quoteOut.maxInAmount, fromToken.mint.decimals)} ${fromToken.mint.address || ""}`));

        tx = await dlmmPool.swap({
            inToken: fromToken.mint.address,
            outToken: toToken.mint.address,
            inAmount: quoteOut.inAmount,
            minOutAmount: outAmount,
            lbPair,
            user: owner.publicKey,
            binArraysPubkey: quoteOut.binArraysPubkey,
        });
    }

    logSection("Transaction");
    tx.feePayer = owner.publicKey;
    const sig = await sendAndConfirmTransaction(connection, tx, [owner]);
    console.log("Signature:", chalk.yellow(sig));
    console.log(chalk.green.bold("\n✅ Swap completed successfully!\n"));
}

swap().catch((err) => {
    console.error(chalk.red("Swap failed:"), err);
});
