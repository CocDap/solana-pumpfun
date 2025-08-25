import { DEVNET_PROGRAM_ID, getCpmmPdaAmmConfigId, ApiV3Token } from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import { initSdk, connection, owner, txVersion } from './config';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    getAccount,
    NATIVE_MINT
} from '@solana/spl-token';

import { Wallet } from '@coral-xyz/anchor';

console.log("Wallet: ", owner.publicKey.toBase58());

async function createPool() {
    try {
        const raydium = await initSdk();
        const customMint = new PublicKey('7HhHBdwxPcpfPYrVzXVnuMjrPsRnXrTYp5gQs2qkFkSw');
        const wsolMint = new PublicKey(NATIVE_MINT);
        const customDecimals = 9;
        const wsolDecimals = 9;

        const ownerPubkey = owner.publicKey;

        const customTokenATA = await getAssociatedTokenAddress(customMint, ownerPubkey, false, TOKEN_2022_PROGRAM_ID);
        const wsolATA = await getAssociatedTokenAddress(wsolMint, ownerPubkey, false, TOKEN_PROGRAM_ID);
        const transaction = new Transaction();
        const customTokenAccountInfo = await connection.getAccountInfo(customTokenATA);
        if (!customTokenAccountInfo) {
            console.log('Creating ATA for custom token...');
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    ownerPubkey,
                    customTokenATA,
                    ownerPubkey,
                    customMint,
                    TOKEN_2022_PROGRAM_ID
                )
            );
        }
        const wsolAccountInfo = await connection.getAccountInfo(wsolATA);
        if (!wsolAccountInfo) {
            console.log('Creating ATA for WSOL...');
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    ownerPubkey,
                    wsolATA,
                    ownerPubkey,
                    wsolATA,
                    TOKEN_PROGRAM_ID
                )
            );
        }

        if (transaction.instructions.length > 0) {
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = ownerPubkey;
            const signature = await connection.sendTransaction(transaction, [owner], { skipPreflight: false });
            await connection.confirmTransaction(signature, 'confirmed');
            console.log('ATA(s) created with transaction:', signature);
        }
        console.log('Checking token balances...');
        console.log('Custom token ATA:', customTokenATA.toBase58());
        console.log('WSOL ATA:', wsolATA.toBase58());
        const customTokenAccount = await getAccount(connection, customTokenATA, 'confirmed', TOKEN_2022_PROGRAM_ID);
        const wsolTokenAccount = await getAccount(connection, wsolATA, 'confirmed', TOKEN_PROGRAM_ID);
        console.log(`Custom token ATA balance: ${customTokenAccount.amount.toString()} tokens`);
        console.log(`WSOL ATA balance: ${wsolTokenAccount.amount.toString()} lamports`);

        const ownerInfo = { useSOLBalance: true };
        const isSorted = customMint.toBuffer().compare(wsolMint.toBuffer()) < 0;
        console.log(`Token pair order: ${isSorted ? 'Correct (mintA < mintB)' : 'Incorrect (mintA > mintB), swapping...'}`);
        const [mintA, mintB, mintAAmount, mintBAmount] = isSorted
            ? [customMint, wsolMint, new BN(1_000_000), new BN(100_000_000)]
            : [wsolMint, customMint, new BN(100_000_000), new BN(1_000_000)];

        const feeConfigs = [
            {
                id: getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, 0).publicKey.toBase58(),
                index: 0,
                protocolFeeRate: 120000,
                tradeFeeRate: 2500,
                fundFeeRate: 40000,
                createPoolFee: '1000000',
                creatorFeeRate: 0
            },
        ];
        const { execute, extInfo } = await raydium.cpmm.createPool({
            programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
            poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
            mintA: {
                address: mintA.toBase58(),
                decimals: mintA.equals(customMint) ? customDecimals : wsolDecimals,
                programId: mintA.equals(customMint)
                    ? TOKEN_2022_PROGRAM_ID.toString()
                    : TOKEN_PROGRAM_ID.toString(),
            },
            mintB: {
                address: mintB.toBase58(),
                decimals: mintB.equals(customMint) ? customDecimals : wsolDecimals,
                programId: mintB.equals(customMint)
                    ? TOKEN_2022_PROGRAM_ID.toString()
                    : TOKEN_PROGRAM_ID.toString(),
            },
            mintAAmount: mintAAmount,
            mintBAmount: mintBAmount,
            startTime: new BN(0),
            feeConfig: feeConfigs[0],
            associatedOnly: false,
            ownerInfo,
            txVersion,
        });

        console.log('Executing pool creation transaction...');
        const { txId } = await execute({ sendAndConfirm: true });
        console.log('Pool created with txId:', txId);
        console.log('Pool ID:', extInfo.address.poolId.toBase58());

        process.exit(0);
    }
    catch (error) {

    }
}
createPool()
