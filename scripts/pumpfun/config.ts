import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getMint  } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import fs from 'fs';
import os from 'os';
import readline from 'readline';
export const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
export const wallet = getKeypairFromFile(`${os.homedir()}/.config/solana/id.json`);

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
export function getKeypairFromFile(filePath: string): Keypair {
    return Keypair.fromSecretKey(
        Uint8Array.from(
            JSON.parse(
                fs.readFileSync(filePath.toString(), "utf-8")
            )
        )
    );
}

export async function getMintProgramId(mint: PublicKey): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error("Mint not found");
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  return TOKEN_PROGRAM_ID;
}

export async function getFlexibleMintInfo(mint: PublicKey) {
  const programId = await getMintProgramId(mint);
  return await getMint(connection, mint, undefined, programId);
}

export async function ensureATA(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
  const programId = await getMintProgramId(mint);
  const ata = await getAssociatedTokenAddress(mint, owner, false, programId);
  const accountInfo = await connection.getAccountInfo(ata);

  if (!accountInfo) {
    const instruction = createAssociatedTokenAccountInstruction(
      owner,
      ata,
      owner,
      mint,
      programId
    );

    const transaction = new Transaction().add(instruction);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = owner;

    transaction.sign(wallet);
    const signature = await connection.sendTransaction(transaction, [wallet]);
    await connection.confirmTransaction(signature, 'confirmed');
    console.log(`Created ATA for mint ${mint.toBase58()}: ${ata.toBase58()}`);
  }

  return ata;   
}

export type UserSwapMode = 'wsolToCustom' | 'customToWsol';
export interface SwapOptions {
  poolKey: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  user: PublicKey;
  amountInput: string;
  slippage: number;
  exactIn: boolean; 
  direction: UserSwapMode; 
}

