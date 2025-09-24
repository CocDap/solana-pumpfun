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

/// Buy with Quote Input (enter token amount)
async function buyQuoteInput() {
  const { curveConfig, bondingCurve, poolTokenAccount, poolSolVault, userTokenAccount } =
    await getPDAs(payer.publicKey, tokenMint, program.programId);

  const amount = new anchor.BN(1_000_000_000); // example: 1 token (decimals=9)

  const before = await getBalances(connection, wallet.publicKey, poolSolVault, poolTokenAccount, userTokenAccount, tokenMint);
  printBalances("BEFORE BUY_QUOTE", before);

  const tx = await program.methods
    .buyQuoteInput(amount)
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

  console.log("✅ buy_quote_input tx:", tx);

  const after = await getBalances(connection, wallet.publicKey, poolSolVault, poolTokenAccount, userTokenAccount, tokenMint);
  printBalances("AFTER BUY_QUOTE", after);
  printDiff(before, after);
}

/// Buy with Base Input (enter SOL amount)
async function buyBaseInput() {
  const { curveConfig, bondingCurve, poolTokenAccount, poolSolVault, userTokenAccount , poolSolVaultBump} =
    await getPDAs(payer.publicKey, tokenMint, program.programId);


  const solAmount = new anchor.BN(0.1 * 1e9); // example: buy with 0.01 SOL

  const before = await getBalances(connection, wallet.publicKey, poolSolVault, poolTokenAccount, userTokenAccount, tokenMint);
  printBalances("BEFORE BUY_BASE", before);

  const tx = await program.methods
    .buyBaseInput(solAmount, poolSolVaultBump)
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

  console.log("✅ buy_base_input tx:", tx);

  const after = await getBalances(connection, wallet.publicKey, poolSolVault, poolTokenAccount, userTokenAccount, tokenMint);
  printBalances("AFTER BUY_BASE", after);
  printDiff(before, after);
}

// Runner
(async () => {
  const choice = await askAction("buy");
  if (choice === "quote") {
    await buyQuoteInput();
  } else {
    await buyBaseInput();
  }
})();
