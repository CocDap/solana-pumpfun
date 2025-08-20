import {
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    clusterApiUrl,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
    PublicKey,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    MINT_SIZE,
    createMintToInstruction,
    createInitializeMintInstruction,
    getAssociatedTokenAddress,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,

} from "@solana/spl-token";
import {
    createCreateMetadataAccountV3Instruction,
    PROGRAM_ID as METADATA_PROGRAM_ID,
    PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import * as bs58 from "bs58";
import dotenv from "dotenv"
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { BondingCurve } from "../target/types/bonding_curve";
import { getAllocationPDAs, getFairLaunchPDAs, getPDAs } from "./utils";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
dotenv.config()


const BONDING_CURVE_IDL = require("../target/idl/bonding_curve.json");

const TX_INTERVAL = 1000;



async function main() {
    const connection = new Connection("https://api.devnet.solana.com", {
        commitment: "confirmed",
    });
    const signer = Keypair.fromSecretKey(bs58.decode(process.env.SIGNER_PRIVATE_KEY))

    const wallet = new anchor.Wallet(signer);

    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);

    const program = new Program(BONDING_CURVE_IDL, provider);
    console.log("Program:", program.programId.toBase58());

    console.log("Signer:", signer.publicKey.toBase58());
    const user1 = Keypair.fromSecretKey(bs58.decode(process.env.USER_PRIVATE_KEY))
    const team = Keypair.fromSecretKey(bs58.decode(process.env.TEAM_PRIVATE_KEY))
    const advisor = Keypair.fromSecretKey(bs58.decode(process.env.ADVISOR_PRIVATE_KEY))
    const advisor2 = Keypair.generate();
    const advisor3 = Keypair.generate();
    const advisor4 = Keypair.generate();
    const advisor5 = Keypair.generate();
    const advisor6 = Keypair.generate();


    const mint = Keypair.generate();
    console.log("New token mint public key:", mint.publicKey.toBase58());

    const tokenMetadata = {
        name: "Fair Launch Token",
        symbol: "FLT",
        uri: "https://gray-left-duck-68.mypinata.cloud/ipfs/bafkreieezx4pg42s2symhlc4jybdovwjjnj5a7wzzck47p4pstqwgwwf7q",
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
    };

    try {
        let transactionFirst = new Transaction();
        const tokenTransaction = await createTokenTransaction(connection, signer, mint, tokenMetadata);
        transactionFirst.add(tokenTransaction);

        const bondingCurveTransaction = await createBondingCurveTransaction(program, mint.publicKey, signer);
        transactionFirst.add(bondingCurveTransaction);

        const allocationTransaction1 = await createAllocationTransactions(program, mint.publicKey, [team.publicKey, advisor.publicKey, user1.publicKey], signer);
        transactionFirst.add(...allocationTransaction1);

        const fairLaunchTransaction1 = await createFairLaunchTransaction(program, mint.publicKey, signer);
        transactionFirst.add(fairLaunchTransaction1);


        transactionFirst.feePayer = signer.publicKey;
        transactionFirst.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transactionFirst.partialSign(mint);
        transactionFirst.partialSign(signer);

        console.log("Transaction size:", transactionFirst.serialize().length);

        console.log("\n=== SIMULATING TRANSACTION ===");

        // Simulate the transaction (dry-run)
        const simulationFirst = await connection.simulateTransaction(transactionFirst);
  
        console.log("✅ Simulation successful!");
        console.log("Logs:", simulationFirst.value.logs);
        console.log("Units consumed:", simulationFirst.value.unitsConsumed);
  
        if (simulationFirst.value.err) {
          console.log("❌ Simulation error:", simulationFirst.value.err);
          throw new Error(`Simulation failed: ${JSON.stringify(simulationFirst.value.err)}`);
        }
  

        let transactionSecond = new Transaction();
        const allocationTransaction = await createAllocationTransactions(program, mint.publicKey, [team.publicKey, advisor.publicKey, advisor2.publicKey, advisor3.publicKey, advisor4.publicKey, advisor5.publicKey, advisor6.publicKey, user1.publicKey], signer);
        transactionSecond.add(...allocationTransaction);

        const fairLaunchTransaction = await createFairLaunchTransaction(program, mint.publicKey, signer);
        transactionSecond.add(fairLaunchTransaction);

        transactionSecond.feePayer = signer.publicKey;
        transactionSecond.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transactionSecond.partialSign(signer);

        console.log("Transaction size:", transactionSecond.serialize().length);

        const simulationSecond = await connection.simulateTransaction(transactionSecond);
        console.log("✅ Simulation successful!");
        console.log("Logs:", simulationSecond.value.logs);
        console.log("Units consumed:", simulationSecond.value.unitsConsumed);

        if (simulationSecond.value.err) {
            console.log("❌ Simulation error:", simulationSecond.value.err);
            throw new Error(`Simulation failed: ${JSON.stringify(simulationSecond.value.err)}`);
        }

        // const tx = await connection.sendTransaction(transaction, [signer, mint], {
        //     skipPreflight: false,
        //     preflightCommitment: "confirmed",
        // });
        // console.log("Transaction sent:", tx);
        // await connection.confirmTransaction(tx);
        // console.log("Transaction confirmed:", `https://solscan.io/tx/${tx}?cluster=devnet`);




    } catch (error) {
        console.error("❌ Transaction sequence failed:", error);
        
        // Log detailed error information
        if (error.logs) {
            console.error("📋 Transaction logs:", error.logs);
        }
        
        // Handle specific error types
        if (error.message?.includes("Transaction too large")) {
            console.error("💡 Suggestion: Try reducing instruction data or splitting into smaller transactions");
        }
        if (error.message?.includes("Insufficient funds")) {
            console.error("💡 Suggestion: Check account balances and ensure sufficient SOL for rent and fees");
        }
        
        throw error;
    }
}


async function createTokenTransaction(
    connection: Connection,
    signer: Keypair,
    mint: Keypair,
    tokenMetadata: any
): Promise<Transaction> {
    const decimals = 9;

    const createMintAccountInstruction = SystemProgram.createAccount({
        fromPubkey: signer.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
        programId: TOKEN_PROGRAM_ID,
    });

    const initializeMintInstruction = createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        signer.publicKey,
        signer.publicKey,
    );

    const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
        {
            metadata: PublicKey.findProgramAddressSync(
                [
                    Buffer.from("metadata"),
                    PROGRAM_ID.toBuffer(),
                    mint.publicKey.toBuffer(),
                ],
                PROGRAM_ID,
            )[0],
            mint: mint.publicKey,
            mintAuthority: signer.publicKey,
            payer: signer.publicKey,
            updateAuthority: signer.publicKey,
        },
        {
            createMetadataAccountArgsV3: {
                data: {
                    name: tokenMetadata.name,
                    symbol: tokenMetadata.symbol,
                    uri: tokenMetadata.uri,
                    sellerFeeBasisPoints: tokenMetadata.sellerFeeBasisPoints,
                    creators: tokenMetadata.creators,
                    collection: tokenMetadata.collection,
                    uses: tokenMetadata.uses,
                },
                isMutable: true,
                collectionDetails: null,
            },
        }
    );

    const associatedtoken = await getAssociatedTokenAddress(
        mint.publicKey,
        signer.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const associatedTokenAccountInstruction = createAssociatedTokenAccountInstruction(
        signer.publicKey,
        associatedtoken,
        signer.publicKey,
        mint.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const totalSupply = 1_000_000;
    const mintInstruction = createMintToInstruction(
        mint.publicKey,
        associatedtoken,
        signer.publicKey,
        totalSupply * Math.pow(10, 6)
    );

    return new Transaction().add(
        createMintAccountInstruction,
        initializeMintInstruction,
        createMetadataInstruction,
        associatedTokenAccountInstruction,
        mintInstruction
    );
}

async function createAllocationTransactions(
    program: Program<BondingCurve>,
    mint: PublicKey,
    wallets: PublicKey[],
    signer: Keypair
): Promise<Transaction[]> {
    const { allocations, allocationTokenAccounts } = getAllocationPDAs(mint, wallets, program.programId);
    console.log("Allocation wallets:", wallets);
    console.log("Allocation's accounts:", allocations);
    const transactions: Transaction[] = [];

    let percentage = new BN(10)
    let totalTokens = new BN(1000000000000)
    let currentTime = Math.floor(Date.now() / 1000);
    let startTime = new BN(currentTime).add(new BN(1000));
    let cliffPeriod = new BN(1000);
    let duration = new BN(1000);
    let interval = new BN(1000);
    let released = new BN(0);

    let vesting = {
        cliffPeriod: cliffPeriod,
        startTime: startTime,
        duration: duration,
        interval: interval,
        released: released,
    }


    for (let i = 0; i < wallets.length; i++) {
        const createAllocationInstruction = await program.methods
            .createAllocation(percentage.toNumber(), totalTokens, vesting)
            .accountsStrict({
                allocation: allocations[i],
                wallet: wallets[i],
                tokenMint: mint,
                allocationVault: allocationTokenAccounts[i],
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY,
                systemProgram: SystemProgram.programId,
                authority: signer.publicKey,
            })
            .instruction()

        transactions.push(new Transaction().add(createAllocationInstruction));
    }

    return transactions;
}

async function createFairLaunchTransaction(
    program: Program<BondingCurve>,
    mint: PublicKey,
    signer: Keypair
): Promise<Transaction> {
    const { fairLaunchData, launchpadTokenAccount, contributionVault } = getFairLaunchPDAs(mint, program.programId);

    let softCap = new BN(1_000_000_000);
    let hardCap = new BN(10_000_000_000);
    let minContribution = new BN(100_000_000);
    let maxContribution = new BN(2_000_000_000);
    let maxTokensPerWallet = new BN(1000);
    let distributionDelay = new BN(3600);
    let currentTime = Math.floor(Date.now() / 1000);
    let startTime = new BN(currentTime + 60);
    let endTime = new BN(currentTime + 3600);

    const createFairLaunchInstruction = await program.methods
        .createFairLaunch(
            softCap,
            hardCap,
            startTime,
            endTime,
            minContribution,
            maxContribution,
            maxTokensPerWallet,
            distributionDelay
        )
        .accountsStrict({
            fairLaunchData: fairLaunchData,
            tokenMint: mint,
            launchpadVault: launchpadTokenAccount,
            contributionVault: contributionVault,
            authority: signer.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
        })
        .instruction();

    return new Transaction().add(createFairLaunchInstruction);
}

async function createBondingCurveTransaction(
    program: Program<BondingCurve>,
    mint: PublicKey,
    signer: Keypair
): Promise<Transaction> {
    const index = new BN(5);
    const {curveConfig} = await getPDAs(signer.publicKey, mint, program.programId);
    const { bondingCurve, poolTokenAccount, poolSolVault, userTokenAccount } = await getPDAs(signer.publicKey, mint, program.programId);

    const feePercentage = 100;
    const initialQuorum = new BN(500);
    const targetLiquidity = new BN(1000000000);
    const daoQuorum = 500;
    const bondingCurveType = 0;
    const maxTokenSupply = new BN(10000000000);
    const liquidityLockPeriod = new BN(60);
    const liquidityPoolPercentage = 50;
    const initialReserve = new BN(100000); // 0.0000001 SOL
    const initialSupply = new BN(100_000_000_000); // 10000 SPL tokens with 6 decimals 
    const reserveRatio = 5000;


    let recipients = [
        {
            address: signer.publicKey,
            share: 10000,
            amount: new BN(0),
            lockingPeriod: new BN(60000),
        },
    ]



    const createLiquidityPoolInstruction = await program.methods
        .createPool(
            signer.publicKey,
            feePercentage,
            initialQuorum,
            targetLiquidity,
            signer.publicKey,
            daoQuorum,
            bondingCurveType, maxTokenSupply, liquidityLockPeriod, liquidityPoolPercentage, initialReserve, initialSupply, recipients, reserveRatio
        )
        .accountsStrict({
            bondingCurveConfiguration: curveConfig,
            bondingCurveAccount: bondingCurve,
            tokenMint: mint,
            poolTokenAccount: poolTokenAccount,
            poolSolVault: poolSolVault,
            userTokenAccount: userTokenAccount,
            admin: signer.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID
        })
        .instruction();
    return new Transaction().add(createLiquidityPoolInstruction);


}

main();