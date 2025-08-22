import { Percent } from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import { initSdk, connection, owner, txVersion } from './config';
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

console.log("Wallet: ", owner.publicKey.toBase58());

async function addLiquidity() {
  try {
    const raydium = await initSdk();
    const poolId = new PublicKey('3WoHTgokWfa1gxTtRE3Gf2CYqWSExaFW1BBHdb6ynPkv');
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

    if (!pool.poolKeys?.authority) {
      throw new Error('Pool authority is undefined.');
    }
    if (new BN(pool.rpcData.baseReserve, 16).isZero() || new BN(pool.rpcData.quoteReserve, 16).isZero()) {
      throw new Error('Pool has no initial liquidity.');
    }

    // Lấy mint A và B trực tiếp từ poolInfo
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
    const inputAmount = new BN(100_000_000); // 0.1 SOL
    const baseIn = true;
    const slippage = new Percent(1, 100); // 1%

    // Tạo ATA nếu chưa có
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

    // Nếu mint là WSOL thì wrap SOL
    if (poolInfo.mintA.symbol === 'WSOL' || poolInfo.mintB.symbol === 'WSOL') {
      const wsolATA = poolInfo.mintA.symbol === 'WSOL' ? ataA : ataB;
      console.log(`Wrapping ${inputAmount.toNumber() / 1e9} SOL into WSOL...`);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: ownerPubkey,
          toPubkey: wsolATA,
          lamports: inputAmount.toNumber(),
        }),
        createSyncNativeInstruction(wsolATA)
      );
    }

    // Gửi setup transaction (ATA + wrap SOL)
    if (transaction.instructions.length > 0) {
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = ownerPubkey;
      const txId = await connection.sendTransaction(transaction, [owner]);
      await connection.confirmTransaction(txId, 'confirmed');
      console.log('Setup transaction sent:', txId);
    }

    // Kiểm tra balance
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
    console.log(`Balance mintA: ${accountA.amount.toString()}`);
    console.log(`Balance mintB: ${accountB.amount.toString()}`);

    // Gửi add liquidity transaction
    console.log('Sending add liquidity transaction...');
    const addLiquidityResult = await raydium.cpmm.addLiquidity({
      poolInfo,
      poolKeys: pool.poolKeys,
      inputAmount,
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
