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


        // Calculate space and rent for Token 2022
        const extensions = [ExtensionType.MetadataPointer];
        const mintLen = getMintLen(extensions);
        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

        console.log(`💰 Required rent: ${lamports} lamports`);
        console.log(`📏 Account size: ${mintLen} bytes`);
        console.log();

        // Create the Token 2022 instructions
        const instructions: TransactionInstruction[] = [
            // 1. Create the mint account
            SystemProgram.createAccount({
                fromPubkey: vaultPda,
                newAccountPubkey: MINT_KEYPAIR.publicKey,
                space: mintLen,
                lamports,
                programId: TOKEN_2022_PROGRAM_ID,
            }),

            // 2. Initialize metadata pointer extension
            createInitializeMetadataPointerInstruction(
                MINT_KEYPAIR.publicKey, // mint
                vaultPda, // authority
                MINT_KEYPAIR.publicKey, // metadata address (same as mint)
                TOKEN_2022_PROGRAM_ID
            ),

            // 3. Initialize the mint
            createInitializeMintInstruction(
                MINT_KEYPAIR.publicKey,
                TOKEN_CONFIG.decimals,
                vaultPda, // mint authority
                vaultPda, // freeze authority
                TOKEN_2022_PROGRAM_ID
            ),

            // 4. Initialize metadata
            createInitializeInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                metadata: MINT_KEYPAIR.publicKey,
                updateAuthority: vaultPda,
                mint: MINT_KEYPAIR.publicKey,
                mintAuthority: vaultPda,
                name: TOKEN_CONFIG.name,
                symbol: TOKEN_CONFIG.symbol,
                uri: TOKEN_CONFIG.uri,
            }),
        ];

        const vaultTokenAccount = getAssociatedTokenAddressSync(
            MINT_KEYPAIR.publicKey,
            vaultPda,
            true, // allowOwnerOffCurve
            TOKEN_2022_PROGRAM_ID
        );
        console.log("Vault Token Account:",vaultTokenAccount);
        const accountInfo = await connection.getAccountInfo(vaultTokenAccount);
        if (!accountInfo) {
            instructions.push(createAssociatedTokenAccountInstruction(
                vaultPda, // payer
                vaultTokenAccount, // associated token account
                vaultPda, // owner
                MINT_KEYPAIR.publicKey, // mint
                TOKEN_2022_PROGRAM_ID
            ))
        }

        instructions.push(
            createMintToInstruction(
                MINT_KEYPAIR.publicKey, // mint
                vaultTokenAccount, // destination
                vaultPda, // authority
                INITIAL_SUPPLY, // amount
                [MINT_KEYPAIR], // multiSigners
                TOKEN_2022_PROGRAM_ID
            )
        )
        // Create and propose the transaction using MEMBER1
        console.log("\n🏗️ Creating and proposing multisig transaction...");

        try {
            const transactionIndex = Number(multisigAccount.transactionIndex) + 1;
            const transactionIndexBN = BigInt(transactionIndex);
            const latestBlockhash = await connection.getLatestBlockhash();
            
            console.log("Vault Multisig address:",vaultPda);
            console.log("MultiSig PDA:",multisigPda);

            const [transactionPda] = multisig.getTransactionPda({
                multisigPda,
                index: transactionIndexBN,
            });
            console.log("Transaction PDA:",transactionPda);
            console.log("Transaction Index:", transactionIndexBN)

            // Create the multisig transaction
            const createTxIx = multisig.instructions.vaultTransactionCreate({
                multisigPda,
                transactionIndex: transactionIndexBN,
                creator: member1.publicKey,
                vaultIndex: 0,
                ephemeralSigners: 1, // We need 1 ephemeral signer for the mint keypair
                transactionMessage: new TransactionMessage({
                    payerKey: vaultPda,
                    recentBlockhash: latestBlockhash.blockhash,
                    instructions: instructions,
                }),
            });

            // Create the proposal instruction
            const proposeTxIx = multisig.instructions.proposalCreate({
                multisigPda,
                transactionIndex: transactionIndexBN,
                creator: member1.publicKey,
            });

            // Execute the transaction creation and proposal
            const { blockhash } = await connection.getLatestBlockhash();
            const createTx = new TransactionMessage({
                payerKey: member1.publicKey,
                recentBlockhash: blockhash,
                instructions: [createTxIx, proposeTxIx],
            }).compileToLegacyMessage();

            const createTransaction = new VersionedTransaction(createTx);
            createTransaction.sign([member1 ]); // Sign with member1 and mint keypair

            const simulateTransaction = await connection.simulateTransaction(createTransaction);
            console.log("Simulation Transaction:",simulateTransaction);

            console.log("📡 Sending transaction...");
            const signature = await connection.sendTransaction(createTransaction, {
                skipPreflight: false,
                preflightCommitment: "confirmed",
            });

            console.log("⏳ Confirming transaction...");
            await connection.confirmTransaction(signature, "confirmed");

            console.log("✅ SUCCESS! Transaction created and proposed!");
            console.log(`📊 Transaction Index: ${transactionIndex}`);
            console.log(`🔗 Transaction Signature: ${signature}`);
            console.log(`📋 View in Squads UI: https://v4.squads.so/squads/${MULTISIG_ADDRESS}`);

            console.log("\n📋 TRANSACTION SUMMARY:");
            console.log(`- Created Token 2022 mint: ${MINT_KEYPAIR.publicKey.toBase58()}`);
            console.log(`- Minted ${INITIAL_SUPPLY / Math.pow(10, TOKEN_CONFIG.decimals)} ${TOKEN_CONFIG.symbol} to vault`);
            console.log(`- Vault token account: ${vaultTokenAccount.toBase58()}`);
            console.log(`- Proposed by: ${member1.publicKey.toBase58()}`);
            console.log(`- Requires ${multisigAccount.threshold} approvals to execute`);

        } catch (proposalError) {
            console.error("❌ Error creating/proposing transaction:", proposalError);
            
            // Fallback to manual instructions
            console.log("\n⚠️  FALLING BACK TO MANUAL TRANSACTION CREATION");
            console.log("Please use the Squads UI or CLI to create this transaction:");
            console.log();
            console.log("📋 Instructions Summary:");
            console.log("1. Go to https://v4.squads.so/squads/" + MULTISIG_ADDRESS);
            console.log("2. Create a new vault transaction");
            console.log("3. Add the following instructions:");
            console.log();

            // Display the instructions in a format that can be manually added
            instructions.forEach((ix, index) => {
                console.log(`Instruction ${index + 1}:`);
                console.log(`- Program ID: ${ix.programId.toBase58()}`);
                console.log(`- Keys: ${ix.keys.length} accounts`);
                console.log(`- Data: ${bs58.encode(ix.data)}`);
                console.log();
            });

            console.log("🔑 IMPORTANT - Save this mint keypair:");
            console.log(`Public Key: ${MINT_KEYPAIR.publicKey.toBase58()}`);
            console.log(`Private Key: ${bs58.encode(MINT_KEYPAIR.secretKey)}`);
            console.log();

        }




    } catch (error) {
        console.error("❌ Error:", error);
        throw error;
    }
}

// Helper function to display setup instructions
function displaySetupInstructions() {
    console.log("\n" + "=".repeat(50));
    console.log("📋 SETUP INSTRUCTIONS");
    console.log("=".repeat(50));
    console.log("1. Make sure your .env file contains:");
    console.log("   MEMBER1_PRIVATE_KEY=your_member1_base58_private_key");
    console.log("   MULTISIG_ADDRESS=your_multisig_pubkey");
    console.log("   RPC_URL=your_mainnet_rpc_url");
    console.log();
    console.log("2. Add to package.json scripts:");
    console.log('   "create-token-2022-multisig": "ts-node scripts/create-token-2022-multisig.ts"');
    console.log();
    console.log("3. Run the script:");
    console.log("   npm run create-token-2022-multisig");
    console.log();
    console.log("4. Use the output to manually create the transaction in Squads UI");
    console.log("=".repeat(50));
}


// Run the main function
if (require.main === module) {
    main().catch((error) => {
        console.error("💥 Script failed:", error);
        displaySetupInstructions();
        process.exit(1);
    });
}

export default main;


// - Created Token 2022 mint: potBNyoQHchqV59LpZCgp93EjeN7241dy27VSr25x97
// - Minted 1000000 POT to vault
// - Vault token account: 84fH5TUTBBfGn9XvHgDYs7xemfeo45HgnDLGCvaF8ror
// - Proposed by: AnrqGSUZNostNT24G7Xi8CxLGEQDR9Ywxj1fJU9DYtAP
// - Requires 2 approvals to execute