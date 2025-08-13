"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const FUCK_MINT = new PublicKey("Cz75ZtjwgZmr5J1VDBRTm5ZybZvEFR5DEdb8hEy59pWq");
const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_API_KEY && process.env.NEXT_PUBLIC_HELIUS_API_KEY !== 'YOUR_HELIUS_API_KEY_HERE'
  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`
  : "https://api.mainnet-beta.solana.com";

const LAST_WALLET_KEY = "solana:lastWallet";

export function useSolanaWallet() {
  const {
    publicKey,
    connected,
    connect,
    disconnect,
    connecting,
    select,
    wallet,
  } = useWallet();

  // Connexion RPC mémorisée
  const connection = useMemo(() => new Connection(HELIUS_RPC), []);

  const [balance, setBalance] = useState<number | null>(null);       // SOL
  const [fuckBalance, setFuckBalance] = useState<number | null>(null); // FUCK (SPL)

  // --- SOL balance ---
  useEffect(() => {
    (async () => {
      if (!publicKey) {
        setBalance(null);
        return;
      }
      try {
        const lamports = await connection.getBalance(publicKey);
        setBalance(lamports / 1e9);
      } catch (err) {
        console.error("Erreur SOL balance:", err);
        setBalance(null);
      }
    })();
  }, [publicKey, connection]);

  // --- FUCKCOIN SPL balance ---
  useEffect(() => {
    (async () => {
      if (!publicKey) {
        setFuckBalance(null);
        return;
      }
      try {
        const ata = await getAssociatedTokenAddress(
          FUCK_MINT,
          publicKey,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const resp = await connection.getTokenAccountBalance(ata);
        const ui = resp?.value?.uiAmount;
        setFuckBalance(ui ?? 0);
      } catch (err: any) {
        console.warn(
          "FUCK balance indisponible (ATA manquant ?):",
          err?.message || err
        );
        setFuckBalance(0);
      }
    })();
  }, [publicKey, connection]);

  // --- Actions ---
  const connectWallet = async () => {
    try {
      // Si aucun wallet n'est sélectionné dans l'adapter, tente de reprendre le dernier
      if (!wallet?.adapter) {
        const last =
          typeof window !== "undefined"
            ? localStorage.getItem(LAST_WALLET_KEY)
            : null;
        if (last) {
          await select(last);
        } else {
          // Demander à l'UI d'ouvrir le menu
          throw new Error("WALLET_NOT_SELECTED");
        }
      }
      if (!connected && !connecting) {
        await connect();
      }
    } catch (e: any) {
      console.log('🔍 Solana wallet connect error:', e);
      if (e?.name === "WalletNotSelectedError") {
        throw new Error("WALLET_NOT_SELECTED");
      }
      // Éviter les redirections automatiques sur mobile
      if (e?.message?.includes('redirect') || e?.message?.includes('deeplink')) {
        throw new Error("WALLET_NOT_AVAILABLE");
      }
      throw e;
    }
  };

  const selectWallet = async (walletName: string) => {
    try {
      console.log(`🔍 Selecting ${walletName} wallet...`);
      await select(walletName); // sélectionne l'adapter
      if (typeof window !== "undefined") {
        localStorage.setItem(LAST_WALLET_KEY, walletName);
      }
      console.log(`✅ ${walletName} selected, connecting...`);
      // enchaîne une connexion
      await connectWallet();
    } catch (e: any) {
      console.error(`❌ Error selecting/connecting ${walletName}:`, e);
      // Éviter les redirections
      if (e?.message?.includes('redirect') || e?.message?.includes('deeplink')) {
        throw new Error(`${walletName} wallet not available in this browser`);
      }
      throw e;
    }
  };

  return {
    // adresses & balances
    account: publicKey ? publicKey.toBase58() : null,
    balance, // SOL
    fuckBalance, // FUCK SPL

    // actions
    connectWallet,
    selectWallet,
    disconnect,

    // états bruts
    connected,
    connecting,
    wallet,
    connection,
  };
}
