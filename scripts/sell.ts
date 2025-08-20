import {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    PublicKey,
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as bs58 from "bs58";
import dotenv from "dotenv";
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { BondingCurve } from "../target/types/bonding_curve";
import { getPDAs } from "./utils";

dotenv.config();

const BONDING_CURVE_IDL = require("../target/idl/bonding_curve.json");
//const mintLatest = new PublicKey("91c2ENi1DrFLJBN6vwA2G3vFopXsrF9s8nfMpyF5jgCz");
const mintLatest2 = new PublicKey("6spgRQUqZCW5NmZaV4Ni99tgmYWHVzynb4JdtgZqBKbe");
async function main() {
    // Setup connection and provider
    const connection = new Connection("https://api.devnet.solana.com", {
        commitment: "confirmed",
    });

    const signer = Keypair.fromSecretKey(bs58.decode(process.env.SIGNER_PRIVATE_KEY!));
    console.log("Signer:", signer.publicKey.toBase58());

    const wallet = new anchor.Wallet(signer);
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);

    const program = new Program(BONDING_CURVE_IDL, provider) as Program<BondingCurve>;
    console.log("Program:", program.programId.toBase58());

    console.log("Token mint:", mintLatest2.toBase58());

    // Use env or fallback to 100 tokens
    const sellToken = "1";
    const amount = new BN(parseFloat(sellToken) * 1e6); // 6 decimals
    console.log(`Selling ${sellToken} tokens (${amount.toString()})`);

    try {
        // Get all PDAs
        const { curveConfig, bondingCurve, poolSolVault, poolTokenAccount, userTokenAccount, poolSolVaultBump } = await getPDAs(
            signer.publicKey,
            mintLatest2,
            program.programId
        );

        console.log("Curve Config:", curveConfig.toBase58());
        console.log("Bonding Curve:", bondingCurve.toBase58());
        console.log("Pool SOL Vault:", poolSolVault.toBase58());
        console.log("Pool Token Account:", poolTokenAccount.toBase58());
        console.log("User Token Account:", userTokenAccount.toBase58());

        // Check balances before
        console.log("\n=== BALANCES BEFORE SELL ===");
        try {
            const userBalanceBefore = await connection.getTokenAccountBalance(userTokenAccount);
            console.log("User Token Balance Before:", userBalanceBefore.value.uiAmount || 0);
        } catch (error) {
            console.log("User Token Balance Before: 0 (account doesn't exist yet)");
        }

        try {
            const poolBalanceBefore = await connection.getTokenAccountBalance(poolTokenAccount);
            console.log("Pool Token Balance Before:", poolBalanceBefore.value.uiAmount);
        } catch (error) {
            console.log("Pool Token Balance Before: Account not found");
        }

        const userSolBalanceBefore = await connection.getBalance(signer.publicKey);
        console.log("User SOL Balance Before:", userSolBalanceBefore / 1e9, "SOL");

        const poolSolBalanceBefore = await connection.getBalance(poolSolVault);
        console.log("Pool SOL Balance Before:", poolSolBalanceBefore / 1e9, "SOL");

        // Create and send sell transaction
        console.log("\n=== EXECUTING SELL TRANSACTION ===");
        const tx = new Transaction().add(
            await program.methods
                .sell(amount, poolSolVaultBump)
                .accountsStrict({
                    bondingCurveConfiguration: curveConfig,
                    bondingCurveAccount: bondingCurve,
                    tokenMint: mintLatest2,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    poolSolVault: poolSolVault,
                    poolTokenAccount: poolTokenAccount,
                    userTokenAccount: userTokenAccount,
                    user: signer.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .instruction()
        );

        tx.feePayer = signer.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        // Simulate transaction first
        console.log("Simulating transaction...");
        const simulation = await connection.simulateTransaction(tx);

        if (simulation.value.err) {
            console.error("❌ Simulation failed:", simulation.value.err);
            console.error("Logs:", simulation.value.logs);
            throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }

        console.log("✅ Simulation successful!");
        console.log("Units consumed:", simulation.value.unitsConsumed);

        // Send transaction
        const signature = await sendAndConfirmTransaction(
            connection,
            tx,
            [signer],
            {
                skipPreflight: false,
                commitment: "confirmed"
            }
        );

        console.log("✅ Sell transaction successful!");
        console.log("Transaction signature:", signature);
        console.log("View on Solscan:", `https://solscan.io/tx/${signature}?cluster=devnet`);

        // Check balances after
        console.log("\n=== BALANCES AFTER SELL ===");
        const userBalanceAfter = await connection.getTokenAccountBalance(userTokenAccount);
        console.log("User Token Balance After:", userBalanceAfter.value.uiAmount);

        const poolBalanceAfter = await connection.getTokenAccountBalance(poolTokenAccount);
        console.log("Pool Token Balance After:", poolBalanceAfter.value.uiAmount);

        const userSolBalanceAfter = await connection.getBalance(signer.publicKey);
        console.log("User SOL Balance After:", userSolBalanceAfter / 1e9, "SOL");

        const poolSolBalanceAfter = await connection.getBalance(poolSolVault);
        console.log("Pool SOL Balance After:", poolSolBalanceAfter / 1e9, "SOL");

        // Calculate changes
        console.log("\n=== TRANSACTION SUMMARY ===");
        console.log("SOL received:", (userSolBalanceAfter - userSolBalanceBefore) / 1e9, "SOL");
        console.log("Tokens sold:", (userBalanceAfter.value.uiAmount || 0));
        console.log("Pool SOL decrease:", (poolSolBalanceBefore - poolSolBalanceAfter) / 1e9, "SOL");

    } catch (error) {
        console.error("❌ Sell transaction failed:", error);

        if (error.logs) {
            console.error("📋 Transaction logs:", error.logs);
        }

        throw error;
    }
}

// Run the script
if (require.main === module) {
    main().catch((error) => {
        console.error("Script failed:", error);
        process.exit(1);
    });
}