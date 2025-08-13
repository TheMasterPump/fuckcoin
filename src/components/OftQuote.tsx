"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { oft } from "@layerzerolabs/oft-v2-solana-sdk";
import { useState, useEffect } from "react";
import { publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { addressToBytes32 } from "@layerzerolabs/lz-v2-utilities";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";

// === ENV (configuration LayerZero) ===
const SOLANA_OFT_MINT_ADDRESS = process.env.NEXT_PUBLIC_SOLANA_OFT_MINT_ADDRESS!;
const SOLANA_ESCROW_ADDRESS   = process.env.NEXT_PUBLIC_SOLANA_ESCROW_ADDRESS!;
const SOLANA_PROGRAM_ADDRESS  = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ADDRESS!;
// Adresse EVM de test (pour le composant de debug uniquement)
const TEST_BASE_WALLET = "0x1234567890123456789012345678901234567890";

// EIDs mainnet
const toEidBaseMainnet = 184;          // Base mainnet
// (fromEid côté SDK n'est pas toujours nécessaire ici)

const TOKEN_DECIMALS = 9; // FUCKCOIN

// options simples si tu n'as pas EnforcedOptions configuré
function buildSimpleOptions(): Buffer {
  const header = Buffer.from("00030100000000000000", "hex");
  const gasBuf = Buffer.alloc(8);
  gasBuf.writeBigUInt64BE(200000n);
  return Buffer.concat([header, gasBuf]);
}

export default function OftQuote() {
  const wallet = useWallet();
  const [isClient, setIsClient] = useState(false);
  const [nativeFee, setNativeFee] = useState<bigint | null>(null);
  const [amountUi, setAmountUi] = useState("0.1");

  useEffect(() => setIsClient(true), []);
  if (!isClient) return null;

  // Utilise les variables d'environnement pour le RPC
  const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_API_KEY && process.env.NEXT_PUBLIC_HELIUS_API_KEY !== 'VOTRE_CLE_API_HELIUS_ICI'
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`
    : process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const umi = createUmi(rpcUrl);
  umi.use(walletAdapterIdentity(wallet));

  async function onClickQuote() {
    try {
      if (!wallet.connected || !wallet.publicKey) {
        console.error("Wallet is not connected or publicKey is missing.");
        return;
      }
      if (!SOLANA_OFT_MINT_ADDRESS || !SOLANA_ESCROW_ADDRESS || !SOLANA_PROGRAM_ADDRESS) {
        console.error("Missing environment variables.");
        return;
      }

      const mint = publicKey(SOLANA_OFT_MINT_ADDRESS);
      const recipientAddressBytes32 = addressToBytes32(TEST_BASE_WALLET);

      // Convertit amountUi -> amountLd avec 9 décimales
      const amountLd = BigInt(Math.floor(Number(amountUi) * 10 ** TOKEN_DECIMALS));
      const minAmountLd = 1n; // ou calcule un min réaliste

      const { nativeFee } = await oft.quote(
        umi.rpc,
        {
          payer: publicKey(wallet.publicKey),
          tokenMint: mint,
          tokenEscrow: publicKey(SOLANA_ESCROW_ADDRESS),
        },
        {
          payInLzToken: false,
          to: Buffer.from(recipientAddressBytes32),
          dstEid: toEidBaseMainnet,
          amountLd,
          minAmountLd,
          // Si EnforcedOptions est configuré côté peer -> Buffer.alloc(0)
          // Sinon utilise un buffer d'options simple :
          options: buildSimpleOptions(),
          composeMsg: undefined,
        },
        {
          oft: publicKey(SOLANA_PROGRAM_ADDRESS),
        }
      );

      setNativeFee(nativeFee);
    } catch (e) {
      console.error("Quote error:", e);
    }
  }

  return (
    <div className="py-5">
      <div className="my-4" />
      <p>Solana OFT Mint Address: {SOLANA_OFT_MINT_ADDRESS}</p>
      <p>Solana Escrow Address: {SOLANA_ESCROW_ADDRESS}</p>
      <p>Program Address: {SOLANA_PROGRAM_ADDRESS}</p>
      <p>(EVM dest) Test address: {TEST_BASE_WALLET}</p>

      <div className="my-4" />
      <label>Amount:</label>
      <input
        className="ml-2 px-2 py-1 bg-black/40 border rounded"
        value={amountUi}
        onChange={(e) => setAmountUi(e.target.value)}
        type="number"
        min="0"
        step="0.000000001"
      />

      <button className="my-4 ml-3 py-2 px-6 bg-blue-500 text-white rounded" onClick={onClickQuote}>
        OFT Quote
      </button>

      <p>Quote result (nativeFee): {nativeFee?.toString() ?? "-"}</p>
    </div>
  );
}
