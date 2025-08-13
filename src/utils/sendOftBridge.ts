// src/utils/sendOftBridge.ts
import { Connection, PublicKey } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { publicKey, transactionBuilder } from "@metaplex-foundation/umi";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox";
import { addressToBytes32 } from "@layerzerolabs/lz-v2-utilities";
import { oft } from "@layerzerolabs/oft-v2-solana-sdk";
import { fetchMint } from "@metaplex-foundation/mpl-toolbox";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { some } from "@metaplex-foundation/umi";
import bs58 from "bs58";

// ====== CONSTANTES ======
const PROGRAM_ID = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ADDRESS || "35HGYhkESo9uT8ni8ArAvhFKUtU4E8cgNKVEJJWe1SHK";
const OFT_STORE  = process.env.NEXT_PUBLIC_SOLANA_OFT_STORE || "AkqcEt5JdaCzQsaZsAhpkXciJpW6UU1FnVUfmanfk7Fc";
const TOKEN_MINT = process.env.NEXT_PUBLIC_SOLANA_OFT_MINT_ADDRESS || "Cz75ZtjwgZmr5J1VDBRTm5ZybZvEFR5DEdb8hEy59pWq";
const TOKEN_ESCROW = process.env.NEXT_PUBLIC_SOLANA_ESCROW_ADDRESS || "4Np7RjDwJ2RJwgmaLsve91dhHKWMuU4wq17FNyqWkHoa";
// REMOTE_EID sera passé dynamiquement en paramètre

// ====== UTIL ======
function parseDecimalToUnits(amountUi: string, decimals: number): bigint {
  const [i, f = ""] = String(amountUi).trim().split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt((i || "0") + frac);
}

// ====== CORE BRIDGE CALL AVEC SDK ======
async function bridgeWithSDK(connection: Connection, wallet: WalletContextState, amountUi: string, toAddress: `0x${string}`, tokenDecimals: number, remoteEid: number) {
  console.log("🔍 Bridge avec SDK LayerZero...");

  // Les peers sont déjà configurés (vérifié avec LayerZero debug)
  console.log("✅ Peer Base configuré (vérifié par LayerZero debug)");

  // 2. Setup UMI avec le wallet adapter
  const rpcUrl = connection.rpcEndpoint;
  const umi = createUmi(rpcUrl);
  umi.use(walletAdapterIdentity(wallet));
  
  const umiWalletSigner = umi.identity;

  // 2. Configuration depuis les variables d'environnement
  const programId = publicKey(PROGRAM_ID);
  const storePda = publicKey(OFT_STORE);
  const mintPk = new PublicKey(TOKEN_MINT);
  const escrowPk = new PublicKey(TOKEN_ESCROW);

  // 3. Obtenir le token account manuellement
  const tokenAccountPk = getAssociatedTokenAddressSync(
    mintPk,
    new PublicKey(umiWalletSigner.publicKey),
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const tokenAccount = fromWeb3JsPublicKey(tokenAccountPk);
  console.log("🏦 Token account:", tokenAccount);

  // 4. Vérifier le solde du token account
  try {
    const tokenAccountInfo = await connection.getAccountInfo(tokenAccountPk);
    if (!tokenAccountInfo) {
      throw new Error(`❌ Token account n'existe pas: ${tokenAccountPk.toBase58()}`);
    }
    console.log("✅ Token account trouvé:", tokenAccountPk.toBase58());
  } catch (e) {
    console.error("❌ Erreur token account:", e);
    throw e;
  }

  // 5. Convertir le montant en unités de base
  const decimals = (await fetchMint(umi, fromWeb3JsPublicKey(mintPk))).decimals;
  const amountUnits = parseDecimalToUnits(amountUi, decimals);
  const minAmountUnits = (amountUnits * 98n) / 100n; // 2% slippage
  
  console.log("💰 Amount:", { amountUi, amountUnits: amountUnits.toString(), decimals });
  
  // 6. Vérifier le solde SOL pour les fees
  const solBalance = await connection.getBalance(new PublicKey(umiWalletSigner.publicKey));
  console.log("💳 Solde SOL:", (solBalance / 1e9).toFixed(4), "SOL");
  if (solBalance < 10000000) { // 0.01 SOL minimum
    console.warn("⚠️ Solde SOL faible, peut causer des échecs de transaction");
  }

  // 5. Quote avec le SDK
  console.log("📊 Quoting native fees...");
  console.log("🎯 Destination EID:", remoteEid);
  console.log("📍 Recipient address:", toAddress);
  
  const recipient = addressToBytes32(toAddress);
  console.log("📦 Recipient bytes32:", Buffer.from(recipient).toString('hex'));
  
  try {
    console.log("💰 Quote params:", {
      payer: umiWalletSigner.publicKey.toString(),
      tokenMint: mintPk.toBase58(),
      tokenEscrow: escrowPk.toBase58(),
      dstEid: remoteEid,
      amountLd: amountUnits.toString(),
      minAmountLd: minAmountUnits.toString(),
    });
    
    const { nativeFee } = await oft.quote(
      umi.rpc,
      {
        payer: umiWalletSigner.publicKey,
        tokenMint: fromWeb3JsPublicKey(mintPk),
        tokenEscrow: fromWeb3JsPublicKey(escrowPk),
      },
      {
        payInLzToken: false,
        to: Buffer.from(recipient),
        dstEid: remoteEid,
        amountLd: amountUnits,
        minAmountLd: minAmountUnits,
        options: Buffer.alloc(0), // Options vides pour enforced options
        composeMsg: undefined,
      },
      { oft: programId }
    );
    
    console.log("💰 Native fee:", nativeFee);

    // 6. Send avec le SDK
    console.log("🚀 Sending transaction...");
    const ix = await oft.send(
      umi.rpc,
      {
        payer: umiWalletSigner,
        tokenMint: fromWeb3JsPublicKey(mintPk),
        tokenEscrow: fromWeb3JsPublicKey(escrowPk),
        tokenSource: tokenAccount,
      },
      {
        to: Buffer.from(recipient),
        dstEid: remoteEid,
        amountLd: amountUnits,
        minAmountLd: minAmountUnits,
        options: Buffer.alloc(0),
        composeMsg: undefined,
        nativeFee: nativeFee,
      },
      { oft: programId }
    );

    // 7. Construire et envoyer la transaction avec plus de compute units
    console.log("🚀 Envoi de la transaction avec 400,000 compute units...");
    const computeUnitIx = setComputeUnitLimit(umi, { units: 400_000 });
    const txB = transactionBuilder().add([computeUnitIx, ix]);
    
    let signature;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`📡 Tentative ${attempts}/${maxAttempts}...`);
        console.log("🚀 Envoi de la transaction...");
        const result = await txB.sendAndConfirm(umi, { 
          confirm: { 
            commitment: 'processed', // Plus rapide que 'confirmed'
          },
          send: { 
            skipPreflight: true,
            maxRetries: 5 // Retry plus rapidement
          }
        });
        signature = result.signature;
        console.log("✅ Transaction confirmée:", Buffer.from(signature).toString('hex'));
        break;
      } catch (error: any) {
        console.error(`❌ Tentative ${attempts} échouée:`, error?.message || error);
        if (attempts === maxAttempts) {
          throw error;
        }
        // Attendre moins longtemps avant le retry
        console.log("⏱️ Attente avant retry...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const txHash = bs58.encode(signature!);
    
    console.log(`✅ Transaction Solana envoyée: https://solscan.io/tx/${txHash}`);
    console.log(`🔗 LayerZero Scan: https://layerzeroscan.com/tx/${txHash}`);
    console.log(`📋 Infos importantes:`);
    console.log(`   - Source: Solana (${amountUi} FUCKCOIN)`);
    console.log(`   - Destination: Base mainnet (${toAddress})`);
    console.log(`   - EID: ${remoteEid} (destination network)`);
    console.log(`⏳ Le bridge LayerZero peut prendre 1-10 minutes pour arriver sur Base.`);
    console.log(`🔍 Vérifiez votre wallet Base dans quelques minutes !`);
    return txHash;
    
  } catch (error: any) {
    console.error("❌ Bridge error:", error);
    throw error;
  }
}

// ====== FONCTION PRINCIPALE ======
export async function sendOftBridge({ connection, wallet, amountUi, toAddress, tokenDecimals = 9, remoteEid }: {
  connection: Connection;
  wallet: WalletContextState;
  amountUi: string;
  toAddress: `0x${string}`;
  tokenDecimals?: number;
  remoteEid: number;
}) {
  if (!connection) throw new Error("Connection manquante");
  if (!wallet?.publicKey) throw new Error("Wallet non connecté");

  console.log("🌉 Début du bridge OFT avec SDK LayerZero");
  console.log("📋 Paramètres:", { 
    amountUi, 
    toAddress, 
    tokenDecimals,
    wallet: wallet.publicKey.toBase58()
  });

  return await bridgeWithSDK(connection, wallet, amountUi, toAddress, tokenDecimals, remoteEid);
}
