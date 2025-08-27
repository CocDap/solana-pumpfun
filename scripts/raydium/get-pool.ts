import { connection, owner } from './config';
import { DEVNET_PROGRAM_ID, CpmmPoolInfoLayout } from '@raydium-io/raydium-sdk-v2';
import { PublicKey } from '@solana/web3.js';

async function getAllCpmmPools() {
  const cpmmPools: (ReturnType<typeof CpmmPoolInfoLayout.decode> & { poolId: PublicKey })[] = []

  const cpmmPoolsData = await connection.getProgramAccounts(
    DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
  )

  for (const acc of cpmmPoolsData) {
    try {
      const decoded = CpmmPoolInfoLayout.decode(acc.account.data)
      cpmmPools.push({ ...decoded, poolId: acc.pubkey })
    } catch (e) {
      // skip if decode fail
    }
  }

  return cpmmPools
}

async function getUserCreatedCpmmPools(user: PublicKey) {
  const allPools = await getAllCpmmPools()
  const userPools = allPools.filter((pool) => pool.poolCreator.equals(user))

  return userPools
}

// =================== Demo ===================
async function getPool() {
  console.log('Owner wallet:', owner.publicKey.toBase58())

  const allPools = await getAllCpmmPools()
  console.log('Total CPMM Pools found:', allPools.length)

  const userPools = await getUserCreatedCpmmPools(owner.publicKey)
  console.log('===============================')
  console.log('Pools created by user:', userPools.length)

  userPools.forEach((p, idx) => {
    console.log(`--- Pool #${idx + 1} ---`)
    console.log('PoolId:', p.poolId.toBase58())
    console.log('Base Mint:', p.mintA.toBase58())
    console.log('Quote Mint:', p.mintB.toBase58())
    console.log('LP Mint:', p.mintLp.toBase58())
    console.log('Creator:', p.poolCreator.toBase58())
  })
}

getPool().catch(console.error)
