import { Connection, GetProgramAccountsFilter, Keypair, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { ALLOCATION_SEED_PREFIX, deserializeAllocationAndVesting, deserializeBondingCurve, deserializeCurveConfiguration, getKeypairFromFile, getPDAs } from "./utils";
import os from "os";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import dotenv from "dotenv"
import BN from "bn.js";
dotenv.config()

const programId = new PublicKey("CB18NKSvKunD2xeuvEkKfBxuz4fJFJJ8GPy5w1dMzN1");




const connection = new Connection("https://api.devnet.solana.com", {
  commitment: "confirmed",
});


const wallet = getKeypairFromFile(`${os.homedir()}/.config/solana/id.json`);

const team = Keypair.fromSecretKey(bs58.decode(process.env.TEAM_PRIVATE_KEY))
const advisor = Keypair.fromSecretKey(bs58.decode(process.env.ADVISOR_PRIVATE_KEY))
console.log("Team:", team.publicKey.toBase58());
console.log("Advisor:", advisor.publicKey.toBase58());

const mintLatest = new PublicKey("91c2ENi1DrFLJBN6vwA2G3vFopXsrF9s8nfMpyF5jgCz");

async function getCurveConfig() {

  const {curveConfig} = await getPDAs(wallet.publicKey, mintLatest, programId);
  console.log("Curve Config:", curveConfig.toBase58());
  const accountInfo = await connection.getAccountInfo(curveConfig);
  if (!accountInfo) {
    console.log("PDA account does not exist or has no data.");
    return;
  }
  const decodedData = deserializeCurveConfiguration(accountInfo.data);
  console.log("Decoded Curve Configuration Data:", decodedData);
}
  
async function getBondingCurveAccounts(mint: PublicKey) {


  const seeds = [Buffer.from("bonding_curve"), mint.toBuffer()];


  const [bondingCurve, bump] = PublicKey.findProgramAddressSync(seeds, programId);

  console.log("Bonding Curve:", bondingCurve.toBase58());

  const accountInfo = await connection.getAccountInfo(bondingCurve);

  if (!accountInfo) {
    console.log("PDA account does not exist or has no data.");
    return;
  }

  const decodedData = deserializeBondingCurve(accountInfo.data);
  console.log("Decoded BondingCurve Data:", decodedData);

}


async function getAllocationsAndVesting() {

  const wallets = [team.publicKey, advisor.publicKey]

  for (const wallet of wallets) {
  const seeds = [Buffer.from(ALLOCATION_SEED_PREFIX), wallet.toBuffer()];


  const [allocation, bump] = PublicKey.findProgramAddressSync(seeds, programId);

  console.log("PDA Address:", allocation.toBase58());

  const accountInfo = await connection.getAccountInfo(allocation);

  if (!accountInfo) {
    console.log("PDA account does not exist or has no data.");
    return;
  }

  const decodedData = deserializeAllocationAndVesting(accountInfo.data);
  console.log("Decoded Allocation Data:", decodedData);
  }
}

const mintLatest2 = new PublicKey("6spgRQUqZCW5NmZaV4Ni99tgmYWHVzynb4JdtgZqBKbe");


async function main() {
  await getCurveConfig();
  await getBondingCurveAccounts(mintLatest2);


  // await getAllocationsAndVesting();



}

main();








