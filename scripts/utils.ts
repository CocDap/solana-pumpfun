import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import fs from 'fs';
import { Transaction, TransactionInstruction } from "@solana/web3.js";
import { sendAndConfirmTransaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

const CURVE_CONFIGURATION_SEED = "curve_configuration"
const POOL_SEED_PREFIX = "bonding_curve"
const SOL_VAULT_PREFIX = "liquidity_sol_vault"
const FEE_POOL_SEED_PREFIX = "fee_pool"
const FEE_POOL_VAULT_PREFIX = "fee_pool_vault"

/// Allocation
export const ALLOCATION_SEED_PREFIX = "allocation"


/// Fair Launch
export const LAUNCHPAD_SEED_PREFIX = "launchpad"
export const FAIR_LAUNCH_DATA_SEED_PREFIX = "fair_launch_data"
export const CONTRIBUTION_VAULT_SEED_PREFIX = "fair_launch_vault"
export const BUYER_SEED_PREFIX = "buyer"



export function deserializeBondingCurve(data) {

    const offset = 8; // Adjust to 0 if no discriminator is used

    let currentOffset = offset;

    // creator: Pubkey (32 bytes)
    const creator = new PublicKey(data.slice(currentOffset, currentOffset + 32));
    currentOffset += 32;

    // total_supply: u64 (8 bytes, little-endian)
    const totalSupply = data.readBigUInt64LE(currentOffset);
    currentOffset += 8;

    // reserve_balance: u64 (8 bytes, little-endian)
    const reserveBalance = data.readBigUInt64LE(currentOffset);
    currentOffset += 8;

    // reserve_token: u64 (8 bytes, little-endian)
    const reserveToken = data.readBigUInt64LE(currentOffset);
    currentOffset += 8;

    // token: Pubkey (32 bytes)
    const token = new PublicKey(data.slice(currentOffset, currentOffset + 32));
    currentOffset += 32;
    // bump: u8 (1 byte)
    const bump = data.readUInt8(currentOffset);
    currentOffset += 1;

    return {
        creator: creator.toBase58(),
        totalSupply: Number(totalSupply), // Convert BigInt to Number (if safe, else keep as BigInt)
        reserveBalance: Number(reserveBalance),
        reserveToken: Number(reserveToken),
        token: token.toBase58(),
        bump,
    };
}


export function deserializeCurveConfiguration(data) {
    let offset = 8; // Skip the 8-byte discriminator

    // Read global_admin: Pubkey (32 bytes)
    const globalAdmin = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    // Read fee_admin: Pubkey (32 bytes)
    const feeAdmin = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    // Read initial_quorum: u64 (8 bytes)
    const initialQuorum = data.readBigUInt64LE(offset);
    offset += 8;

    // Read use_dao: bool (1 byte)
    const useDao = data.readUInt8(offset) !== 0;
    offset += 1;

    // Read governance: Pubkey (32 bytes)
    const governance = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    // Read dao_quorum: u16 (2 bytes)
    const daoQuorum = data.readUInt16LE(offset);
    offset += 2;

    // Read locked_liquidity: bool (1 byte)
    const lockedLiquidity = data.readUInt8(offset) !== 0;
    offset += 1;

    // Read target_liquidity: u64 (8 bytes)
    const targetLiquidity = data.readBigUInt64LE(offset);
    offset += 8;

    // Read fee_percentage: u16 (2 bytes)
    const feePercentage = data.readUInt16LE(offset);
    offset += 2;

    // Read fees_enabled: bool (1 byte)
    const feesEnabled = data.readUInt8(offset) !== 0;
    offset += 1;

    // Read bonding_curve_type: u8 (1 byte), mapped to string
    const bondingCurveTypeRaw = data.readUInt8(offset);
    offset += 1;
    let bondingCurveType;
    if (bondingCurveTypeRaw === 0) {
        bondingCurveType = "Linear";
    } else if (bondingCurveTypeRaw === 1) {
        bondingCurveType = "Quadratic";
    } else {
        throw new Error("Invalid bonding curve type");
    }

    // Read max_token_supply: u64 (8 bytes)
    const maxTokenSupply = data.readBigUInt64LE(offset);
    offset += 8;

    // Read liquidity_lock_period: i64 (8 bytes)
    const liquidityLockPeriod = data.readBigInt64LE(offset);
    offset += 8;

    // Read liquidity_pool_percentage: u16 (2 bytes)
    const liquidityPoolPercentage = data.readUInt16LE(offset);
    offset += 2;

    // Read initial_price: u64 (8 bytes)
    const initialPrice = data.readBigUInt64LE(offset);
    offset += 8;

    // Read initial_supply: u64 (8 bytes)
    const initialSupply = data.readBigUInt64LE(offset);
    offset += 8;

    // Read fee_recipients: Vec<Recipient>
    const feeRecipientsLength = data.readUInt32LE(offset); // Length of the vector (4 bytes)
    offset += 4;

    const feeRecipients = [];
    for (let i = 0; i < feeRecipientsLength; i++) {
        // Read address: Pubkey (32 bytes)
        const address = new PublicKey(data.slice(offset, offset + 32)).toBase58();
        offset += 32;

        // Read share: u16 (2 bytes)
        const share = data.readUInt16LE(offset);
        offset += 2;

        // Read amount: u64 (8 bytes)
        const amount = data.readBigUInt64LE(offset);
        offset += 8;

        // Read locking_period: i64 (8 bytes)
        const lockingPeriod = data.readBigInt64LE(offset);
        offset += 8;

        feeRecipients.push({
            address,
            share,
            amount: amount.toString(),
            lockingPeriod: lockingPeriod.toString()
        });
    }

    // Read total_fees_collected: u64 (8 bytes)
    const totalFeesCollected = data.readBigUInt64LE(offset);
    offset += 8;

    // Read reserve_ratio: u16 (2 bytes)
    const reserveRatio = data.readUInt16LE(offset);
    offset += 2;

    // Return the deserialized object
    return {
        globalAdmin,
        feeAdmin,
        initialQuorum: initialQuorum.toString(),
        useDao,
        governance,
        daoQuorum,
        lockedLiquidity,
        targetLiquidity: targetLiquidity.toString(),
        feePercentage,
        feesEnabled,
        bondingCurveType,
        maxTokenSupply: maxTokenSupply.toString(),
        liquidityLockPeriod: liquidityLockPeriod.toString(),
        liquidityPoolPercentage,
        initialPrice: initialPrice.toString(),
        initialSupply: initialSupply.toString(),
        feeRecipients,
        totalFeesCollected: totalFeesCollected.toString(),
        reserveRatio,
    };
}


export const deserializeAllocationAndVesting = (data) => {
    if (data.length < 8) {
        throw new Error(`Invalid account data length: expected at least 8 bytes for discriminator, got ${data.length}`);
    }

    // Expected minimum lengths
    const minLengthWithoutVesting = 8 + 32 + 1 + 8 + 8 + 1 + 1; // 51 bytes
    const minLengthWithVesting = minLengthWithoutVesting + 40; // 91 bytes

    let offset = 8; // Skip the 8-byte discriminator

    // wallet: Pubkey (32 bytes)
    const wallet = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // percentage: u8 (1 byte)
    const percentage = data.readUInt8(offset);
    offset += 1;

    // total_tokens: u64 (8 bytes, little-endian)
    const totalTokens = data.readBigUInt64LE(offset);
    offset += 8;

    // claimed_tokens: u64 (8 bytes, little-endian)
    const claimedTokens = data.readBigUInt64LE(offset);
    offset += 8;

    // vesting: Option<Vesting>
    const hasVesting = data.readUInt8(offset) !== 0;
    offset += 1;

    // Validate data length
    if (!hasVesting && data.length < minLengthWithoutVesting) {
        throw new Error(`Invalid account data length: expected at least ${minLengthWithoutVesting} bytes, got ${data.length}`);
    }
    if (hasVesting && data.length < minLengthWithVesting) {
        throw new Error(`Invalid account data length: expected at least ${minLengthWithVesting} bytes, got ${data.length}`);
    }

    let vesting = null;
    if (hasVesting) {
        // cliff_period: i64 (8 bytes, little-endian, signed)
        const cliffPeriod = data.readBigInt64LE(offset);
        offset += 8;

        // start_time: i64 (8 bytes, little-endian, signed)
        const startTime = data.readBigInt64LE(offset);
        offset += 8;

        // duration: i64 (8 bytes, little-endian, signed)
        const duration = data.readBigInt64LE(offset);
        offset += 8;

        // interval: i64 (8 bytes, little-endian, signed)
        const interval = data.readBigInt64LE(offset);
        offset += 8;

        // released: u64 (8 bytes, little-endian, unsigned)
        const released = data.readBigUInt64LE(offset);
        offset += 8;

        vesting = {
            cliffPeriod: cliffPeriod.toString(),
            startTime: startTime.toString(),
            duration: duration.toString(),
            interval: interval.toString(),
            released: released.toString(),
            startTimeDate: new Date(Number(startTime) * 1000).toISOString(),
            cliffEndDate: new Date((Number(startTime) + Number(cliffPeriod)) * 1000).toISOString(),
            endDate: new Date((Number(startTime) + Number(duration)) * 1000).toISOString(),
        };
    }

    // bump: u8 (1 byte)
    const bump = data.readUInt8(offset);
    offset += 1;

    return {
        wallet: wallet.toBase58(),
        percentage,
        totalTokens: totalTokens.toString(),
        claimedTokens: claimedTokens.toString(),
        vesting,
        bump,
        unclaimedTokens: (BigInt(totalTokens) - BigInt(claimedTokens)).toString(),
        claimProgress: (Number(claimedTokens) / Number(totalTokens)) * 100, // Assumes safe range or adjust
        isFullyClaimed: BigInt(claimedTokens) >= BigInt(totalTokens),
    };
};



export async function getPDAs(user: PublicKey, mint: PublicKey, programId: PublicKey) {

    const [curveConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from(CURVE_CONFIGURATION_SEED), mint.toBuffer()],
        programId,
      );

    const [bondingCurve] = PublicKey.findProgramAddressSync(
        [Buffer.from(POOL_SEED_PREFIX), mint.toBuffer()],
        programId
    );

    const [poolSolVault, poolSolVaultBump] = PublicKey.findProgramAddressSync(
        [Buffer.from(SOL_VAULT_PREFIX), mint.toBuffer()],
        programId
    );

    const poolTokenAccount = await getAssociatedTokenAddress(
        mint, bondingCurve, true
    )
    const userTokenAccount = await getAssociatedTokenAddress(
        mint, user, true
    )
    return {
        curveConfig,
        userTokenAccount,
        bondingCurve,
        poolSolVault,
        poolSolVaultBump,
        poolTokenAccount,
    };
}

export function getAllocationPDAs(mint: PublicKey, wallet: PublicKey[], programId: PublicKey) {
    let allocations = []
    let allocationTokenAccounts = []
    let userTokenAccounts = []
    for (let i = 0; i < wallet.length; i++) {
        const [allocation] = PublicKey.findProgramAddressSync(
            [Buffer.from(ALLOCATION_SEED_PREFIX), wallet[i].toBuffer(), mint.toBuffer()],
            programId
        );
        allocations.push(allocation)

        const allocationTokenAccount = getAssociatedTokenAddressSync(
            mint, allocation, true
        )
        allocationTokenAccounts.push(allocationTokenAccount)

        const userTokenAccount = getAssociatedTokenAddressSync(
            mint, wallet[i], true
        )
        userTokenAccounts.push(userTokenAccount)
    }

    return {
        allocations,
        allocationTokenAccounts,
        userTokenAccounts,
    };
}

export function getFairLaunchPDAs(mint: PublicKey, programId: PublicKey) {

  
    const [fairLaunchData] = PublicKey.findProgramAddressSync(
      [Buffer.from(FAIR_LAUNCH_DATA_SEED_PREFIX), mint.toBuffer()],
      programId
    );
  
    const [fairLaunchVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONTRIBUTION_VAULT_SEED_PREFIX), fairLaunchData.toBuffer()],
      programId
    );
  
  
    const launchpadTokenAccount = getAssociatedTokenAddressSync(
      mint, fairLaunchData, true
    );
  
    const [contributionVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONTRIBUTION_VAULT_SEED_PREFIX), fairLaunchData.toBuffer()],
      programId
    );
  
    return {
      fairLaunchData,
      fairLaunchVault,
      launchpadTokenAccount,
      contributionVault,
    };
  }

  export function getBuyerFairLaunchPDAs(fairLaunchData: PublicKey, buyer: PublicKey, programId: PublicKey) {


    const [buyerAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(BUYER_SEED_PREFIX), fairLaunchData.toBuffer(), buyer.toBuffer()],
      programId
    );
  
    return buyerAccount;
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


export async function fetchBalancePool(connection: Connection, poolSolVault: PublicKey, poolTokenAccount: PublicKey) {
    // get native balance of poolSolVault
    const solBalance = await connection.getBalance(poolSolVault);

    // get token balance of poolTokenAccount
    const tokenBalance = await getAccount(connection, poolTokenAccount)

    return { solBalance, tokenBalance: tokenBalance.amount };
}


export const metadata = {
    "name": "Fair Launch Test Token",
    "symbol": "FLT",
    "description": "Fair Launch Token",
    "image": "https://magenta-impossible-turkey-605.mypinata.cloud/ipfs/bafybeigieesczeg7n36r3s4blkukdoaest4q3reg4azcr2syyycpwffbk4",
    "showName": true,
    "createdOn": "PortLock",
    "twitter": "",
    "telegram": "",
    "website": ""
}

/**
 * Calculate and log transaction size to help with debugging bulk transaction issues
 * @param transaction - The transaction to analyze
 * @param description - Description of the transaction for logging
 * @returns The size in bytes
 */
export function calculateTransactionSize(transaction: Transaction, description: string): number {
    const serializedSize = transaction.serialize().length;
    console.log(`${description} transaction size: ${serializedSize} bytes`);
    
    if (serializedSize > 1200) {
        console.warn(`⚠️  Transaction size (${serializedSize} bytes) is approaching the 1232 byte limit!`);
    }
    
    return serializedSize;
}

/**
 * Split a large array of instructions into batches that fit within transaction size limits
 * @param instructions - Array of instructions to batch
 * @param maxInstructionsPerBatch - Maximum instructions per batch (default: 10)
 * @returns Array of instruction batches
 */
export function batchInstructions(
    instructions: TransactionInstruction[], 
    maxInstructionsPerBatch: number = 10
): TransactionInstruction[][] {
    const batches: TransactionInstruction[][] = [];
    
    for (let i = 0; i < instructions.length; i += maxInstructionsPerBatch) {
        batches.push(instructions.slice(i, i + maxInstructionsPerBatch));
    }
    
    return batches;
}

/**
 * Execute multiple transactions with staggered timing to avoid network congestion
 * @param connection - Solana connection
 * @param transactions - Array of transactions to execute
 * @param signers - Array of signers for each transaction
 * @param interval - Time in milliseconds between transactions (default: 1000)
 * @returns Array of transaction signatures
 */
export async function executeStaggeredTransactions(
    connection: Connection,
    transactions: Transaction[],
    signers: Keypair[][],
    interval: number = 1000
): Promise<string[]> {
    const signatures: string[] = [];
    
    for (let i = 0; i < transactions.length; i++) {
        console.log(`Executing transaction ${i + 1}/${transactions.length}...`);
        
        const signature = await sendAndConfirmTransaction(
            connection,
            transactions[i],
            signers[i]
        );
        
        signatures.push(signature);
        console.log(`Transaction ${i + 1} completed: ${signature}`);
        
        // Wait between transactions (except for the last one)
        if (i < transactions.length - 1) {
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    
    return signatures;
}
