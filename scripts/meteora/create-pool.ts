import { Cluster, Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import DLMM, { ActivationType } from "@meteora-ag/dlmm";
import { NATIVE_MINT } from "@solana/spl-token";
import {
    hasAlphaVault,
    getPoolAddress,
    binStep,
    feeBps,
    WSOL_MINT,
    CUSTOM_TOKEN_MINT,
    INITIAL_PRICE,
    connection,
    activationType,
    owner,
} from "./config";

async function main() {
    console.log("Starting DLMM Pool creation...");

    const activeIdNum = DLMM.getBinIdFromPrice(INITIAL_PRICE, binStep.toNumber(), true);
    const activeId = new BN(activeIdNum);

    console.log(`Initial Price: ${INITIAL_PRICE}`);
    console.log(`BinStep: ${binStep.toNumber()}`);
    console.log(`ActiveId: ${activeId}`);

    // Create pool transaction
    const tx = await DLMM.createCustomizablePermissionlessLbPair2(
        connection,
        binStep,
        CUSTOM_TOKEN_MINT,
        WSOL_MINT,
        activeId,
        feeBps,
        activationType,
        hasAlphaVault,
        owner.publicKey
    );

    // Send transaction
    tx.feePayer = owner.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const sig = await connection.sendTransaction(tx, [owner]);
    await connection.confirmTransaction(sig, "confirmed");

    console.log("Pool created successfully.");
    console.log("Transaction Signature:", sig);

    const poolAddress = await getPoolAddress(connection);
    console.log("Pool Address:", poolAddress);

}

main().catch((err) => console.error("Error while creating pool:", err));