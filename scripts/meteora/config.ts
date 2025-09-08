import { Connection, Keypair, PublicKey, Cluster } from "@solana/web3.js";
import BN from 'bn.js';
import fs from 'fs';
import os from 'os';
import readline from "readline";
import DLMM, { ActivationType, StrategyType } from "@meteora-ag/dlmm";
import {
  NATIVE_MINT
} from '@solana/spl-token';
import path from "path";
import { Decimal } from "decimal.js";

export const RPC_ENDPOINT = "https://api.devnet.solana.com";
export const WSOL_MINT = NATIVE_MINT;
export const CUSTOM_TOKEN_MINT = new PublicKey("FUQdkvD5M76SkqMXwXtpzzRTiU87HjTkXuPRgghNNfmt"); 

if (CUSTOM_TOKEN_MINT.toString() === "YOUR_CUSTOM_TOKEN_MINT_ADDRESS_HERE") {
  throw new Error("Change CUSTOM_TOKEN_MINT with real mint address!");
}

export const owner = loadKeypair(`${os.homedir()}/.config/solana/id.json`);
export const TOTAL_RANGE_INTERVAL = 10;
export const binStep = new BN(25);
export const feeBps = new BN(30);

export const activationType = ActivationType.Timestamp;
export const activationPoint = new BN(Math.floor(Date.now() / 1000) + 3600);
export const hasAlphaVault = false;
export const creatorPoolOnOffControl = false;

const POSITION_KEYPAIR_PATH = path.join(os.homedir(), ".config/solana/position.json");

export function loadOrCreatePositionKeypair(): Keypair {
  if (fs.existsSync(POSITION_KEYPAIR_PATH)) {
    const secret = JSON.parse(fs.readFileSync(POSITION_KEYPAIR_PATH, "utf-8"));
    return Keypair.fromSecretKey(new Uint8Array(secret));
  } else {
    const kp = Keypair.generate();
    fs.writeFileSync(POSITION_KEYPAIR_PATH, JSON.stringify(Array.from(kp.secretKey)));
    console.log("Created new position keypair:", kp.publicKey.toString());
    return kp;
  }
}

export const positionKeypair = loadOrCreatePositionKeypair();

export async function getStrategy(dlmmPool: DLMM): Promise<{ strategyType: StrategyType; minBinId: number; maxBinId: number }> {
  const activeBin = await dlmmPool.getActiveBin();
  const activeBinId = activeBin.binId;

  const minBinId = activeBinId - 10;
  const maxBinId = activeBinId + 10;

  return {
    strategyType: StrategyType.Spot,
    minBinId,
    maxBinId,
  };
}
export async function getConnection(): Promise<Connection> {
  return new Connection(RPC_ENDPOINT, "confirmed");
}

export async function getPoolAddress(connection: Connection): Promise<PublicKey> {
  try {
    const poolAddress = await DLMM.getCustomizablePermissionlessLbPairIfExists(
      connection,
      WSOL_MINT,
      CUSTOM_TOKEN_MINT,
      { cluster: "devnet" as Cluster }
    );
    if (!poolAddress) {
      throw new Error("Pool not exists! Please run create-pool.ts first.");
    }
    return poolAddress;
  } catch (error) {
    console.error("Error getting pool address:", error);
    throw error;
  }
}

export const connection = new Connection(RPC_ENDPOINT, "confirmed");
export const INITIAL_PRICE = new Decimal(2);

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export async function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve =>
    rl.question(query, ans => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

export function parseUserAmount(raw: string, decimals: number): BN {
  const dec = new Decimal(raw);
  const scaled = dec.mul(new Decimal(10).pow(decimals));
  return new BN(scaled.toFixed(0)); 
}


export function formatAmount(raw: BN, decimals: number, precision = 6): string {
  const dec = new Decimal(raw.toString()).div(new Decimal(10).pow(decimals));
  return dec.toFixed(precision);
}