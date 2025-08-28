import { BN } from 'bn.js'
import { Percent } from '@raydium-io/raydium-sdk-v2'
import { initSdk, txVersion } from './config'
import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys } from '@raydium-io/raydium-sdk-v2'

async function removeLiquidity() {
  console.log('Starting removeLiquidity script...')

  const raydium = await initSdk()
  console.log('SDK initialized. Cluster:', raydium.cluster)

  const poolId = '3WoHTgokWfa1gxTtRE3Gf2CYqWSExaFW1BBHdb6ynPkv'

  let poolInfo: ApiV3PoolInfoStandardItemCpmm
  let poolKeys: CpmmKeys | undefined

  if (raydium.cluster === 'mainnet') {
    throw new Error('This pool is running on Devnet, please switch the cluster to devnet in config.ts')
  } else {
    console.log('Fetching pool info from RPC for poolId:', poolId)
    const data = await raydium.cpmm.getPoolInfoFromRpc(poolId)
    console.log('Pool info fetched from RPC')
    poolInfo = data.poolInfo
    poolKeys = data.poolKeys
  }

  if (!poolInfo || !poolKeys) {
    throw new Error('Pool info or keys not found')
  }
  console.log('Pool info & keys loaded')

  const lpAmount = new BN(1_000_000_000)
  console.log('LP Amount to burn:', lpAmount.toString())

  const slippage = new Percent(1, 100)
  console.log('Slippage set to:', slippage.toString())

  console.log('Building withdraw transaction...')
  const { execute } = await raydium.cpmm.withdrawLiquidity({
    poolInfo,
    poolKeys,
    lpAmount,
    txVersion,
    slippage,
    closeWsol: true,
  })

  console.log('Withdraw transaction built, sending...')

  const { txId } = await execute({ sendAndConfirm: true })
  console.log('Remove liquidity successful, transaction Id:', txId)

  process.exit(0)
}

removeLiquidity().catch((e) => {
  console.error('Remove liquidity error:', e)
  process.exit(1)
})
