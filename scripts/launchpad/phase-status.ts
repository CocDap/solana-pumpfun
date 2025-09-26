import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import { getKeypairFromFile } from "../utils";
import idl from "../../target/idl/bonding_curve.json";
import { getFairLaunchPDAs } from "../utils";
import { BondingCurve } from "./../../target/types/bonding_curve";

const main = async () => {
  // 1. Kết nối Devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // 2. Load ví signer từ file id.json
  const payer = getKeypairFromFile(process.env.HOME + "/.config/solana/id.json");
  const wallet = new anchor.Wallet(payer);

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // 3. Lấy Program ID từ idl hoặc hardcode
  const programId = new PublicKey(
    (idl as any).metadata?.address || "8xHgHWuASAV8sv5wSptzoa4ZUYkRA5VkpUPSUM4fU3gQ"
  );

  const program = anchor.workspace.BondingCurve as Program<BondingCurve>;

  // 5. Token mint cho fair launch
  const mintPubkey = new PublicKey("G91dtjKj7SHm8Kui7bnQADT3hjJUZ7KazmVmdeYSsKHY");

  // 6. Lấy PDA
  const { fairLaunchData, contributionVault, launchpadTokenAccount } =
    getFairLaunchPDAs(mintPubkey, program.programId);

  // 7. Lấy raw account info
  const accountInfo = await provider.connection.getAccountInfo(fairLaunchData);
  if (!accountInfo) {
    throw new Error("FairLaunchData account not found");
  }

  // 8. Decode dữ liệu từ account bằng coder
  const fairLaunchAccount = await program.account.fairLaunchData.coder.accounts.decode(
        "fairLaunchData",
        (await connection.getAccountInfo(fairLaunchData))!.data
      );

  // 9. Convert timestamp + lamports
  const startTime = new Date(Number(fairLaunchAccount.startTime) * 1000).toLocaleString();
  const endTime = new Date(Number(fairLaunchAccount.endTime) * 1000).toLocaleString();

  const softCapSol = Number(fairLaunchAccount.softCap) / 1e9;
  const hardCapSol = Number(fairLaunchAccount.hardCap) / 1e9;
  const totalRaisedSol = Number(fairLaunchAccount.totalRaised) / 1e9;
  const progressPct = ((totalRaisedSol / hardCapSol) * 100).toFixed(2);

  // 10. In ra thông tin
  console.log("=== Fair Launch Status ===");
  console.log("Token Mint:", mintPubkey.toBase58());
  console.log("Fair Launch PDA:", fairLaunchData.toBase58());
  console.log("Contribution Vault PDA:", contributionVault.toBase58());
  console.log("Launchpad Token Account (ATA):", launchpadTokenAccount.toBase58());
  console.log("---------------------------");
  console.log("authority:", fairLaunchAccount.authority.toBase58());
  console.log("token_mint:", fairLaunchAccount.tokenMint.toBase58());
  console.log("start_time:", startTime);
  console.log("end_time:", endTime);
  console.log(`soft_cap: ${softCapSol} SOL`);
  console.log(`hard_cap: ${hardCapSol} SOL`);
  console.log(`total_raised: ${totalRaisedSol} SOL`);
  console.log(`Progress: ${progressPct}% of raise target`);
  console.log("paused:", fairLaunchAccount.paused);
  console.log("bump:", fairLaunchAccount.bump);
  console.log("===========================");
};

main().catch((err) => {
  console.error(err);
});
