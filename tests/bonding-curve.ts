import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BondingCurve } from "../target/types/bonding_curve"
import { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, ComputeBudgetProgram, SYSVAR_RENT_PUBKEY, clusterApiUrl, TransactionInstruction } from "@solana/web3.js"

import { BN } from "bn.js";
import { ASSOCIATED_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import * as os from "os";
import { getPDAs, getKeypairFromFile, getKeypairFromSecretKey, METEORA_PROGRAM_ID, METEORA_VAULT_PROGRAM_ID, SOL_MINT, getMeteoraPDA, getVaultPDA, getProtocolTokenFeePDA, METAPLEX_PROGRAM, deriveMintMetadata, TEST_CONFIG, getAssociatedTokenAccount, createProgram, getPumpSwapPDA, PUMP_SWAP_PROGRAM_ID, accountExists, CURVE_CONFIGURATION_SEED, getPoolTokenAccount2022, getUserTokenAccount2022, getAllocationPDAs, getWhitelistLaunchPDAs, getPauseLaunchPDAs, getFairLaunchPDAs } from "./utils";
import { getOrCreateATAInstruction } from "@mercurial-finance/vault-sdk/dist/cjs/src/vault/utils";
import { derivePoolAddressWithConfig } from "@mercurial-finance/dynamic-amm-sdk/dist/cjs/src/amm/utils";
import VaultImpl from "@mercurial-finance/vault-sdk";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_2022_PROGRAM_ID, getAccount, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
const connection = new Connection(clusterApiUrl("devnet"), 'confirmed')


describe("bonding_curve", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const signer = provider.wallet as NodeWallet;
  console.log("Signer address:", signer.publicKey.toBase58());
  const program = anchor.workspace.BondingCurve as Program<BondingCurve>;
  // make sure your key in the correct dir 
  let feeRecipient = getKeypairFromFile(`${os.homedir()}/.config/solana/id2.json`);
  let feeRecipient2 = getKeypairFromFile(`${os.homedir()}/.config/solana/id3.json`);

  const buyer = new Keypair();

  console.log("Fee address1 :", feeRecipient.publicKey.toBase58());
  console.log("Fee address2 :", feeRecipient2.publicKey.toBase58());
  // get existing TokenMint and TokenATA or we can create new token 
  // const mint = new PublicKey("3YChZhQqYpriRAiNunKLRxF5jnTuj97RE4SHBBHNAJsu");
  //5ZoKnNrLwDw5FSgjuA7S7uSEsYPDHrhPzQ7bUTZxdtSa
  const mint = new PublicKey("3Buq8pUR1bZxsFVig2B8bdWtmwxXrStGwYtcXUipHg4e");
  const mintToken2022 = new PublicKey("AemQbKzYPhZmx3gM1ehc6q9MzDBSmcSKTCii74x2ACsx")
  const mintExample = new PublicKey("9QXB2HnQG4nyXm6YfW7hagCuA2yRt8iG8CJc5fQX1C8")
  const multisig = new PublicKey("97S2XVwgi9fiHJQst9qkN1EeVKbXYy1LUS3MDL3BfxpN");

  const mintLatest = new PublicKey("91c2ENi1DrFLJBN6vwA2G3vFopXsrF9s8nfMpyF5jgCz");

  const feeRecipient3 = Keypair.generate();
  const governance = Keypair.generate();
  const { vaultProgram } = createProgram(connection);

  // it("Initialize the contract - SIMULATION ONLY", async () => {
  //   try {

  
  //     // Fee Percentage : 100 = 1%
  //     const feePercentage = new BN(100);
  //     const initialQuorum = new BN(500);
  //     const targetLiquidity = new BN(1000000000);
  //     const daoQuorum = new BN(500);
  //     // 0 is linear, 1 is quadratic
  //     const bondingCurveType = 0;
  //     const maxTokenSupply = new BN(10000000000);
  //     const liquidityLockPeriod = new BN(60); // 30 days
  //     const liquidityPoolPercentage = new BN(50); // 50%
  //     const initialReserve = new BN(100000); // 0.0000001 SOL
  //     const initialSupply = new BN(100_000_000_000); // 10000 SPL tokens with 6 decimals 
  //     const reserveRatio = new BN(5000); // 50%
      // let recipients = [
      //   {
      //     address: feeRecipient.publicKey,
      //     share: 10000,
      //     amount: new BN(0),
      //     lockingPeriod: new BN(60000),
      //   },
      // ]
  //     const {curveConfig, bondingCurve, poolTokenAccount, poolSolVault, userTokenAccount } = getPDAs(signer.publicKey, mintLatest)
  
  //     console.log("=== DRY RUN SIMULATION ===");
  //     console.log("curveConfig", curveConfig.toBase58())
  //     console.log("poolTokenAccount", poolTokenAccount.toBase58())
  //     console.log("poolSolVault", poolSolVault.toBase58())
  //     console.log("userTokenAccount", userTokenAccount.toBase58())
  //     console.log("bondingCurve", bondingCurve.toBase58())
  //     console.log("mintExample", mintExample.toBase58())
      
  //     // Log the parameters being used
  //     console.log("\n=== PARAMETERS ===");
  //     console.log("Initial Reserve:", initialReserve.toString(), "lamports");
  //     console.log("Initial Supply:", initialSupply.toString(), "tokens");
  //     console.log("Reserve Ratio:", reserveRatio.toString(), "basis points (50%)");
  //     console.log("Token Decimals: 6");
      
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           // @ts-ignore
  //           .createPool(signer.payer.publicKey, feePercentage, initialQuorum, targetLiquidity, governance.publicKey, daoQuorum, bondingCurveType, maxTokenSupply, liquidityLockPeriod, liquidityPoolPercentage, initialReserve, initialSupply, recipients, reserveRatio)
  //           .accountsStrict({
  //             bondingCurveConfiguration: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mintLatest,
  //             poolTokenAccount: poolTokenAccount,
  //             poolSolVault: poolSolVault,
  //             userTokenAccount: userTokenAccount,
  //             admin: signer.payer.publicKey,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             rent: SYSVAR_RENT_PUBKEY,
  //             systemProgram: SystemProgram.programId,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  
  //     // Sign the transaction for simulation
  //     tx.sign(signer.payer);
  
  //     console.log("\n=== SIMULATING TRANSACTION ===");
      
  //     // Simulate the transaction (dry-run)
  //     const simulation = await connection.simulateTransaction(tx);
  
  //     console.log("✅ Simulation successful!");
  //     console.log("Logs:", simulation.value.logs);
  //     console.log("Units consumed:", simulation.value.unitsConsumed);
  //     console.log("Return data:", simulation.value.returnData);
      
  //     if (simulation.value.err) {
  //       console.log("❌ Simulation error:", simulation.value.err);
  //     } else {
  //       console.log("🎉 Transaction would succeed!");
  //     }

  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true, commitment: "confirmed" })
  //     console.log("Successfully created pool with SPL token : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  
  //   } catch (error) {
  //     console.log("❌ Error during simulation:", error);
  //   }
  // });


  it("Set target liquidity ", async () => {
    try {

      const {curveConfig, bondingCurve, poolTokenAccount, poolSolVault, userTokenAccount } = getPDAs(signer.publicKey, mintLatest)
      const newTargetLiquidity = new BN(10000000000);
      const tx = new Transaction()
        .add(
          await program.methods
            // @ts-ignore
            .setTargetLiquidity(newTargetLiquidity)
            .accountsStrict({
              bondingCurveConfiguration: curveConfig,
              globalAdmin: signer.publicKey,
            })
            .instruction()
        )
      tx.feePayer = signer.payer.publicKey
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  
      // Sign the transaction for simulation
      tx.sign(signer.payer);
  
      console.log("\n=== SIMULATING TRANSACTION ===");
      
      // Simulate the transaction (dry-run)
      const simulation = await connection.simulateTransaction(tx);
  
      console.log("✅ Simulation successful!");
      console.log("Logs:", simulation.value.logs);
      console.log("Units consumed:", simulation.value.unitsConsumed);
      console.log("Return data:", simulation.value.returnData);
      
      if (simulation.value.err) {
        console.log("❌ Simulation error:", simulation.value.err);
      } else {
        console.log("🎉 Transaction would succeed!");
      }

      const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true, commitment: "confirmed" })
      console.log("Successfully created pool with SPL token : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  
    } catch (error) {
      console.log("❌ Error during simulation:", error);
    }
  });

  // it(" create bonding curve pool with SPL token ", async () => {

  //   try {


  //     const { curveConfig, bondingCurve, poolTokenAccount, poolSolVault, userTokenAccount } = getPDAs(signer.payer.publicKey, mint)
  //     console.log("Bonding Curve : ", bondingCurve.toBase58())
  //     // console.log("Pool Token Account : ", poolTokenAccount.address)
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .createPool()
  //           .accountsStrict({
  //             bondingCurveConfiguration: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mint,
  //             poolTokenAccount: poolTokenAccount,
  //             poolSolVault: poolSolVault,
  //             userTokenAccount: userTokenAccount,
  //             user: signer.payer.publicKey,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             rent: SYSVAR_RENT_PUBKEY,
  //             systemProgram: SystemProgram.programId,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true, commitment: "confirmed" })
  //     console.log("Successfully created pool with SPL token : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //     // let bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurve)
  //     // console.log("Bonding Curve Data : ", bondingCurveAccount)
  //   } catch (error) {
  //     console.log("Error in create pool :", error)
  //   }

  // })


  // it(" create bonding curve pool with Token 2022  ", async () => {

  //   try {


  //     const { bondingCurve } = getPDAs(signer.payer.publicKey, mintToken2022)
  //     console.log("Bonding Curve : ", bondingCurve.toBase58())
  //     const poolTokenAccount = await getPoolTokenAccount2022(signer.payer, mintToken2022, bondingCurve)
  //     console.log("Pool Token Account : ", poolTokenAccount.address)
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .createPool()
  //           .accountsStrict({
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mintToken2022,
  //             poolTokenAccount: poolTokenAccount.address,
  //             payer: signer.payer.publicKey,
  //             tokenProgram: TOKEN_2022_PROGRAM_ID,
  //             rent: SYSVAR_RENT_PUBKEY,
  //             systemProgram: SystemProgram.programId,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true, commitment: "confirmed" })
  //     console.log("Successfully created pool with token 2022 : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //     // let bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurve)
  //     // console.log("Bonding Curve Data : ", bondingCurveAccount)
  //   } catch (error) {
  //     console.log("Error in create pool :", error)
  //   }

  // })


  // it(" add fee recipients", async () => {

  //   try {


  //     const { curveConfig } = getPDAs(signer.payer.publicKey, mint)
  //     console.log("Bonding Curve : ", curveConfig.toBase58())
  //     let recipients = [
  //       {
  //         address: feeRecipient.publicKey,
  //         // 40%
  //         share: 4000,
  //         amount: new BN(0),
  //         lockingPeriod: new BN(60000),
  //       },
  //       {
  //         address: feeRecipient2.publicKey,
  //         // 40%
  //         share: 4000,
  //         amount: new BN(0),
  //         lockingPeriod: new BN(60000),
  //       },
  //       {
  //         address: multisig,
  //         // 20%
  //         share: 2000,
  //         amount: new BN(0),
  //         lockingPeriod: new BN(60000),
  //       }
  //     ]
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .addFeeRecipients(recipients)
  //           .accountsStrict({
  //             bondingCurveConfiguration: curveConfig,
  //             admin: signer.payer.publicKey,
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully add fee recipients : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //   } catch (error) {
  //     console.log("Error in add fee recipients :", error)
  //   }

  // })


  // it(" add liquidity to the pool by user created a pool with SPL token ", async () => {

  //   try {
  //     const { curveConfig, bondingCurve, poolSolVault, poolTokenAccount, userTokenAccount } =  getPDAs(signer.payer.publicKey, mint)
  //     console.log("Curve Config : ", curveConfig.toBase58())
  //     console.log("Bonding Curve : ", bondingCurve.toBase58())
  //     console.log("Pool Token Account : ", poolTokenAccount.toBase58())
  //     let solAmount = new BN(100000000); // 0.1 SOL 
  //     let tokenAmount = new BN(100000000000); // 100 SPL token 
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .addLiquidity(solAmount, tokenAmount)
  //           .accountsStrict({
  //             bondingCurveConfiguration: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mint,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             poolSolVault: poolSolVault,
  //             poolTokenAccount: poolTokenAccount,
  //             userTokenAccount: userTokenAccount,
  //             user: signer.payer.publicKey,
  //             systemProgram: SystemProgram.programId
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true})
  //     console.log("Successfully add liquidity : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //     // const userBalance = (await connection.getTokenAccountBalance(userTokenAccount)).value.uiAmount
  //     // const poolBalance = (await connection.getTokenAccountBalance(poolTokenAccount)).value.uiAmount
  //   } catch (error) {
  //     console.log("Error in add liquidity :", error)
  //   }
  // })

  // it(" add liquidity to the pool by user created a pool with Token 2022 ", async () => {

  //   try {
  //     const { curveConfig, bondingCurve, poolSolVault } =  getPDAs(signer.payer.publicKey, mintToken2022)
  //     console.log("Curve Config : ", curveConfig.toBase58())
  //     console.log("Bonding Curve : ", bondingCurve.toBase58())

  //     const poolTokenAccount = await getPoolTokenAccount2022(signer.payer, mintToken2022, bondingCurve)
  //     const userTokenAccount = await getUserTokenAccount2022(signer.payer, mintToken2022, signer.payer.publicKey)

  //     let amount = new BN(100000000); // 100 SPL token 
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .addLiquidity(amount)
  //           .accountsStrict({
  //             dexConfigurationAccount: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mintToken2022,
  //             tokenProgram: TOKEN_2022_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             poolSolVault: poolSolVault,
  //             poolTokenAccount: poolTokenAccount.address,
  //             userTokenAccount: userTokenAccount.address,
  //             user: signer.payer.publicKey,
  //             systemProgram: SystemProgram.programId
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully add liquidity : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //     // const userBalance = (await connection.getTokenAccountBalance(userTokenAccount)).value.uiAmount
  //     // const poolBalance = (await connection.getTokenAccountBalance(poolTokenAccount)).value.uiAmount
  //     // console.log("User Balance : ", userBalance)
  //     // console.log("Pool Balance : ", poolBalance)
  //   } catch (error) {
  //     console.log("Error in add liquidity :", error)
  //   }
  // })



  // it(" migrate meteora pool", async () => {

  //   try {
  //     const { curveConfig, bondingCurve, poolSolVault, poolTokenAccount, userTokenAccount } = getPDAs(signer.payer.publicKey, mint)
  //     // const { pool, lpMint, payerPoolLp } = await getMeteoraPDA(SOL_MINT, mint, signer.payer.publicKey);
  //     const { aVault, aTokenVault, aLpMintPda, bVault, bTokenVault, bLpMintPda } = getVaultPDA(SOL_MINT, mint);
  //     console.log("aTokenVault", aTokenVault.toBase58());
  //     console.log("aLpMintPda", aLpMintPda.toBase58());
  //     console.log("aVault", aVault.toBase58());
  //     console.log("bTokenVault", bTokenVault.toBase58());
  //     console.log("bLpMintPda", bLpMintPda.toBase58());
  //     console.log("bVault", bVault.toBase58());

  //     let aVaultLpMint = aLpMintPda;
  //     let bVaultLpMint = bLpMintPda;

  //     // test pool key 
  //     const pool = derivePoolAddressWithConfig(SOL_MINT, mint, TEST_CONFIG, METEORA_PROGRAM_ID);
  //     console.log("pool", pool.toBase58());

  //     const [lpMint] = PublicKey.findProgramAddressSync(
  //       [Buffer.from("lp_mint"), pool.toBuffer()],
  //       METEORA_PROGRAM_ID,
  //     );
  //     console.log("lpMint", lpMint.toBase58());

  //     const payerPoolLp = getAssociatedTokenAccount(lpMint, signer.payer.publicKey);
  //     console.log("payerPoolLp", payerPoolLp.toBase58());

  //     let preInstructions: Array<TransactionInstruction> = [];

  //     const [aVaultAccount, bVaultAccount] = await Promise.all([
  //       vaultProgram.account.vault.fetchNullable(aVault),
  //       vaultProgram.account.vault.fetchNullable(bVault),
  //     ]);

  //     if (!aVaultAccount) {
  //       const createVaultAIx = await VaultImpl.createPermissionlessVaultInstruction(provider.connection, signer.payer.publicKey, SOL_MINT);
  //       createVaultAIx && preInstructions.push(createVaultAIx);

  //     } else {
  //       aVaultLpMint = aVaultAccount?.lpMint; // Old vault doesn't have lp mint pda
  //     }
  //     if (!bVaultAccount) {
  //       const createVaultBIx = await VaultImpl.createPermissionlessVaultInstruction(provider.connection, signer.payer.publicKey, mint);
  //       createVaultBIx && preInstructions.push(createVaultBIx);

  //     } else {
  //       bVaultLpMint = bVaultAccount?.lpMint; // Old vault doesn't have lp mint pda
  //     }


  //     const [[aVaultLp], [bVaultLp]] = [
  //       PublicKey.findProgramAddressSync([aVault.toBuffer(), pool.toBuffer()], METEORA_PROGRAM_ID),
  //       PublicKey.findProgramAddressSync([bVault.toBuffer(), pool.toBuffer()], METEORA_PROGRAM_ID),
  //     ];


  //     const [[payerTokenA, createPayerTokenAIx], [payerTokenB, createPayerTokenBIx]] = await Promise.all([
  //       getOrCreateATAInstruction(SOL_MINT, signer.payer.publicKey, connection),
  //       getOrCreateATAInstruction(mint, signer.payer.publicKey, connection),
  //     ]);

  //     createPayerTokenAIx && preInstructions.push(createPayerTokenAIx);
  //     createPayerTokenBIx && preInstructions.push(createPayerTokenBIx);


  //     let latestBlockHash = await provider.connection.getLatestBlockhash(
  //       "confirmed"
  //     );

  //     if (preInstructions.length) {
  //       const preInstructionTx = new Transaction({
  //         feePayer: signer.payer.publicKey,
  //         ...latestBlockHash,
  //       }).add(...preInstructions);

  //       preInstructionTx.sign(signer.payer);
  //       const preInxSim = await connection.simulateTransaction(preInstructionTx)

  //       const txHash = await provider.sendAndConfirm(preInstructionTx, [], {
  //         commitment: "confirmed",
  //       });
  //       console.log("Successfully create payer token A and B : ", `https://solscan.io/tx/${txHash}?cluster=devnet`)
  //     }



  //     const { protocolTokenAFee, protocolTokenBFee } = getProtocolTokenFeePDA(SOL_MINT, mint, pool);
  //     const [mintMetadata, _mintMetadataBump] = deriveMintMetadata(lpMint);
  //     const setComputeUnitLimitIx = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
  //       units: 20_000_000,
  //     });

  //     const tx = new Transaction().add(setComputeUnitLimitIx)
  //       .add(
  //         await program.methods
  //           .migrateMeteoraPool()
  //           .accounts({
  //             dexConfigurationAccount: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mint,
  //             poolTokenAccount: poolTokenAccount,
  //             poolSolVault: poolSolVault,
  //             pool: pool,
  //             config: TEST_CONFIG,
  //             lpMint: lpMint,
  //             tokenAMint: SOL_MINT,
  //             tokenBMint: mint,
  //             aVault: aVault,
  //             bVault: bVault,
  //             aVaultLpMint: aVaultLpMint,
  //             bVaultLpMint: bVaultLpMint,
  //             aVaultLp: aVaultLp,
  //             bVaultLp: bVaultLp,
  //             aTokenVault: aTokenVault,
  //             bTokenVault: bTokenVault,
  //             payerTokenA: payerTokenA,
  //             payerTokenB: payerTokenB,
  //             payerPoolLp: payerPoolLp,
  //             protocolTokenAFee: protocolTokenAFee,
  //             protocolTokenBFee: protocolTokenBFee,
  //             payer: signer.payer.publicKey,
  //             rent: SYSVAR_RENT_PUBKEY,
  //             mintMetadata: mintMetadata,
  //             metadataProgram: METAPLEX_PROGRAM,
  //             vaultProgram: METEORA_VAULT_PROGRAM_ID,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             systemProgram: SystemProgram.programId,
  //             meteoraProgram: METEORA_PROGRAM_ID
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true })
  //     console.log("Successfully migrate meteora pool : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //   } catch (error) {
  //     console.log("Error in migrate meteora pool :", error)
  //   }
  // })


  // it("migrate pumpswap pool", async () => {

  //   try {
  //     const { curveConfig, bondingCurve, poolSolVault, poolTokenAccount } = getPDAs(signer.payer.publicKey, mint)
  //     console.log("bonding Curve", bondingCurve.toBase58());
  //     // const mintToken2022 = new PublicKey("AemQbKzYPhZmx3gM1ehc6q9MzDBSmcSKTCii74x2ACsx")
  //     const { pool, poolBaseTokenAccount, poolQuoteTokenAccount, lpMint, userBaseTokenAccount, userQuoteTokenAccount, userPoolTokenAccount, globalConfig, eventAuthority } = getPumpSwapPDA(2, signer.payer.publicKey, mint, SOL_MINT)
  //     console.log("pool", pool.toBase58());
  //     console.log("poolBaseTokenAccount", poolBaseTokenAccount.toBase58());
  //     console.log("poolQuoteTokenAccount", poolQuoteTokenAccount.toBase58());
  //     console.log("lpMint", lpMint.toBase58());
  //     console.log("userBaseTokenAccount", userBaseTokenAccount.toBase58());
  //     console.log("userQuoteTokenAccount", userQuoteTokenAccount.toBase58());
  //     console.log("userPoolTokenAccount", userPoolTokenAccount.toBase58());
  //     console.log("globalConfig", globalConfig.toBase58());


  //     const setComputeUnitLimitIx = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
  //       units: 20_000_000,
  //     });
  //     const tx = new Transaction().add(setComputeUnitLimitIx)

  //     const index = 2;
  //     // const poolTokenAccount = await getPoolTokenAccount2022(signer.payer, mintToken2022, bondingCurve)
  //     // const userTokenAccount = await getUserTokenAccount2022(signer.payer, mintToken2022, signer.payer.publicKey)


  //     if (!(await accountExists(connection, poolBaseTokenAccount))) {
  //       tx.add(
  //         createAssociatedTokenAccountIdempotentInstruction(
  //           signer.payer.publicKey,
  //           poolBaseTokenAccount,
  //           pool,
  //           mint,
  //           TOKEN_PROGRAM_ID
  //         )
  //       );
  //     }

  //     if (!(await accountExists(connection, poolQuoteTokenAccount))) {
  //       tx.add(
  //         createAssociatedTokenAccountIdempotentInstruction(
  //           signer.payer.publicKey,
  //           poolQuoteTokenAccount,
  //           pool,
  //           SOL_MINT,
  //           TOKEN_PROGRAM_ID
  //         )
  //       );
  //     }

  //     tx.add(
  //         await program.methods
  //           .migratePumpswapPool(index)
  //           .accounts({
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mint,
  //             poolTokenAccount: poolTokenAccount,
  //             poolSolVault: poolSolVault,
  //             pool: pool,                                // Pool PDA from getPumpSwapPDA
  //             globalConfig: globalConfig,                 // Config account
  //             creator: signer.publicKey,                             // Signer
  //             baseMint: mint,                       // Base token mint
  //             quoteMint: SOL_MINT,                          // Quote token mint
  //             lpMint: lpMint,                           // LP token mint
  //             userBaseTokenAccount: userBaseTokenAccount,      // User's base token account
  //             userQuoteTokenAccount: userQuoteTokenAccount,   // User's quote token account
  //             userPoolTokenAccount: userPoolTokenAccount,// User's pool token account
  //             poolBaseTokenAccount: poolBaseTokenAccount,         // Pool's base token account
  //             poolQuoteTokenAccount: poolQuoteTokenAccount,       // Pool's quote token account

  //             // Programs
  //             systemProgram: anchor.web3.SystemProgram.programId,
  //             token2022Program: TOKEN_2022_PROGRAM_ID,
  //             baseTokenProgram: TOKEN_PROGRAM_ID,
  //             quoteTokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             eventAuthority: eventAuthority,
  //             pumpswapProgram: PUMP_SWAP_PROGRAM_ID

  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true, commitment: "finalized" })
  //     console.log("Successfully migrate pumpwap pool : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //   } catch (error) {
  //     console.log("Error in migrate pumpwap pool :", error)
  //   }
  // })



  // Should be error because the user not created a pool
  // it(" add liquidity to the pool with another user not created a pool", async () => {

  //   try {
  //     const { curveConfig, bondingCurve, poolSolVault, poolTokenAccount, userTokenAccount } = await getPDAs(feeRecipient.publicKey, mint)
  //     let amount = new BN(100000000000); // 100 SPL token 
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .addLiquidity(amount)
  //           .accounts({
  //             dexConfigurationAccount: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mint,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             poolSolVault: poolSolVault,
  //             poolTokenAccount: poolTokenAccount,
  //             userTokenAccount: userTokenAccount,
  //             user: feeRecipient.publicKey,
  //             rent: SYSVAR_RENT_PUBKEY,
  //             systemProgram: SystemProgram.programId
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = feeRecipient.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [feeRecipient], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully add liquidity : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //     const userBalance = (await connection.getTokenAccountBalance(userTokenAccount)).value.uiAmount
  //     const poolBalance = (await connection.getTokenAccountBalance(poolTokenAccount)).value.uiAmount
  //     console.log("User Balance : ", userBalance)
  //     console.log("Pool Balance : ", poolBalance)
  //   } catch (error) {
  //     console.log("Error in add liquidity :", error)
  //   }
  // })


  // it(" buy from the pool with SPL token ", async () => {

  //   try {
  //     console.log("Before Buy from the pool with SPL token");
  //     const admin = new PublicKey("Yo8A62FyZT4goufRRhDU6ENy3pLSVWEgFxe2SQhn5u6")
  //     const { curveConfig, bondingCurve, poolSolVault, poolTokenAccount, userTokenAccount } = getPDAs(admin, mintExample)
  //     console.log("curveConfig", curveConfig.toBase58());
  //     console.log("bondingCurve", bondingCurve.toBase58());
  //     console.log("poolSolVault", poolSolVault.toBase58());
  //     console.log("poolTokenAccount", poolTokenAccount.toBase58());
  //     console.log("userTokenAccount", userTokenAccount.toBase58());

  //     const userBalanceBefore = (await connection.getTokenAccountBalance(userTokenAccount)).value.uiAmount
  //     console.log("User Balance Before Buy: ", userBalanceBefore);

  //     const poolBalanceBefore = (await connection.getTokenAccountBalance(poolTokenAccount)).value.uiAmount
  //     console.log("Pool Balance Before Buy: ", poolBalanceBefore);




  //     const feeRecipientBalanceBefore = (await connection.getBalance(feeRecipient.publicKey))
  //     console.log("Fee Recipient Balance Before Buy: ", feeRecipientBalanceBefore);


  //     const feeRecipient2BalanceBefore = (await connection.getBalance(feeRecipient2.publicKey))
  //     console.log("Fee Recipient 2 Balance Before Buy: ", feeRecipient2BalanceBefore);


  //     const multisigBalanceBefore = (await connection.getBalance(multisig));
  //     console.log("Multisig Balance Before Buy: ", multisigBalanceBefore);


  //     const amount = new BN(100000000)
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .buy(amount)
  //           .accountsStrict({
  //             bondingCurveConfiguration: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mintExample,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             poolSolVault: poolSolVault,
  //             poolTokenAccount: poolTokenAccount,
  //             userTokenAccount: userTokenAccount,
  //             user: signer.payer.publicKey,
  //             systemProgram: SystemProgram.programId
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully buy : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //     const userBalance = (await connection.getTokenAccountBalance(userTokenAccount)).value.uiAmount
  //     const poolBalance = (await connection.getTokenAccountBalance(poolTokenAccount)).value.uiAmount
  //     console.log("User Balance After Buy: ", userBalance)
  //     console.log("Pool Balance After Buy: ", poolBalance)

  //     const feeRecipientBalanceAfter = (await connection.getBalance(feeRecipient.publicKey));
  //     console.log("Fee Recipient Balance After Buy: ", feeRecipientBalanceAfter);
  //     const feeRecipient2BalanceAfter = (await connection.getBalance(feeRecipient2.publicKey));
  //     console.log("Fee Recipient 2 Balance After Buy: ", feeRecipient2BalanceAfter);
  //     const multisigBalanceAfter = (await connection.getBalance(multisig));
  //     console.log("Multisig Balance After Buy : ", multisigBalanceAfter);


  //   } catch (error) {
  //     console.log("Error in buy from pool :", error)
  //   }
  // })

  // it(" buy from the pool with  token 2022 ", async () => {

  //   try {


  //     const { curveConfig, bondingCurve, poolSolVault, feePool, feePoolVault } = getPDAs(signer.payer.publicKey, mintToken2022)
  //     const poolTokenAccount = await getPoolTokenAccount2022(signer.payer, mintToken2022, bondingCurve)
  //     const userTokenAccount = await getUserTokenAccount2022(signer.payer, mintToken2022, signer.payer.publicKey)

  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .buy(new BN(100000000))
  //           .accounts({
  //             dexConfigurationAccount: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mintToken2022,
  //             tokenProgram: TOKEN_2022_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             poolSolVault: poolSolVault,
  //             feePoolAccount: feePool,
  //             feePoolVault: feePoolVault,
  //             poolTokenAccount: poolTokenAccount.address,
  //             userTokenAccount: userTokenAccount.address,
  //             user: signer.payer.publicKey,
  //             systemProgram: SystemProgram.programId
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully buy : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //     // const userBalance = (await connection.getTokenAccountBalance(userTokenAccount)).value.uiAmount
  //     // const poolBalance = (await connection.getTokenAccountBalance(poolTokenAccount)).value.uiAmount
  //     // console.log("User Balance : ", userBalance)
  //     // console.log("Pool Balance : ", poolBalance)
  //   } catch (error) {
  //     console.log("Error in buy from pool :", error)
  //   }
  // })




  // it(" sell from the pool with SPL token ", async () => {

  //   try {


  //     const { curveConfig, bondingCurve, poolSolVault, poolTokenAccount, userTokenAccount, poolSolVaultBump } = getPDAs(signer.payer.publicKey, mint)

  //     const userBalanceBefore = (await connection.getTokenAccountBalance(userTokenAccount)).value.uiAmount
  //     console.log("User Balance Before Sell: ", userBalanceBefore);

  //     const poolBalanceBefore = (await connection.getTokenAccountBalance(poolTokenAccount)).value.uiAmount
  //     console.log("Pool Balance Before Sell: ", poolBalanceBefore);

  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .sell(new BN(1000000), poolSolVaultBump)
  //           .accountsStrict({
  //             bondingCurveConfiguration: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mint,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             poolSolVault: poolSolVault,
  //             poolTokenAccount: poolTokenAccount,
  //             userTokenAccount: userTokenAccount,
  //             user: signer.payer.publicKey,
  //             systemProgram: SystemProgram.programId
  //           }).remainingAccounts([
  //             {
  //               pubkey: feeRecipient.publicKey,
  //               isWritable: true,
  //               isSigner: false,
  //             },
  //             {
  //               pubkey: feeRecipient2.publicKey,
  //               isWritable: true,
  //               isSigner: false,
  //             },
  //             {
  //               pubkey: multisig,
  //               isWritable: true,
  //               isSigner: false,
  //             },
  //           ])
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully sell : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //     const userBalance = (await connection.getTokenAccountBalance(userTokenAccount)).value.uiAmount
  //     const poolBalance = (await connection.getTokenAccountBalance(poolTokenAccount)).value.uiAmount
  //     console.log("User Balance After Sell: ", userBalance)
  //     console.log("Pool Balance After Sell: ", poolBalance)

  //     const feeRecipientBalanceAfter = (await connection.getBalance(feeRecipient.publicKey));
  //     console.log("Fee Recipient Balance After Sell: ", feeRecipientBalanceAfter);
  //     const feeRecipient2BalanceAfter = (await connection.getBalance(feeRecipient2.publicKey));
  //     console.log("Fee Recipient 2 Balance After Sell: ", feeRecipient2BalanceAfter);
  //     const multisigBalanceAfter = (await connection.getBalance(multisig));
  //     console.log("Multisig Balance After Sell : ", multisigBalanceAfter);
  //   } catch (error) {
  //     console.log("Error in sell from pool :", error)
  //   }
  // })

  // it(" sell from the pool with token2022 token ", async () => {

  //   try {


  //     const { curveConfig, bondingCurve, poolSolVault, poolSolVaultBump, feePool, feePoolVault } = getPDAs(signer.payer.publicKey, mintToken2022)
  //     const poolTokenAccount = await getPoolTokenAccount2022(signer.payer, mintToken2022, bondingCurve)
  //     const userTokenAccount = await getUserTokenAccount2022(signer.payer, mintToken2022, signer.payer.publicKey)
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .sell(new BN(10000), poolSolVaultBump)
  //           .accountsStrict({
  //             dexConfigurationAccount: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mintToken2022,
  //             tokenProgram: TOKEN_2022_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             poolSolVault: poolSolVault,
  //             feePoolAccount: feePool,
  //             feePoolVault: feePoolVault,
  //             poolTokenAccount: poolTokenAccount.address,
  //             userTokenAccount: userTokenAccount.address,
  //             user: signer.payer.publicKey,
  //             systemProgram: SystemProgram.programId
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully sell : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //     // const userBalance = (await connection.getTokenAccountBalance(userTokenAccount)).value.uiAmount
  //     // const poolBalance = (await connection.getTokenAccountBalance(poolTokenAccount)).value.uiAmount
  //     // console.log("User Balance : ", userBalance)
  //     // console.log("Pool Balance : ", poolBalance)
  //   } catch (error) {
  //     console.log("Error in sell from pool :", error)
  //   }
  // })


  // it(" remove liquidity to the pool with SPL token ", async () => {

  //   try {
  //     const { curveConfig, bondingCurve, poolSolVault, poolTokenAccount, userTokenAccount, poolSolVaultBump } = await getPDAs(signer.payer.publicKey, mint)
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .removeLiquidity(poolSolVaultBump)
  //           .accountsStrict({
  //             dexConfigurationAccount: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mint,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             poolSolVault: poolSolVault,
  //             poolTokenAccount: poolTokenAccount,
  //             userTokenAccount: userTokenAccount,
  //             user: signer.payer.publicKey,
  //             systemProgram: SystemProgram.programId
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully initialized : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //     // const userBalance = (await connection.getTokenAccountBalance(userTokenAccount)).value.uiAmount
  //     // const poolBalance = (await connection.getTokenAccountBalance(poolTokenAccount)).value.uiAmount
  //     // console.log("User Balance : ", userBalance)
  //     // console.log("Pool Balance : ", poolBalance)
  //   } catch (error) {
  //     console.log("Error in remove liquidity :", error)
  //   }
  // })

  // it(" remove liquidity to the pool with token2022 token ", async () => {

  //   try {
  //     const { curveConfig, bondingCurve, poolSolVault, poolSolVaultBump } = getPDAs(signer.payer.publicKey, mintToken2022)
  //     const poolTokenAccount = await getPoolTokenAccount2022(signer.payer, mintToken2022, bondingCurve)
  //     const userTokenAccount = await getUserTokenAccount2022(signer.payer, mintToken2022, signer.payer.publicKey)
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .removeLiquidity(poolSolVaultBump)
  //           .accountsStrict({
  //             dexConfigurationAccount: curveConfig,
  //             bondingCurveAccount: bondingCurve,
  //             tokenMint: mintToken2022,
  //             tokenProgram: TOKEN_2022_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             poolSolVault: poolSolVault,
  //             poolTokenAccount: poolTokenAccount.address,
  //             userTokenAccount: userTokenAccount.address,
  //             user: signer.payer.publicKey,
  //             systemProgram: SystemProgram.programId
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully initialized : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  //     // const userBalance = (await connection.getTokenAccountBalance(userTokenAccount)).value.uiAmount
  //     // const poolBalance = (await connection.getTokenAccountBalance(poolTokenAccount)).value.uiAmount
  //     // console.log("User Balance : ", userBalance)
  //     // console.log("Pool Balance : ", poolBalance)
  //   } catch (error) {
  //     console.log("Error in remove liquidity :", error)
  //   }
  // })

  // it(" create whitelist launchpad ", async () => {

  //   try {
  //     let user = new PublicKey("BtSTqq27A7xTMaCPWEhNwdf4eHsLWiWZvhQS2ABMd1Y4");
  //     const { launchpad, whitelistData, launchpadTokenAccount } = getWhitelistLaunchPDAs(signer.payer.publicKey, mint, user)
  //     let tokenPrice = new BN(100000000); // 0.1 SOL
  //     let purchaseLimitPerWallet = new BN(100000000000000);
  //     let totalSupply = new BN(10000000000);// 10 SOL
  //     let whitelistDuration = new BN(4000); // 1 minute for testing
  //     let currentTime = Math.floor(Date.now() / 1000);
  //     let startTime = new BN(currentTime).add(whitelistDuration);
  //     let endTime = new BN(currentTime).add(whitelistDuration).add(whitelistDuration);
  
  
  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .createWhitelistLaunch(tokenPrice, purchaseLimitPerWallet, totalSupply, whitelistDuration, startTime, endTime)
  //           .accountsStrict({
  //             launchPadAccount: launchpad,
  //             whitelistData: whitelistData,
  //             tokenMint: mint,
  //             launchpadVault: launchpadTokenAccount,
  //             authority: signer.payer.publicKey,
  //             systemProgram: SystemProgram.programId,
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             rent: SYSVAR_RENT_PUBKEY,
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully created launchpad : ", `https://solscan.io/tx/${sig}?cluster=devnet`)
  
  //   } catch (error) {
  //     console.log("Error in create launchpad :", error)
  //   }
  // })


  // it(" add whitelist to launchpad ", async () => {

  //   try {
  //     let user = new PublicKey("BtSTqq27A7xTMaCPWEhNwdf4eHsLWiWZvhQS2ABMd1Y4");
  //     const { launchpad, whitelistData, buyerAccount } = getWhitelistLaunchPDAs(signer.payer.publicKey, mint, user)

  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .addWhitelist(user)
  //           .accountsStrict({
  //             launchPadAccount: launchpad,
  //             whitelistData: whitelistData,
  //             authority: signer.payer.publicKey,
  //             buyerAccount: buyerAccount,
  //             user: user,
  //             systemProgram: SystemProgram.programId,
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully add whitelist to launchpad : ", `https://solscan.io/tx/${sig}?cluster=devnet`)

  //   } catch (error) {
  //     console.log("Error in add whitelist to launchpad :", error)
  //   }
  // })

  // it(" remove whitelist to launchpad ", async () => {

  //   try {
  //     let user = new PublicKey("BtSTqq27A7xTMaCPWEhNwdf4eHsLWiWZvhQS2ABMd1Y4");
  //     const { launchpad, whitelistData, buyerAccount } = getWhitelistLaunchPDAs(signer.payer.publicKey, mint, user)

  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .removeWhitelist(user)
  //           .accountsStrict({
  //             launchPadAccount: launchpad,
  //             whitelistData: whitelistData,
  //             authority: signer.payer.publicKey,
  //             buyerAccount: buyerAccount,
  //             user: user,
  //             systemProgram: SystemProgram.programId,
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully remove whitelist to launchpad : ", `https://solscan.io/tx/${sig}?cluster=devnet`)

  //   } catch (error) {
  //     console.log("Error in remove whitelist to launchpad :", error)
  //   }
  // })


  // it(" pause launchpad  with whitelist launch ", async () => {

  //   try {
  //     const { launchpad, whitelistData } = getPauseLaunchPDAs(signer.payer.publicKey)

  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .pauseLaunchpad()
  //           .accountsStrict({
  //             launchPadAccount: launchpad,
  //             whitelistData: whitelistData,
  //             fairLaunchData: null,
  //             authority: signer.payer.publicKey,
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully pause launchpad : ", `https://solscan.io/tx/${sig}?cluster=devnet`)

  //   } catch (error) {
  //     console.log("Error in pause launchpad :", error)
  //   }
  // })

  // it(" unpause launchpad with whitelist launch ", async () => {

  //   try {
  //     const { launchpad, whitelistData } = getPauseLaunchPDAs(signer.payer.publicKey)

  //     const tx = new Transaction()
  //       .add(
  //         await program.methods
  //           .unpauseLaunchpad()
  //           .accountsStrict({
  //             launchPadAccount: launchpad,
  //             whitelistData: whitelistData,
  //             fairLaunchData: null,
  //             authority: signer.payer.publicKey,
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true , commitment: "confirmed"})
  //     console.log("Successfully unpause launchpad : ", `https://solscan.io/tx/${sig}?cluster=devnet`)

  //   } catch (error) {
  //     console.log("Error in unpause launchpad :", error)
  //   }
  // })


  // it("create fair launch", async () => {
  //   try {
  //     const { fairLaunchData, launchpadTokenAccount, contributionVault } = getFairLaunchPDAs(
  //       signer.payer.publicKey,
  //       mint,
  //       buyer.publicKey

  //     );

  //     // Fair launch parameters
  //     let softCap = new BN(1_000_000_000); // 1 SOL
  //     let hardCap = new BN(10_000_000_000); // 10 SOL
  //     let minContribution = new BN(100_000_000); // 0.1 SOL
  //     let maxContribution = new BN(2_000_000_000); // 2 SOL
  //     let maxTokensPerWallet = new BN(1000);
  //     let distributionDelay = new BN(3600); // 1 hour
  //     let currentTime = Math.floor(Date.now() / 1000);
  //     let startTime = new BN(currentTime + 60); // 1 min from now
  //     let endTime = new BN(currentTime + 3600); // 1 hour from now

  //     const tx = new Transaction().add(
  //       await program.methods
  //         .createFairLaunch(
  //           softCap,
  //           hardCap,
  //           startTime,
  //           endTime,
  //           minContribution,
  //           maxContribution,
  //           maxTokensPerWallet,
  //           distributionDelay
  //         )
  //         .accountsStrict({
  //           fairLaunchData: fairLaunchData,
  //           tokenMint: mint,
  //           launchpadVault: launchpadTokenAccount,
  //           contributionVault: contributionVault,
  //           authority: signer.payer.publicKey,
  //           systemProgram: SystemProgram.programId,
  //           tokenProgram: TOKEN_PROGRAM_ID,
  //           associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //           rent: SYSVAR_RENT_PUBKEY,
  //         })
  //         .instruction()
  //     );
  //     tx.feePayer = signer.payer.publicKey;
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], {
  //       skipPreflight: true,
  //       commitment: "confirmed",
  //     });
  //     console.log("Successfully created fair launch:", `https://solscan.io/tx/${sig}?cluster=devnet`);
  //   } catch (error) {
  //     console.log("Error in create fair launch:", error);
  //   }
  // });


  // it("pause launchpad with fair launch", async () => {
  //   try {
  //     const { launchpad, fairLaunchData } = getPauseLaunchPDAs(signer.payer.publicKey);

  //     const tx = new Transaction().add(
  //       await program.methods
  //         .pauseLaunchpad()
  //         .accountsStrict({
  //           launchPadAccount: launchpad,
  //           whitelistData: null,
  //           fairLaunchData: fairLaunchData,
  //           authority: signer.payer.publicKey,
  //         })
  //         .instruction()
  //     );
  //     tx.feePayer = signer.payer.publicKey;
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], {
  //       skipPreflight: true,
  //       commitment: "confirmed",
  //     });
  //     console.log("Successfully paused fair launch:", `https://solscan.io/tx/${sig}?cluster=devnet`);
  //   } catch (error) {
  //     console.log("Error in pause fair launch:", error);
  //   }
  // });

  // it("unpause launchpad with fair launch", async () => {
  //   try {
  //     const { launchpad, fairLaunchData } = getPauseLaunchPDAs(signer.payer.publicKey);

  //     const tx = new Transaction().add(
  //       await program.methods
  //         .unpauseLaunchpad()
  //         .accountsStrict({
  //           launchPadAccount: launchpad,
  //           whitelistData: null,
  //           fairLaunchData: fairLaunchData,
  //           authority: signer.payer.publicKey,
  //         })
  //         .instruction()
  //     );
  //     tx.feePayer = signer.payer.publicKey;
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], {
  //       skipPreflight: true,
  //       commitment: "confirmed",
  //     });
  //     console.log("Successfully unpaused fair launch:", `https://solscan.io/tx/${sig}?cluster=devnet`);
  //   } catch (error) {
  //     console.log("Error in unpause fair launch:", error);
  //   }
  // });


  // it(" create allocation ", async () => {

  //   try {
  //     let user1Keypair = getKeypairFromFile(`${os.homedir()}/.config/solana/id2.json`);
  //     let user2Keypair = getKeypairFromFile(`${os.homedir()}/.config/solana/id3.json`);
  //     const { allocations, allocationTokenAccounts } = getAllocationPDAs(mint, [user1Keypair.publicKey, user2Keypair.publicKey])
  //     let category = "Team"
  //     let percentage = new BN(10)
  //     let totalTokens = new BN(1000000000000)
  //     let currentTime = Math.floor(Date.now() / 1000);
  //     let startTime = new BN(currentTime).add(new BN(1000));
  //     let cliffPeriod = new BN(1000);
  //     let duration = new BN(1000);
  //     let interval = new BN(1000);
  //     let released = new BN(0);

  //     let vesting = {
  //       cliffPeriod: cliffPeriod,
  //       startTime: startTime,
  //       duration: duration,
  //       interval: interval,
  //       released: released,
  //     }

  //     const instructions = [
  //       await program.methods
  //           .createAllocation(category, percentage, totalTokens, vesting)
  //           .accountsStrict({
  //             allocation: allocations[0],
  //             wallet: user1Keypair.publicKey,
  //             tokenMint: mint,
  //             allocationVault: allocationTokenAccounts[0],
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             rent: SYSVAR_RENT_PUBKEY,
  //             systemProgram: SystemProgram.programId,
  //             authority: signer.payer.publicKey,
  //           })
  //           .instruction(),
  //       await program.methods
  //           .createAllocation(category, percentage, totalTokens, vesting)
  //           .accountsStrict({
  //             allocation: allocations[1],
  //             wallet: user2Keypair.publicKey,
  //             tokenMint: mint,
  //             allocationVault: allocationTokenAccounts[1],
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //             rent: SYSVAR_RENT_PUBKEY,
  //             systemProgram: SystemProgram.programId,
  //             authority: signer.payer.publicKey,
  //           })
  //           .instruction()
  //     ]
  //     let tx = new Transaction()
  //     for(let i = 0; i < instructions.length; i++){
  //       tx.add(instructions[i])
  //     }
  //     tx.feePayer = signer.payer.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [signer.payer], { skipPreflight: true, commitment: "confirmed" })
  //     console.log("Successfully create allocation : ", `https://solscan.io/tx/${sig}?cluster=devnet`)

  //   } catch (error) {
  //     console.log("Error in create allocation :", error)
  //   }
  // })


  // it(" claim tokens ", async () => {

  //   try {

  //     let user1Keypair = getKeypairFromFile(`${os.homedir()}/.config/solana/id2.json`);
  //     const { allocations, allocationTokenAccounts, userTokenAccounts } = getAllocationPDAs(mint, [user1Keypair.publicKey])
  //     let now = Math.floor(Date.now() / 1000);
  //     console.log("User token account : ", userTokenAccounts[0])
      

  //     const accountInfo = await connection.getAccountInfo(userTokenAccounts[0]);
  //     if (!accountInfo) {
  //       await getOrCreateAssociatedTokenAccount(connection, user1Keypair, mint, user1Keypair.publicKey)
  //     }

      
  //     const tx = new Transaction()
  //       tx.add(
  //         await program.methods
  //           .claimTokens(new BN(now))
  //           .accountsStrict({
  //             allocation: allocations[0],
  //             wallet: user1Keypair.publicKey,
  //             systemProgram: SystemProgram.programId,
  //             tokenMint: mint,
  //             allocationVault: allocationTokenAccounts[0],
  //             userTokenAccount: userTokenAccounts[0],
  //             tokenProgram: TOKEN_PROGRAM_ID,
  //             associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
  //           })
  //           .instruction()
  //       )
  //     tx.feePayer = user1Keypair.publicKey
  //     tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  //     const sig = await sendAndConfirmTransaction(connection, tx, [user1Keypair], { skipPreflight: true, commitment: "confirmed" })
  //     console.log("Successfully claim token : ", `https://solscan.io/tx/${sig}?cluster=devnet`)

  //   } catch (error) {
  //     console.log("Error in claim token :", error)
  //   }
  // })


});


