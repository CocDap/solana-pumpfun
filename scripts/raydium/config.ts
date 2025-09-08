import { Raydium, TxVersion } from '@raydium-io/raydium-sdk-v2';
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import { getKeypairFromFile } from '../utils';
import bs58 from 'bs58';
import os from 'os';
import readline from 'readline';
import BN from 'bn.js';
import Decimal from 'decimal.js';

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


export async function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve =>
    rl.question(query, ans => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

export function formatAmount(raw: BN, decimals: number, precision = 6): string {
  const dec = new Decimal(raw.toString()).div(new Decimal(10).pow(decimals));
  return dec.toFixed(precision);
}
