import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js";
import {
    createInitializeMintInstruction,
    createInitializeMetadataPointerInstruction,
    ExtensionType,
    getMintLen,
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createMintToInstruction,
} from "@solana/spl-token";
import {
    createInitializeInstruction,
} from "@solana/spl-token-metadata";
import * as bs58 from "bs58";
import dotenv from "dotenv";
import * as multisig from "@sqds/multisig";
import { getKeypairFromFile } from "./utils";

dotenv.config();

// Configuration for mainnet
const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

// Environment variables
const MEMBER1_PRIVATE_KEY = process.env.MEMBER1_PRIVATE_KEY;

const MULTISIG_ADDRESS = process.env.MULTISIG_ADDRESS;

const MINT_KEYPAIR = getKeypairFromFile(`./potBNyoQHchqV59LpZCgp93EjeN7241dy27VSr25x97.json`);

// Token configuration
const TOKEN_CONFIG = {
    name: "POT-Test",
    symbol: "POT",
    uri: "https://gray-left-duck-68.mypinata.cloud/ipfs/bafkreieezx4pg42s2symhlc4jybdovwjjnj5a7wzzck47p4pstqwgwwf7q",
    decimals: 6,
};

const INITIAL_SUPPLY = 1_000_000_000_000;


async function main() {
    console.log("🚀 Creating Token 2022 with Squads Multisig on Mainnet");
    console.log("=".repeat(50));

    // Validate environment variables
    if (!MEMBER1_PRIVATE_KEY) {
        throw new Error("❌ Missing member private keys in environment variables");
    }

    if (!MULTISIG_ADDRESS) {
        throw new Error("❌ Missing MULTISIG_ADDRESS in environment variables");
    }

    // Initialize connection and keypairs
    const connection = new Connection(RPC_URL, "confirmed");
    const member1 = Keypair.fromSecretKey(bs58.decode(MEMBER1_PRIVATE_KEY));
    const multisigPda = new PublicKey(MULTISIG_ADDRESS);

    console.log("📋 Configuration:");
    console.log(`- Network: Mainnet`);
    console.log(`- Multisig: ${MULTISIG_ADDRESS}`);
    console.log(`- Member 1: ${member1.publicKey.toBase58()}`);
    console.log(`- Mint Address: ${MINT_KEYPAIR.publicKey.toBase58()}`);
    console.log();

    try {
        // Check multisig status first
        console.log("🔍 Checking multisig status...");
        const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
            connection,
            multisigPda
        );

        console.log("🏛️ Multisig Details:");
        console.log(`- Threshold: ${multisigAccount.threshold}`);
        console.log(`- Members: ${multisigAccount.members.length}`);
        console.log(`- Transaction Index: ${multisigAccount.transactionIndex}`);
        console.log(`- Stale Transaction Index: ${multisigAccount.staleTransactionIndex}`);
        console.log();

        // Get vault PDA
        const [vaultPda] = multisig.getVaultPda({
            multisigPda,
            index: 0,
        });
        console.log(`🏦 Vault Address: ${vaultPda.toBase58()}`);


        try {
            // 
            const transactionIndex = Number(multisigAccount.transactionIndex);
            const transactionIndexBN = BigInt(transactionIndex);
            console.log("Transaction Index:", transactionIndexBN);
            const latestBlockhash = await connection.getLatestBlockhash();
            
            console.log("Vault Multisig address:",vaultPda);
            console.log("MultiSig PDA:",multisigPda);

            const [transactionPda] = multisig.getTransactionPda({
                multisigPda,
                index: transactionIndexBN,
            });
            console.log("Transaction PDA:",transactionPda);
            console.log("Transaction Index:", transactionIndexBN)

            const executeTransactionIx = multisig.instructions.configTransactionExecute({
                multisigPda,
                transactionIndex: transactionIndexBN,
                member: member1.publicKey,
                rentPayer: member1.publicKey,
              });

            // Execute the transaction creation and proposal
            const { blockhash } = await connection.getLatestBlockhash();
            const executeTx = new TransactionMessage({
                payerKey: member1.publicKey,
                recentBlockhash: blockhash,
                instructions: [executeTransactionIx],
            }).compileToLegacyMessage();

            const executeTransaction = new VersionedTransaction(executeTx);
            executeTransaction.sign([member1]); 

            const simulateTransaction = await connection.simulateTransaction(executeTransaction);
            console.log("Simulation Transaction:",simulateTransaction);

            // console.log("📡 Sending transaction...");
            // const signature = await connection.sendTransaction(createTransaction, {
            //     skipPreflight: false,
            //     preflightCommitment: "confirmed",
            // });

            // console.log("⏳ Confirming transaction...");
            // await connection.confirmTransaction(signature, "confirmed");

            // console.log("✅ SUCCESS! Transaction created and proposed!");
            // console.log(`📊 Transaction Index: ${transactionIndex}`);
            // console.log(`🔗 Transaction Signature: ${signature}`);
            // console.log(`📋 View in Squads UI: https://v4.squads.so/squads/${MULTISIG_ADDRESS}`);

            // console.log("\n📋 TRANSACTION SUMMARY:");
            // console.log(`- Created Token 2022 mint: ${MINT_KEYPAIR.publicKey.toBase58()}`);
            // console.log(`- Minted ${INITIAL_SUPPLY / Math.pow(10, TOKEN_CONFIG.decimals)} ${TOKEN_CONFIG.symbol} to vault`);
            // console.log(`- Vault token account: ${vaultTokenAccount.toBase58()}`);
            // console.log(`- Proposed by: ${member1.publicKey.toBase58()}`);
            // console.log(`- Requires ${multisigAccount.threshold} approvals to execute`);

        } catch (proposalError) {
            console.error("❌ Error creating/proposing transaction:", proposalError);
            

        }




    } catch (error) {
        console.error("❌ Error:", error);
        throw error;
    }
}




// Run the main function
if (require.main === module) {
    main().catch((error) => {
        console.error("💥 Script failed:", error);
        process.exit(1);
    });
}

export default main;
