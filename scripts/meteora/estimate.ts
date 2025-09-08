import { Cluster, PublicKey } from "@solana/web3.js";
import DLMM from "@meteora-ag/dlmm";
import BN from "bn.js";
import { askQuestion, formatAmount, getConnection, getPoolAddress } from "./config";


async function estimate() {
    const connection = await getConnection();
    const poolAddress = await getPoolAddress(connection);
    const dlmmPool = await DLMM.create(connection, poolAddress, {
        cluster: "devnet" as Cluster,
    });
    const tokenX = dlmmPool.tokenX;
    const tokenY = dlmmPool.tokenY;

    console.log("Pool:", poolAddress.toString());

    const swapForYStr = await askQuestion(
        `Swap direction? Enter true to swap ${tokenX.mint.address.toBase58()} → ${tokenY.mint.address.toBase58()}, false to swap ${tokenY.mint.address.toBase58()} → ${tokenX.mint.address.toBase58()}: `
    );
    const swapForY = swapForYStr.toLowerCase() === "true";

    const useExactInInput = await askQuestion("Use ExactIn? (true/false): ");
    const useExactIn = useExactInInput.toLowerCase() === "true";

    // Ask slippage
    const rawSlippageStr = await askQuestion("Enter slippage tolerance (%): ");
    const rawSlippage = parseFloat(rawSlippageStr);
    const slippage = Math.floor(rawSlippage * 100);

    // Get decimals
    const tokenXDecimals = dlmmPool.tokenX.mint.decimals;
    const tokenYDecimals = dlmmPool.tokenY.mint.decimals;

    // Ask amounts
    let inAmount: BN;
    let outAmount: BN;

    if (useExactIn) {
        const rawIn = await askQuestion("Enter input amount: ");
        const dec = swapForY ? tokenXDecimals : tokenYDecimals;
        inAmount = new BN(Math.floor(parseFloat(rawIn) * 10 ** dec));
        outAmount = new BN(0);
    } else {
        const rawOut = await askQuestion("Enter desired output amount: ");
        const dec = swapForY ? tokenYDecimals : tokenXDecimals;
        outAmount = new BN(Math.floor(parseFloat(rawOut) * 10 ** dec));
        inAmount = new BN(0);
    }

    const binArrays = await dlmmPool.getBinArrayForSwap(swapForY);

    if (useExactIn) {
        const quote = await dlmmPool.swapQuote(
            inAmount,
            swapForY,
            new BN(slippage), 
            binArrays,
            true 
        );

        console.log("=== SwapQuote (ExactIn) ===");
        console.log("Input amount:", formatAmount(inAmount, swapForY ? tokenXDecimals : tokenYDecimals));
        console.log("Estimated output:", formatAmount(quote.outAmount, swapForY ? tokenYDecimals : tokenXDecimals));
        console.log("Price impact:", quote.priceImpact.toString(), "%");
        console.log("Min output (after slippage):", formatAmount(quote.minOutAmount, swapForY ? tokenYDecimals : tokenXDecimals));
    } else {
        const quoteOut = await dlmmPool.swapQuoteExactOut(
            outAmount,
            swapForY,
            new BN(slippage),
            binArrays
        );

        console.log("=== SwapQuoteExactOut (ExactOut) ===");
        console.log("Desired output:", formatAmount(outAmount, swapForY ? tokenYDecimals : tokenXDecimals));
        console.log("Required input:", formatAmount(quoteOut.inAmount, swapForY ? tokenXDecimals : tokenYDecimals));
        console.log("Price impact:", quoteOut.priceImpact.toString(), "%");
        console.log("Max input (after slippage):", formatAmount(quoteOut.maxInAmount, swapForY ? tokenXDecimals : tokenYDecimals));
    }
}

estimate().catch(console.error);        