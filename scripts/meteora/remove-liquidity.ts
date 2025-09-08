import {
    Cluster,
    Transaction,
    Connection,
} from "@solana/web3.js";
import BN from "bn.js";
import DLMM from "@meteora-ag/dlmm";
import {
    getConnection,
    getPoolAddress,
    positionKeypair,
    owner,
    askQuestion,
} from "./config";

async function removeLiquidity() {
    const connection: Connection = await getConnection();
    const poolAddress = await getPoolAddress(connection);
    const dlmmPool = await DLMM.create(connection, poolAddress, {
        cluster: "devnet" as Cluster,
    });

    console.log("User:", owner.publicKey.toBase58());
    console.log("Position:", positionKeypair.publicKey.toBase58());

    const position = await dlmmPool.getPosition(positionKeypair.publicKey);
    if (!position) {
        throw new Error("❌ Position not exists");
    }

    const lower = position.positionData.lowerBinId;
    const upper = position.positionData.upperBinId;

    console.log("Removing liquidity bins:", lower, "-", upper);

    const percentStr = await askQuestion("Enter percent of liquidity to remove (e.g. 100 for all): ");
    const percent = parseFloat(percentStr);
    if (percent <= 0 || percent > 100) {
        throw new Error("❌ Invalid percent (must be >0 and <=100)");
    }

    const bps = new BN(Math.floor(percent * 100)); // 100% = 10000 bps
    try {
        const txs = await dlmmPool.removeLiquidity({
            user: owner.publicKey,
            position: positionKeypair.publicKey,
            fromBinId: lower,
            toBinId: upper,
            bps,
            shouldClaimAndClose: true,
            skipUnwrapSOL: false,
        });

        for (const tx of txs) {
            tx.feePayer = owner.publicKey;
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            tx.sign(owner as any);

            const txid = await connection.sendRawTransaction(tx.serialize());
            await connection.confirmTransaction(txid);
            console.log(`✅ Removed ${percent}% liquidity with tx:`, txid);
        }
    } catch (err) {
        console.error("❌ Remove liquidity failed:", err);
        throw err;
    }
}

removeLiquidity().catch(console.error);