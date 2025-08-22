import { Raydium, TxVersion } from '@raydium-io/raydium-sdk-v2';
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import { getKeypairFromFile } from '../utils';
import bs58 from 'bs58';
import os from 'os';

export const owner = getKeypairFromFile(`${os.homedir()}/.config/solana/id.json`);
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
export const txVersion = TxVersion.V0;

let raydium: Raydium | undefined;
export const initSdk = async () => {
  if (raydium) return raydium;
  console.log('Connecting to devnet...');
  raydium = await Raydium.load({
    connection,
    owner: owner,
    cluster: 'devnet',
    disableFeatureCheck: true,
    disableLoadToken: false,
    blockhashCommitment: 'finalized',
  });
  return raydium;
};