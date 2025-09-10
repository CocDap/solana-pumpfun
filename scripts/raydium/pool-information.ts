import { PublicKey } from '@solana/web3.js';
import { initSdk } from './config';
import BN from 'bn.js';

async function checkPool() {
  try {
    const raydium = await initSdk();
    const poolId = new PublicKey('BzcM5yWGRFzqDnaZnG8L8PFNh8C2qo4Aw3pSw7BohZLa');
    const pool = await raydium.cpmm.getPoolInfoFromRpc(poolId.toString());

    // Pool Information Section
    console.log('Pool Information');
    console.log('----------------');
    console.log(`Pool: ${pool.poolInfo.mintA.address}/${pool.poolInfo.mintB.address}`);
    console.log(`DEX: Raydium`);
    console.log(`TVL: $${pool.poolInfo.tvl.toFixed(2)}`);
    console.log(`APR: ${pool.poolInfo.day.apr}%`);

    // Position Preview Section
    console.log('\nPosition Preview');
    console.log('----------------');
    const solAmount = new BN(pool.rpcData.vaultAAmount, 16).toNumber() / Math.pow(10, pool.poolInfo.mintA.decimals);
    const tokenAmount = new BN(pool.rpcData.vaultBAmount, 16).toNumber() / Math.pow(10, pool.poolInfo.mintB.decimals);
    const poolShare = ((new BN(pool.rpcData.lpAmount, 16).toNumber() / 10980000000) * 100).toFixed(2);
    const estValue = (new BN(pool.rpcData.vaultAAmount, 16).add(new BN(pool.rpcData.vaultBAmount, 16)).toNumber() / Math.pow(10, pool.poolInfo.mintA.decimals));
    console.log(`SOL Amount: ${solAmount}`);
    console.log(`Token Amount: ${tokenAmount}`);
    console.log(`Pool Share: ${poolShare}%`);
    console.log(`Est. Value: $${estValue.toFixed(2)}`);

  } catch (error: any) {
    console.error('Error checking pool:', error.message);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
  }
}

checkPool();