import {
    Connection,
    Keypair,
    PublicKey,
} from "@solana/web3.js";
import * as bs58 from "bs58";
import dotenv from "dotenv";
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { BondingCurve } from "../target/types/bonding_curve";
import { getPDAs } from "./utils";

dotenv.config();

const BONDING_CURVE_IDL = require("../target/idl/bonding_curve.json");

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

    // Token mint address from environment
    const mintAddress = process.env.TOKEN_MINT_ADDRESS;
    if (!mintAddress) {
        throw new Error("TOKEN_MINT_ADDRESS environment variable is required");
    }
    const mint = new PublicKey(mintAddress);
    console.log("Token mint:", mint.toBase58());

    try {
        // Get PDAs
        const { curveConfig, bondingCurve } = await getPDAs(
            signer.publicKey,
            mint,
            program.programId
        );

        // Fetch the bonding curve account
        const bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurve);
        const curveConfigAccount = await program.account.curveConfiguration.fetch(curveConfig);

        console.log("\n=== BONDING CURVE STATE ===");
        console.log("Total Supply:", bondingCurveAccount.totalSupply.toString());
        console.log("Reserve Balance:", bondingCurveAccount.reserveBalance.toString(), "lamports");
        console.log("Reserve Balance (SOL):", (bondingCurveAccount.reserveBalance.toNumber() / 1e9).toFixed(6));
        console.log("Reserve Token:", bondingCurveAccount.reserveToken.toString());
        console.log("Reserve Ratio:", curveConfigAccount.reserveRatio, "basis points");
        console.log("Bonding Curve Type:", curveConfigAccount.bondingCurveType);

        // Calculate various prices using JavaScript (simulating the Rust calculations)
        console.log("\n=== PRICE CALCULATIONS ===");
        
        const totalSupply = bondingCurveAccount.totalSupply.toNumber();
        const reserveRatio = curveConfigAccount.reserveRatio;
        const bondingCurveType = curveConfigAccount.bondingCurveType;

        // Current price calculation
        let currentPrice: number;
        if (bondingCurveType === 0) { // Linear
            // Linear: Price = (2 * supply) / (reserve_ratio / 10000)
            currentPrice = (2 * totalSupply) / (reserveRatio / 10000);
        } else { // Quadratic
            // Quadratic: Price = k * supply where k = reserve_ratio / 10000
            currentPrice = (reserveRatio / 10000) * totalSupply;
        }

        console.log("Current Price:", (currentPrice / 1e9).toFixed(9), "SOL per token");
        console.log("Current Price:", currentPrice.toFixed(0), "lamports per token");

        // Next token price
        let nextTokenPrice: number;
        if (bondingCurveType === 0) { // Linear
            const slope = 2 / (reserveRatio / 10000);
            nextTokenPrice = currentPrice + slope;
        } else { // Quadratic
            nextTokenPrice = (reserveRatio / 10000) * (totalSupply + 1);
        }

        console.log("Next Token Price:", (nextTokenPrice / 1e9).toFixed(9), "SOL per token");
        console.log("Next Token Price:", nextTokenPrice.toFixed(0), "lamports per token");

        // Market cap
        const marketCap = currentPrice * totalSupply;
        console.log("Market Cap:", (marketCap / 1e9).toFixed(6), "SOL");
        console.log("Market Cap:", marketCap.toFixed(0), "lamports");

        // Calculate cost for buying different amounts
        console.log("\n=== BUY COST ESTIMATES ===");
        const amounts = [1, 10, 100, 1000];
        
        for (const amount of amounts) {
            let cost: number;
            if (bondingCurveType === 0) { // Linear
                // Linear cost: (new_supply² - old_supply²) / (2 * reserve_ratio / 10000)
                const newSupply = totalSupply + amount;
                cost = ((newSupply * newSupply) - (totalSupply * totalSupply)) / (2 * (reserveRatio / 10000));
            } else { // Quadratic
                // Quadratic cost: k * supply * amount + k * amount² / 2
                const k = reserveRatio / 10000;
                cost = k * totalSupply * amount + k * amount * amount / 2;
            }

            const averagePrice = cost / amount;
            console.log(`Buy ${amount} tokens:`);
            console.log(`  Total Cost: ${(cost / 1e9).toFixed(6)} SOL`);
            console.log(`  Average Price: ${(averagePrice / 1e9).toFixed(9)} SOL per token`);
            console.log(`  Price Impact: ${(((averagePrice - currentPrice) / currentPrice) * 100).toFixed(2)}%`);
        }

        // Price at different supply levels
        console.log("\n=== PRICE AT DIFFERENT SUPPLY LEVELS ===");
        const supplyLevels = [totalSupply + 1000, totalSupply + 10000, totalSupply + 100000];
        
        for (const supply of supplyLevels) {
            let priceAtSupply: number;
            if (bondingCurveType === 0) { // Linear
                priceAtSupply = (2 * supply) / (reserveRatio / 10000);
            } else { // Quadratic
                priceAtSupply = (reserveRatio / 10000) * supply;
            }

            console.log(`At supply ${supply.toLocaleString()}:`);
            console.log(`  Price: ${(priceAtSupply / 1e9).toFixed(9)} SOL per token`);
            console.log(`  Price increase: ${(((priceAtSupply - currentPrice) / currentPrice) * 100).toFixed(2)}%`);
        }

    } catch (error) {
        console.error("❌ Failed to calculate prices:", error);
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

export default main; 