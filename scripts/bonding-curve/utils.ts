import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import fs from "fs";
import { getAccount, getMint } from "@solana/spl-token";
import readline from "readline";

export const CURVE_CONFIGURATION_SEED = "curve_configuration";
const POOL_SEED_PREFIX = "bonding_curve";
const SOL_VAULT_PREFIX = "liquidity_sol_vault";

export function getKeypairFromFile(filePath: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(filePath.toString(), "utf-8")))
  );
}

export async function getSolBalance(
  connection: Connection,
  address: PublicKey
): Promise<number> {
  const lamports = await connection.getBalance(address);
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Get token decimals from mint account
 */
export async function getTokenDecimals(
  connection: Connection,
  mint: PublicKey
): Promise<number> {
  const mintInfo = await getMint(connection, mint);
  return mintInfo.decimals;
}

/**
 * Get user or pool token balance in human-readable format
 */
export async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey,
  mint: PublicKey
): Promise<number> {
  try {
    const account = await getAccount(connection, tokenAccount);
    const decimals = await getTokenDecimals(connection, mint);
    return Number(account.amount) / Math.pow(10, decimals);
  } catch {
    return 0;
  }
}

export async function getBalances(
  connection: Connection,
  user: PublicKey,
  poolSolVault: PublicKey,
  poolTokenAccount: PublicKey,
  userTokenAccount: PublicKey,
  mint: PublicKey
) {
  return {
    solUser: await getSolBalance(connection, user),
    solPool: await getSolBalance(connection, poolSolVault),
    tokenUser: await getTokenBalance(connection, userTokenAccount, mint),
    tokenPool: await getTokenBalance(connection, poolTokenAccount, mint),
  };
}

export function printBalances(label: string, balances: any) {
  console.log(`\n=== ${label} ===`);
  console.log("User SOL:", balances.solUser.toFixed(6), "SOL");
  console.log("User Token:", balances.tokenUser.toLocaleString());
  console.log("Pool SOL:", balances.solPool.toFixed(6), "SOL");
  console.log("Pool Token:", balances.tokenPool.toLocaleString());
}

export function printDiff(before: any, after: any) {
  console.log("\n=== Balance Diff ===");
  console.log("Δ User SOL:", (after.solUser - before.solUser).toFixed(6), "SOL");
  console.log("Δ User Token:", (after.tokenUser - before.tokenUser).toLocaleString());
  console.log("Δ Pool SOL:", (after.solPool - before.solPool).toFixed(6), "SOL");
  console.log("Δ Pool Token:", (after.tokenPool - before.tokenPool).toLocaleString());
  console.log("====================");
}

export async function askAction(type: "buy" | "sell"): Promise<"quote" | "base"> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`\n=== ${type.toUpperCase()} MODE ===`);
    console.log("1. Quote Input  (enter token amount)");
    console.log("2. Base Input   (enter SOL amount)\n");

    rl.question("Choose 1 or 2: ", (answer) => {
      rl.close();
      if (answer.trim() === "1") resolve("quote");
      else if (answer.trim() === "2") resolve("base");
      else {
        console.log("❌ Invalid choice, defaulting to Quote Input");
        resolve("quote");
      }
    });
  });
}
