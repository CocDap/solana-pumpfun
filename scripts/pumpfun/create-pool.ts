import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { PumpAmmSdk } from '@pump-fun/pump-swap-sdk';
import BN from 'bn.js';
import { wallet, connection } from './config';
import { TOKEN_PROGRAM_ID,
    NATIVE_MINT 
} from '@solana/spl-token'; 


const pumpAmmSdk = new PumpAmmSdk(connection);

const user = wallet.publicKey;
console.log('User address:', user.toString());

const quoteMint = new PublicKey('4YDAPGJo73wvXQFbVS2okoVz5pUfbfR4PePBZzKTC2C8'); 
const baseMint = new PublicKey(NATIVE_MINT); 

const initialBase = new BN(100 * 10**9); 
const initialQuote = new BN(1 * 10**9); 

async function createPool() {
  try {
    const index = 0;
    const creator = user;
    const createPoolSolanaState = await pumpAmmSdk.createPoolSolanaState(index, creator, baseMint, quoteMint);
    
    const initialPoolPrice = await pumpAmmSdk.createAutocompleteInitialPoolPrice(initialBase, initialQuote);
    console.log('Initial Pool Price:', initialPoolPrice.toString());
    
    const instructions = await pumpAmmSdk.createPoolInstructions(createPoolSolanaState, initialBase, initialQuote);

    const transaction = new Transaction().add(...instructions);
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = user;
    transaction.sign(wallet);

    const signature = await connection.sendTransaction(transaction, [wallet]);
    await connection.confirmTransaction(signature);
    
    console.log('Pool created! Signature:', signature);
    
    const poolKey = createPoolSolanaState.poolKey;
    console.log('Pool Key:', poolKey.toString());
    
  } catch (error) {
    console.error('Error creating pool:', error);
  }
}

createPool();