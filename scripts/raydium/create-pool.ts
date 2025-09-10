import { DEVNET_PROGRAM_ID, getCpmmPdaAmmConfigId } from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import { initSdk, connection, owner, txVersion, askQuestion } from './config';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    getAccount,
    NATIVE_MINT
} from '@solana/spl-token';

console.log("Wallet: ", owner.publicKey.toBase58());

async function createPool() {
    try {
        const raydium = await initSdk();
        const customMint = new PublicKey('8UjqFBMAimzQmqAtsuZTEZ2unCtBKdQWutQeAxqmyiSJ');
        const wsolMint = new PublicKey(NATIVE_MINT);
        const customDecimals = 9;
        const wsolDecimals = 9;

        const ownerPubkey = owner.publicKey;

        // Ensure ATA exists
        const customTokenATA = await getAssociatedTokenAddress(customMint, ownerPubkey, false, TOKEN_2022_PROGRAM_ID);
        const wsolATA = await getAssociatedTokenAddress(wsolMint, ownerPubkey, false, TOKEN_PROGRAM_ID);
        const transaction = new Transaction();

        if (!(await connection.getAccountInfo(customTokenATA))) {
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
        if (!(await connection.getAccountInfo(wsolATA))) {
            console.log('Creating ATA for WSOL...');
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    ownerPubkey,
                    wsolATA,
                    ownerPubkey,
                    wsolMint,
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

        console.log('Checking balances...');
        const customTokenAccount = await getAccount(connection, customTokenATA, 'confirmed', TOKEN_2022_PROGRAM_ID);
        const wsolTokenAccount = await getAccount(connection, wsolATA, 'confirmed', TOKEN_PROGRAM_ID);
        console.log(`Custom token balance: ${customTokenAccount.amount.toString()}`);
        console.log(`WSOL balance: ${wsolTokenAccount.amount.toString()}`);

        // Dynamic user input
        const amountAInput = await askQuestion("Enter amount for custom token (mintA): ");
        const amountBInput = await askQuestion("Enter amount for WSOL (mintB): ");

        // Convert to BN with decimals
        const customAmountBN = new BN(Math.floor(parseFloat(amountAInput) * 10 ** customDecimals).toString());
        const wsolAmountBN = new BN(Math.floor(parseFloat(amountBInput) * 10 ** wsolDecimals).toString());

        const isSorted = customMint.toBuffer().compare(wsolMint.toBuffer()) < 0;
        const [mintA, mintB, mintAAmount, mintBAmount] = isSorted
            ? [customMint, wsolMint, customAmountBN, wsolAmountBN]
            : [wsolMint, customMint, wsolAmountBN, customAmountBN];

        console.log(`Pool price (approx): ${mintBAmount.toNumber() / mintAAmount.toNumber()}`);

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
            mintAAmount,
            mintBAmount,
            startTime: new BN(0),
            feeConfig: feeConfigs[0],
            associatedOnly: false,
            ownerInfo: { useSOLBalance: true },
            txVersion,
        });

        console.log('Executing pool creation...');
        const { txId } = await execute({ sendAndConfirm: true });
        console.log('Pool created with txId:', txId);
        console.log('Pool ID:', extInfo.address.poolId.toBase58());

        process.exit(0);
    } catch (error) {
        console.error("Error creating pool:", error);
    }
}

createPool();
