import { PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";


export const baseMint = new PublicKey("4YDAPGJo73wvXQFbVS2okoVz5pUfbfR4PePBZzKTC2C8"); // custom token
export const quoteMint = new PublicKey(NATIVE_MINT); // WSOL
export const poolKey = new PublicKey("B8kkwMpzgHPngm6YuMp5DramDVH6Q6hbuC4cKCnyDak5");