import { Percent } from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import { initSdk, connection, owner, txVersion, askQuestion } from './config';
import {
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createSyncNativeInstruction,
} from '@solana/spl-token';
import Decimal from 'decimal.js';

console.log("Wallet: ", owner.publicKey.toBase58());

async function addLiquidity() {
  try {
    const amountInput = await askQuestion("Input amount : ");
    const slippageInput = await askQuestion("Slippage (%): ");
    const baseInInput = await askQuestion("Choose input token (true = WSOL, false = custom token): ");

    const slippage = new Percent(Number(slippageInput), 100);
    const baseIn = baseInInput.toLowerCase() === "true";

    console.log(`\n=== User Input ===`);
    console.log(`Input Amount: ${amountInput}`);
    console.log(`Base In : ${baseIn ? "WSOL" : "Custom Token"}`);
    console.log(`Slippage: ${slippageInput}%`);
    console.log("==================\n");

    const raydium = await initSdk();
    const poolId = new PublicKey('H1iMfmd6D6fTzfrQDe8inxhN9VH2T93wmYkBzthWeneK');
    const pool = await raydium.cpmm.getPoolInfoFromRpc(poolId.toString());

    if (!pool || pool.poolInfo.type !== 'Standard') {
      throw new Error('CPMM pool not found.');
    }

    const poolInfo = {
      ...pool.poolInfo,
      authority: pool.poolKeys.authority,
      config: { ...pool.poolInfo.config },
    };

    console.log('=== Pool Info ===');
    console.dir(poolInfo, { depth: null });

    if (!pool.poolKeys?.authority) throw new Error('Pool authority is undefined.');
    if (new BN(pool.rpcData.baseReserve, 16).isZero() || new BN(pool.rpcData.quoteReserve, 16).isZero()) {
      throw new Error('Pool has no initial liquidity.');
    }

    const mintA = new PublicKey(poolInfo.mintA.address);
    const mintB = new PublicKey(poolInfo.mintB.address);

    const ownerPubkey = owner.publicKey;
    const ataA = await getAssociatedTokenAddress(
      mintA,
      ownerPubkey,
      false,
      poolInfo.mintA.programId === TOKEN_2022_PROGRAM_ID.toString()
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID
    );
    const ataB = await getAssociatedTokenAddress(
      mintB,
      ownerPubkey,
      false,
      poolInfo.mintB.programId === TOKEN_2022_PROGRAM_ID.toString()
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction();

    // check ATA mintA
    const ataAInfo = await connection.getAccountInfo(ataA);
    if (!ataAInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          ownerPubkey,
          ataA,
          ownerPubkey,
          mintA,
          poolInfo.mintA.programId === TOKEN_2022_PROGRAM_ID.toString()
            ? TOKEN_2022_PROGRAM_ID
            : TOKEN_PROGRAM_ID
        )
      );
    }

    // check ATA mintB
    const ataBInfo = await connection.getAccountInfo(ataB);
    if (!ataBInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          ownerPubkey,
          ataB,
          ownerPubkey,
          mintB,
          poolInfo.mintB.programId === TOKEN_2022_PROGRAM_ID.toString()
            ? TOKEN_2022_PROGRAM_ID
            : TOKEN_PROGRAM_ID
        )
      );
    }

    if (poolInfo.mintA.symbol === 'WSOL' || poolInfo.mintB.symbol === 'WSOL') {
      const wsolATA = poolInfo.mintA.symbol === 'WSOL' ? ataA : ataB;
      console.log(`Wrapping ${amountInput} SOL into WSOL...`);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: ownerPubkey,
          toPubkey: wsolATA,
          lamports: new BN(Math.floor(parseFloat(amountInput) * 1e9)).toNumber(),
        }),
        createSyncNativeInstruction(wsolATA)
      );
    }

    if (transaction.instructions.length > 0) {
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = ownerPubkey;
      const txId = await connection.sendTransaction(transaction, [owner]);
      await connection.confirmTransaction(txId, 'confirmed');
      console.log('Setup transaction sent:', txId);
    }

    const accountA = await getAccount(
      connection,
      ataA,
      'confirmed',
      poolInfo.mintA.programId === TOKEN_2022_PROGRAM_ID.toString()
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID
    );
    const accountB = await getAccount(
      connection,
      ataB,
      'confirmed',
      poolInfo.mintB.programId === TOKEN_2022_PROGRAM_ID.toString()
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID
    );

    console.log('Sending add liquidity transaction...');
    const addLiquidityResult = await raydium.cpmm.addLiquidity({
      poolInfo,
      poolKeys: pool.poolKeys,
      inputAmount: new BN(Math.floor(parseFloat(amountInput) * 1e9)),
      baseIn,
      slippage,
      config: {
        bypassAssociatedCheck: false,
        checkCreateATAOwner: true,
      },
      txVersion,
    });

    const { execute } = addLiquidityResult;
    const { txId } = await execute({ sendAndConfirm: true });
    console.log('Liquidity added! TxId:', txId);

    process.exit(0);
  } catch (error) {
    console.error('Error while adding liquidity:', error);
    if (error.logs) console.error('Logs:', error.logs);
    process.exit(1);
  }
}

addLiquidity();
