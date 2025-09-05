import {
    Cluster, Transaction, PublicKey, SystemProgram,
    TransactionInstruction, Connection
} from "@solana/web3.js";
import BN from "bn.js";
import DLMM, {
    autoFillXByStrategy,
    autoFillYByStrategy
} from "@meteora-ag/dlmm";

import {
    getConnection, getPoolAddress, positionKeypair,
    owner, getStrategy, WSOL_MINT, askQuestion,
    TOTAL_RANGE_INTERVAL,
} from "./config";

import {
    TOKEN_PROGRAM_ID, getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction, getAccount,
    createSyncNativeInstruction, ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { formatAmount } from "../raydium/config";

/**
 * Get the token program (Token / Token-2022) for a given mint.
 */
async function getTokenProgram(connection: Connection, mint: PublicKey): Promise<PublicKey> {
    const info = await connection.getAccountInfo(mint);
    if (!info) throw new Error("Mint not found");
    return info.owner;
}

async function addLiquidity() {
    const connection = await getConnection();
    const poolAddress = await getPoolAddress(connection);
    const dlmmPool = await DLMM.create(connection, poolAddress, { cluster: "devnet" as Cluster });

    console.log("User:", owner.publicKey.toString());

    // Ask user which token they will provide
    const isWSOLInput = (await askQuestion("Type true if you provide WSOL, false if custom token: "))
        .toLowerCase() === "true";

    const tokenXMint = dlmmPool.lbPair.tokenXMint;
    const tokenYMint = dlmmPool.lbPair.tokenYMint;
    const tokenXDecimals = dlmmPool.tokenX.mint.decimals;
    const tokenYDecimals = dlmmPool.tokenY.mint.decimals;

    const isXMintWSOL = tokenXMint.equals(WSOL_MINT);
    const isYMintWSOL = tokenYMint.equals(WSOL_MINT);

    // Decide which side is input
    let inputSide: "X" | "Y";
    if (isWSOLInput) {
        inputSide = isXMintWSOL ? "X" : "Y";
    } else {
        inputSide = isXMintWSOL ? "Y" : "X";
    }

    // Ask amount in human-readable format
    const rawAmountStr = await askQuestion("Enter token amount (e.g. 0.1): ");
    const rawAmount = parseFloat(rawAmountStr);
    const decimals = inputSide === "X" ? tokenXDecimals : tokenYDecimals;
    const inputAmount = new BN(Math.floor(rawAmount * 10 ** decimals));

    const rawSlippageStr = await askQuestion("Enter slippage tolerance (%): ");
    const rawSlippage = parseFloat(rawSlippageStr);

    const slippage = rawSlippage / 100;

    // Strategy and bins
    const activeBin = await dlmmPool.getActiveBin();
    const strategy = await getStrategy(dlmmPool);
    const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
    const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

    // Calculate amounts for both sides
    let totalXAmount: BN;
    let totalYAmount: BN;
    if (inputSide === "X") {
        totalXAmount = inputAmount;
        totalYAmount = autoFillYByStrategy(
            activeBin.binId,
            dlmmPool.lbPair.binStep,
            inputAmount,
            activeBin.xAmount,
            activeBin.yAmount,
            minBinId,
            maxBinId,
            strategy.strategyType
        );
    } else {
        totalYAmount = inputAmount;
        totalXAmount = autoFillXByStrategy(
            activeBin.binId,
            dlmmPool.lbPair.binStep,
            inputAmount,
            activeBin.xAmount,
            activeBin.yAmount,
            minBinId,
            maxBinId,
            strategy.strategyType
        );
    }

    console.log(`Total X amount: ${formatAmount(totalXAmount, tokenXDecimals)} ${tokenXMint.toString()}`);
    console.log(`Total Y amount: ${formatAmount(totalYAmount, tokenYDecimals)} ${tokenYMint.toString()}`);

    // Prepare ATA addresses
    const tokenXProgram = await getTokenProgram(connection, tokenXMint);
    const tokenYProgram = await getTokenProgram(connection, tokenYMint);

    const ataX = await getAssociatedTokenAddress(
        tokenXMint, owner.publicKey, false, tokenXProgram, ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const ataY = await getAssociatedTokenAddress(
        tokenYMint, owner.publicKey, false, tokenYProgram, ASSOCIATED_TOKEN_PROGRAM_ID
    );

    console.log("ATA X:", ataX.toString());
    console.log("ATA Y:", ataY.toString());

    const createIxs: TransactionInstruction[] = [];
    const wrapIxs: TransactionInstruction[] = [];
    let balanceX = new BN(0);
    let balanceY = new BN(0);

    // Load or create ATA X
    try {
        const accountX = await getAccount(connection, ataX, "confirmed", tokenXProgram as any);
        balanceX = new BN(accountX.amount.toString());
    } catch {
        createIxs.push(
            createAssociatedTokenAccountInstruction(
                owner.publicKey, ataX, owner.publicKey, tokenXMint,
                tokenXProgram, ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );
    }

    // Load or create ATA Y
    try {
        const accountY = await getAccount(connection, ataY, "confirmed", tokenYProgram as any);
        balanceY = new BN(accountY.amount.toString());
    } catch {
        createIxs.push(
            createAssociatedTokenAccountInstruction(
                owner.publicKey, ataY, owner.publicKey, tokenYMint,
                tokenYProgram, ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );
    }

    // Handle WSOL wrapping if needed
    if (isXMintWSOL) {
        const need = totalXAmount.sub(balanceX);
        if (need.gt(new BN(0))) {
            wrapIxs.push(
                SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: ataX, lamports: need.toNumber() }),
                createSyncNativeInstruction(ataX, TOKEN_PROGRAM_ID)
            );
        }
    }
    if (isYMintWSOL) {
        const need = totalYAmount.sub(balanceY);
        if (need.gt(new BN(0))) {
            wrapIxs.push(
                SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: ataY, lamports: need.toNumber() }),
                createSyncNativeInstruction(ataY, TOKEN_PROGRAM_ID)
            );
        }
    }

    // Non-WSOL balance checks
    if (!isXMintWSOL && balanceX.lt(totalXAmount)) throw new Error("Not enough X token balance");
    if (!isYMintWSOL && balanceY.lt(totalYAmount)) throw new Error("Not enough Y token balance");

    console.log("Using strategy:", strategy);

    // Check if position already exists
    let positionExists = false;
    try {
        const pos = await dlmmPool.getPosition(positionKeypair.publicKey);
        if (pos) positionExists = true;
    } catch { }

    console.log(positionExists ? "Adding to existing position" : "Creating new position");

    try {
        // Build DLMM instructions
        const txIxns = positionExists
            ? await dlmmPool.addLiquidityByStrategy({
                positionPubKey: positionKeypair.publicKey,
                totalXAmount,
                totalYAmount,
                strategy,
                user: owner.publicKey,
                slippage
            })
            : await dlmmPool.initializePositionAndAddLiquidityByStrategy({
                positionPubKey: positionKeypair.publicKey,
                totalXAmount,
                totalYAmount,
                strategy,
                user: owner.publicKey,
                slippage
            });

        // Combine all instructions
        const combinedTx = new Transaction();
        if (createIxs.length) combinedTx.add(...createIxs);
        if (wrapIxs.length) combinedTx.add(...wrapIxs);
        if ((txIxns as any).instructions?.length) combinedTx.add(...(txIxns as any).instructions);

        combinedTx.feePayer = owner.publicKey;
        combinedTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        combinedTx.sign(owner as any);
        const txid = await connection.sendRawTransaction(combinedTx.serialize());
        await connection.confirmTransaction(txid);

        console.log("Liquidity added successfully. Tx:", txid);
    } catch (err) {
        console.error("Add liquidity failed:", err);
        throw err;
    }
}

addLiquidity().catch(console.error);
