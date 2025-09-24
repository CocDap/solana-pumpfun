import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Connection } from "@solana/web3.js";
import os from "os";
import { getKeypairFromFile, getBalances, printBalances, printDiff, askAction } from "./utils";
import idl from "../../target/idl/bonding_curve.json";
import { getPDAs } from "../utils";

// Payer + provider
const payer = getKeypairFromFile(`${os.homedir()}/.config/solana/id.json`);
console.log("Wallet:", payer.publicKey.toBase58());

const connection = new Connection(anchor.web3.clusterApiUrl("devnet"), "confirmed");
const wallet = new anchor.Wallet(payer);
const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });
const program = new anchor.Program(idl as anchor.Idl, provider);

// Token mint
const tokenMint = new PublicKey("EACCCLYtCanWifwD8CD2iJrqjXvHDTGvA3yxFKfjNu7X");

/// Sell with Quote Input (enter token amount)
async function sellQuoteInput() {
  const { curveConfig, bondingCurve, poolTokenAccount, poolSolVault, userTokenAccount, poolSolVaultBump } =
    await getPDAs(payer.publicKey, tokenMint, program.programId);

  const amount = new anchor.BN(1_000_000_000); // example: sell 1 token

  const before = await getBalances(connection, wallet.publicKey, poolSolVault, poolTokenAccount, userTokenAccount, tokenMint);
  printBalances("BEFORE SELL_QUOTE", before);

  const tx = await program.methods
    .sellQuoteInput(amount, poolSolVaultBump)
    .accounts({
      bondingCurveConfiguration: curveConfig,
      bondingCurveAccount: bondingCurve,
      tokenMint,
      poolTokenAccount,
      poolSolVault,
      userTokenAccount,
      user: wallet.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    })
    .rpc();

  console.log("✅ sell_quote_input tx:", tx);

  const after = await getBalances(connection, wallet.publicKey, poolSolVault, poolTokenAccount, userTokenAccount, tokenMint);
  printBalances("AFTER SELL_QUOTE", after);
  printDiff(before, after);
}

/// Sell with Base Input (enter SOL amount to receive)
async function sellBaseInput() {
  const { curveConfig, bondingCurve, poolTokenAccount, poolSolVault, userTokenAccount ,poolSolVaultBump } =
    await getPDAs(payer.publicKey, tokenMint, program.programId);
  const solAmount = new anchor.BN(0.01 * 1e9); // example: receive 0.01 SOL

  const before = await getBalances(connection, wallet.publicKey, poolSolVault, poolTokenAccount, userTokenAccount, tokenMint);
  printBalances("BEFORE SELL_BASE", before);

  const tx = await program.methods
    .sellBaseInput(solAmount, poolSolVaultBump)
    .accounts({
      bondingCurveConfiguration: curveConfig,
      bondingCurveAccount: bondingCurve,
      tokenMint,
      poolTokenAccount,
      poolSolVault,
      userTokenAccount,
      user: wallet.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    })
    .rpc();

  console.log("✅ sell_base_input tx:", tx);

  const after = await getBalances(connection, wallet.publicKey, poolSolVault, poolTokenAccount, userTokenAccount, tokenMint);
  printBalances("AFTER SELL_BASE", after);
  printDiff(before, after);
}

// Runner
(async () => {
  const choice = await askAction("sell");
  if (choice === "quote") {
    await sellQuoteInput();
  } else {
    await sellBaseInput();
  }
})();
