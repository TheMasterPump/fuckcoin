"use client";
import React, { useState, useEffect } from "react";
import { useSolanaWallet } from "../components/useSolanaWallet";
import OftQuote from "@/components/OftQuote";
import { sendOftBridge } from "@/utils/sendOftBridge";
import EthereumConnect from "../components/EthereumConnect";
import SuccessNotification from "../components/SuccessNotification";
import Toast from "../components/Toast";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { PublicKey, Connection } from "@solana/web3.js";
import { utils as ethersUtils, ethers } from "ethers";
import { useWallet } from "@solana/wallet-adapter-react";
import { sendEvmToSolana } from "@/utils/sendEvmToSolana";
import { isMobile, redirectToWallet, detectMobileWallets } from "@/utils/mobileWalletUtils";

// Fonction pour formater les balances en français
const formatBalance = (balance: number): string => {
  if (balance === 0) return "0,00";
  
  // Séparer partie entière et décimale
  const parts = balance.toFixed(6).split('.');
  const integerPart = parts[0];
  let decimalPart = parts[1];
  
  // Enlever les zéros en fin de décimale (mais garder au moins 2 décimales)
  decimalPart = decimalPart.replace(/0+$/, '');
  if (decimalPart.length < 2) decimalPart = decimalPart.padEnd(2, '0');
  
  // Formater la partie entière avec des points pour les milliers
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${formattedInteger},${decimalPart}`;
};

// Fonction améliorée pour la sélection de wallet Solana
const handleSolanaWalletSelection = async (
  walletName: string, 
  selectWallet: (name: string) => Promise<void>, 
  connectSol: () => Promise<void>,
  setShowWalletOptions: (show: boolean) => void,
  showToastMessage: (msg: string) => void
) => {
  const mobileWallets = detectMobileWallets();
  
  if (isMobile()) {
    // Vérifier si le wallet est déjà disponible
    const walletAvailable = (
      (walletName === 'Phantom' && mobileWallets.phantom) ||
      (walletName === 'Backpack' && (window as any).backpack) ||
      (walletName === 'Solflare' && (window as any).solflare)
    );
    
    if (!walletAvailable) {
      showToastMessage(`Open in ${walletName} app`);
      redirectToWallet(walletName.toLowerCase());
      return;
    }
  }
  
  // Procéder à la connexion
  try {
    await selectWallet(walletName);
    await connectSol();
    setShowWalletOptions(false);
    showToastMessage(`${walletName} connected!`, "success");
  } catch (e) {
    console.error(`Erreur connexion ${walletName}:`, e);
    if (isMobile()) {
      showToastMessage(`Open in ${walletName} app`);
      redirectToWallet(walletName.toLowerCase());
    } else {
      showToastMessage(`${walletName} connection error`);
    }
  }
};

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [amount, setAmount] = useState("");
  const [destAddress, setDestAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const [fuckBalance, setFuckBalance] = useState<number>(0);
  
  // États pour le pop-up de succès
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTxHash, setSuccessTxHash] = useState("");
  
  // États pour les toasts
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<"error" | "success" | "warning">("error");

  const showToastMessage = (message: string, type: "error" | "success" | "warning" = "error") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };

  const [evmNetwork, setEvmNetwork] = useState<"ethereum" | "base">("base");
  const [bridgeDirection, setBridgeDirection] = useState<"solana-to-evm" | "evm-to-solana">("solana-to-evm");
  const FUCKCOIN_MINT = new PublicKey(process.env.NEXT_PUBLIC_SOLANA_OFT_MINT_ADDRESS || "Cz75ZtjwgZmr5J1VDBRTm5ZybZvEFR5DEdb8hEy59pWq");
  
  // Connection Solana configurée
  const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_API_KEY && process.env.NEXT_PUBLIC_HELIUS_API_KEY !== 'VOTRE_CLE_API_HELIUS_ICI'
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`
    : process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const solanaConnection = new Connection(rpcUrl);

  // Ton hook custom (balances, helpers UI)
  const {
    account: solAccount,
    balance: solBalance,
    connectWallet: connectSol,
    wallet, // adapter (facultatif pour l’UI)
    connection,
    selectWallet,
    disconnect,
  } = useSolanaWallet();

  // ⚠️ Vrai contexte wallet (publicKey/connected/signers)
  const walletCtx = useWallet();

  const [ethAccount, setEthAccount] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [ethTokenBalance, setEthTokenBalance] = useState<string | null>(null);

  useEffect(() => setIsClient(true), []);

  // Solde SPL côté Solana
  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (!solAccount) return;
      try {
        const ata = await getAssociatedTokenAddress(FUCKCOIN_MINT, new PublicKey(solAccount));
        const accountInfo = await getAccount(solanaConnection, ata);
        const balance = Number(accountInfo.amount) / 1e6; // 6 décimales, pas 9
        setFuckBalance(balance);
      } catch (err) {
        // Balance fetch failed, keep as 0
        setFuckBalance(0);
      }
    };
    fetchTokenBalance();
  }, [solAccount, solanaConnection]);

  // Switch réseau EVM - amélioration mobile
  const ensureEvmNetwork = async (target: "ethereum" | "base") => {
    // @ts-ignore
    const eth = typeof window !== "undefined" ? window.ethereum : null;
    if (!eth) {
      setEvmNetwork(target);
      return;
    }
    
    // Détection mobile pour un comportement différent
    const isMobile = typeof window !== "undefined" && 
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
       window.innerWidth <= 768);
    const CHAIN = {
      ethereum: { chainId: "0x1" },
      base: {
        chainId: "0x2105",
        chainName: "Base",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://mainnet.base.org"],
        blockExplorerUrls: ["https://basescan.org"],
      },
    };
    try {
      if (target === "ethereum") {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.ethereum.chainId }] });
      } else {
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.base.chainId }] });
        } catch (switchErr: any) {
          if (switchErr?.code === 4902) {
            await eth.request({ method: "wallet_addEthereumChain", params: [CHAIN.base] });
          } else {
            throw switchErr;
          }
        }
      }
      setEvmNetwork(target);
    } catch (e) {
      console.error("Switch réseau EVM refusé:", e);
      setEvmNetwork(target);
    }
  };

  // ====== handleBridge (utilise walletCtx) ======
  const handleBridge = async () => {

    // Bridge EVM → Solana
    if (bridgeDirection === "evm-to-solana") {
      return await handleEvmToSolanaBridge();
    }

    // Bridge Solana → EVM (code existant)
    return await handleSolanaToEvmBridge();
  };

  // ====== handleEvmToSolanaBridge ======
  const handleEvmToSolanaBridge = async () => {
    
    if (!ethAccount) {
      showToastMessage("Connect your Ethereum/Base wallet first!");
      return;
    }
    if (!destAddress) {
      showToastMessage("Solana destination address required!");
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      showToastMessage("Valid amount required!");
      return;
    }

    setLoading(true);
    try {
      // @ts-ignore
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const tokenAddress = evmNetwork === "ethereum" ? 
        (process.env.NEXT_PUBLIC_ETHEREUM_OFT_ADDRESS || "0x95dB68675CaC0E52E7124039f167f435e85c9c39") :
        (process.env.NEXT_PUBLIC_BASE_OFT_ADDRESS || "0x95dB68675CaC0E52E7124039f167f435e85c9c39");
      
      const sig = await sendEvmToSolana({
        provider,
        tokenAddress,
        fromAddress: ethAccount,
        toSolanaAddress: destAddress, // Adresse Solana
        amountUI: amount,
        network: evmNetwork,
      });
      
      setSuccessTxHash(sig);
      setShowSuccess(true);
    } catch (err: any) {
      showToastMessage("Bridge error: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // ====== handleSolanaToEvmBridge (code existant) ======
  const handleSolanaToEvmBridge = async () => {

    // Fallback si pas de publicKey -> tente connexion
    if (!walletCtx?.publicKey) {
      try {
        await connectSol();
      } catch (e: any) {
        if (e?.message === "WALLET_NOT_SELECTED") {
          setShowWalletOptions(true);
          showToastMessage("Choose a Solana wallet (Phantom/Backpack/Solflare), then click Bridge again.");
          return;
        }
        showToastMessage("Unable to connect Solana wallet (popup rejected?).");
        return;
      }
    }
    if (!walletCtx?.publicKey) {
      showToastMessage("Please connect your Solana wallet first (popup rejected?).");
      return;
    }

    if (!solAccount || !ethAccount) {
      showToastMessage("Please connect both wallets!");
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      showToastMessage("Please enter a valid amount!");
      return;
    }
    if (!ethersUtils.isAddress(destAddress)) {
      showToastMessage("Please enter a valid Ethereum address!");
      return;
    }

    setLoading(true);
    try {
      // Définir l'EID selon le réseau sélectionné
      const remoteEid = evmNetwork === "ethereum" ? 30101 : 30184; // Ethereum: 30101, Base: 30184
      
      const sig = await sendOftBridge({
        connection: solanaConnection,
        wallet: walletCtx,
        amountUi: amount,
        toAddress: destAddress as `0x${string}`,
        tokenDecimals: 9,
        remoteEid: remoteEid,
      });
      setSuccessTxHash(sig);
      setShowSuccess(true);
    } catch (err: any) {
      showToastMessage("Bridge error: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  if (!isClient) return null;

  // Active si on a une PK (contexte) ou l’addr du hook
  const hasSolanaPk = !!(walletCtx?.publicKey || solAccount);
  const disabled = loading || !hasSolanaPk;
  const disabledReason = !hasSolanaPk ? "Connect your Solana wallet" : loading ? "Bridging in progress..." : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center py-4 px-4">
      <img src="/logo.png" alt="Logo" className="mb-4 w-20 h-20 sm:mb-6 sm:w-24 sm:h-24" />
      <div className="text-3xl sm:text-5xl font-extrabold tracking-wider text-white mb-2 sm:mb-3 text-center">FUCKCOIN</div>
      <div className="text-lg sm:text-2xl text-[#a7a7a7] mb-6 sm:mb-8 text-center">Fuck you higher bridge.</div>

      <div className="bg-[#181A20] border border-[#293244] rounded-2xl p-4 sm:p-8 shadow-lg max-w-2xl w-full">
        <div className="flex gap-3 sm:gap-6 mb-4 sm:mb-6 relative">
          <div className="flex-1">
            <div className="mb-2 text-gray-400 font-semibold">From</div>
            <div className="bg-[#23242b] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Amount</span>
                <span className="flex items-center gap-1">
                  Balance: {bridgeDirection === "solana-to-evm" ? (solAccount ? formatBalance(fuckBalance) : "0,00") : (ethAccount ? formatBalance(Number(ethTokenBalance ?? "0")) : "0,00")}
                  <img src="/fuckcoin.svg" className="inline w-5 h-5" alt="FUCKCOIN" />
                </span>
              </div>
              <input
                className="w-full text-xl sm:text-2xl font-medium border-0 outline-none bg-transparent text-white mt-2 mb-2"
                placeholder={bridgeDirection === "solana-to-evm" ? "100" : "100"}
                type="number"
                value={bridgeDirection === "solana-to-evm" ? amount : (bridgeDirection === "evm-to-solana" ? amount : "")}
                onChange={bridgeDirection === "solana-to-evm" ? (e) => setAmount(e.target.value) : (bridgeDirection === "evm-to-solana" ? (e) => setAmount(e.target.value) : undefined)}
                disabled={false}
                min="0"
              />
              <div className="flex items-center justify-end gap-2">
                <img src={bridgeDirection === "solana-to-evm" ? "/solana.svg" : (evmNetwork === "ethereum" ? "/eth.svg" : "/base.svg")} className="w-7 h-7" alt={bridgeDirection === "solana-to-evm" ? "Solana" : (evmNetwork === "ethereum" ? "Ethereum" : "Base")} />
                {bridgeDirection === "solana-to-evm" ? (
                  <span className="text-white font-semibold">SOL</span>
                ) : (
                  <select
                    className="bg-transparent text-gray-300 outline-none"
                    value={evmNetwork}
                    onChange={(e) => ensureEvmNetwork(e.target.value as "ethereum" | "base")}
                  >
                    <option value="ethereum">ETH</option>
                    <option value="base">BASE</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Bouton Swap */}
          <div className="flex items-center justify-center absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
            <button
              onClick={() => setBridgeDirection(prev => prev === "solana-to-evm" ? "evm-to-solana" : "solana-to-evm")}
              className="bg-[#151b25] border border-[#293244] rounded-full p-2 hover:bg-[#222936] transition-colors"
              title="Inverser la direction du bridge"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
          </div>

          <div className="flex-1">
            <div className="mb-2 text-gray-400 font-semibold">To</div>
            <div className="bg-[#23242b] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>You will receive</span>
                <span className="flex items-center gap-1">
                  Balance: {bridgeDirection === "solana-to-evm" ? (ethAccount ? formatBalance(Number(ethTokenBalance ?? "0")) : "0,00") : (solAccount ? formatBalance(fuckBalance) : "0,00")}
                  <img src="/fuckcoin.svg" className="inline w-5 h-5" alt="FUCKCOIN" />
                </span>
              </div>
              <input 
                className="w-full text-xl sm:text-2xl font-medium border-0 outline-none bg-transparent text-white mt-2 mb-2" 
                placeholder="0.0" 
                type="number" 
                value=""
                onChange={undefined}
                disabled={true}
              />
              <div className="flex items-center justify-end gap-2">
                <img src={bridgeDirection === "solana-to-evm" ? (evmNetwork === "ethereum" ? "/eth.svg" : "/base.svg") : "/solana.svg"} className="w-7 h-7" alt={bridgeDirection === "solana-to-evm" ? (evmNetwork === "ethereum" ? "Ethereum" : "Base") : "Solana"} />
                {bridgeDirection === "solana-to-evm" ? (
                  <select
                    className="bg-transparent text-gray-300 outline-none"
                    value={evmNetwork}
                    onChange={(e) => ensureEvmNetwork(e.target.value as "ethereum" | "base")}
                  >
                    <option value="ethereum">ETH</option>
                    <option value="base">BASE</option>
                  </select>
                ) : (
                  <span className="text-white font-semibold">SOL</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Wallets - Amélioration responsive */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Première colonne - Source/Destination selon direction */}
          <div className="flex-1 flex items-center bg-[#23242b] border border-[#293244] rounded-xl p-3 text-white font-bold gap-2 relative">
            <img src={bridgeDirection === "solana-to-evm" ? "/solana.svg" : (evmNetwork === "ethereum" ? "/eth.svg" : "/base.svg")} className="w-6 h-6" alt={bridgeDirection === "solana-to-evm" ? "Solana" : (evmNetwork === "ethereum" ? "Ethereum" : "Base")} />
            {bridgeDirection === "solana-to-evm" ? "Solana" : (evmNetwork === "ethereum" ? "Ethereum" : "Base")}
            {bridgeDirection === "solana-to-evm" ? (
              !solAccount ? (
                <button
                  onClick={() => setShowWalletOptions(!showWalletOptions)}
                  className="ml-auto px-3 py-2 sm:px-4 sm:py-2 bg-[#151b25] text-white rounded font-semibold border border-[#293244] hover:bg-[#222936] transition text-sm sm:text-base"
                >
                  Select Wallet
                </button>
              ) : (
                <div className="ml-auto flex items-center gap-2">
                  <span className="px-3 py-2 bg-[#181a20] rounded text-xs font-mono">
                    {solAccount.slice(0, 6)}...{solAccount.slice(-4)}
                  </span>
                  {!walletCtx?.connected && walletCtx?.publicKey && (
                    <button
                      onClick={() => connectSol()?.catch(console.error)}
                      className="px-3 py-2 bg-[#1f2937] rounded text-xs border border-[#293244]"
                    >
                      Connect now
                    </button>
                  )}
                  <button
                    onClick={() => {
                      disconnect();
                      setShowWalletOptions(false);
                    }}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )
            ) : (
              <div className="ml-auto">
                <EthereumConnect
                  network={evmNetwork}
                  tokenAddress={evmNetwork === "ethereum" ? 
                    (process.env.NEXT_PUBLIC_ETHEREUM_OFT_ADDRESS || "0x95dB68675CaC0E52E7124039f167f435e85c9c39") :
                    (process.env.NEXT_PUBLIC_BASE_OFT_ADDRESS || "0x95dB68675CaC0E52E7124039f167f435e85c9c39")
                  }
                  // @ts-ignore
                  buttonClassName="ml-auto px-4 py-2 bg-[#151b25] text-white rounded font-semibold border border-[#293244] hover:bg-[#222936] transition"
                  // @ts-ignore
                  buttonLabel="Select Wallet"
                  onConnect={(address, balance, provider, tokenBalance) => {
                    setEthAccount(address);
                    setEthBalance(balance);
                    setEthTokenBalance(tokenBalance || "0");
                    setDestAddress(address);
                  }}
                />
              </div>
            )}
            {showWalletOptions && !solAccount && (
              <div className="absolute top-full mt-2 bg-[#181a20] border border-[#293244] rounded-xl shadow-lg p-2 flex flex-col z-50 min-w-[150px]">
                <button
                  className="px-4 py-2 hover:bg-[#222936] text-left flex items-center gap-2"
                  onClick={() => handleSolanaWalletSelection("Phantom", selectWallet, connectSol, setShowWalletOptions, showToastMessage)}
                >
                  <span>👻</span> Phantom
                  {isMobile() && <span className="text-xs text-gray-400">(app)</span>}
                </button>
                <button
                  className="px-4 py-2 hover:bg-[#222936] text-left flex items-center gap-2"
                  onClick={() => handleSolanaWalletSelection("Backpack", selectWallet, connectSol, setShowWalletOptions, showToastMessage)}
                >
                  <span>🎒</span> Backpack
                  {isMobile() && <span className="text-xs text-gray-400">(app)</span>}
                </button>
                <button
                  className="px-4 py-2 hover:bg-[#222936] text-left flex items-center gap-2"
                  onClick={() => handleSolanaWalletSelection("Solflare", selectWallet, connectSol, setShowWalletOptions, showToastMessage)}
                >
                  <span>☀️</span> Solflare
                  {isMobile() && <span className="text-xs text-gray-400">(app)</span>}
                </button>
              </div>
            )}
          </div>

          {/* Deuxième colonne - Destination/Source selon direction */}
          <div className="flex-1 flex items-center bg-[#23242b] border border-[#293244] rounded-xl p-3 text-white font-bold gap-2">
            <img src={bridgeDirection === "solana-to-evm" ? (evmNetwork === "ethereum" ? "/eth.svg" : "/base.svg") : "/solana.svg"} className="w-6 h-6" alt={bridgeDirection === "solana-to-evm" ? (evmNetwork === "ethereum" ? "Ethereum" : "Base") : "Solana"} />
            {bridgeDirection === "solana-to-evm" ? (evmNetwork === "ethereum" ? "Ethereum" : "Base") : "Solana"}
            {bridgeDirection === "solana-to-evm" ? (
              // Mode Solana → EVM : afficher wallet EVM
              <div className="ml-auto">
                <EthereumConnect
                  network={evmNetwork}
                  tokenAddress={evmNetwork === "ethereum" ? 
                    (process.env.NEXT_PUBLIC_ETHEREUM_OFT_ADDRESS || "0x95dB68675CaC0E52E7124039f167f435e85c9c39") :
                    (process.env.NEXT_PUBLIC_BASE_OFT_ADDRESS || "0x95dB68675CaC0E52E7124039f167f435e85c9c39")
                  }
                  // @ts-ignore
                  buttonClassName="ml-auto px-4 py-2 bg-[#151b25] text-white rounded font-semibold border border-[#293244] hover:bg-[#222936] transition"
                  // @ts-ignore
                  buttonLabel="Select Wallet"
                  onConnect={(address, balance, provider, tokenBalance) => {
                    setEthAccount(address);
                    setEthBalance(balance);
                    setEthTokenBalance(tokenBalance || "0");
                    setDestAddress(address);
                  }}
                />
              </div>
            ) : (
              // Mode EVM → Solana : afficher wallet Solana
              !solAccount ? (
                <button
                  onClick={() => setShowWalletOptions(!showWalletOptions)}
                  className="ml-auto px-3 py-2 sm:px-4 sm:py-2 bg-[#151b25] text-white rounded font-semibold border border-[#293244] hover:bg-[#222936] transition text-sm sm:text-base"
                >
                  Select Wallet
                </button>
              ) : (
                <div className="ml-auto flex items-center gap-2">
                  <span className="px-3 py-2 bg-[#181a20] rounded text-xs font-mono">
                    {solAccount.slice(0, 6)}...{solAccount.slice(-4)}
                  </span>
                  <button
                    onClick={() => {
                      disconnect();
                      setShowWalletOptions(false);
                    }}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {/* Adresse de destination */}
        <div className="mb-4 sm:mb-6">
          <input
            type="text"
            className="w-full rounded-xl bg-[#23242b] text-white p-3 placeholder-gray-400 border border-[#293244] outline-none text-sm sm:text-base"
            placeholder={bridgeDirection === "solana-to-evm" ? "Enter Ethereum address (0x...)" : "Enter Solana address (base58...)"}
            value={destAddress}
            onChange={(e) => setDestAddress(e.target.value)}
          />
        </div>

        {/* Bridge */}
        <div className="flex justify-center mt-4 sm:mt-6">
          <button
            className="px-6 py-3 sm:px-8 sm:py-3 bg-[#151b25] text-white rounded-lg font-semibold border border-[#293244] hover:bg-[#222936] transition disabled:opacity-50 text-base sm:text-lg min-w-[120px] w-full sm:w-auto max-w-xs"
            onClick={handleBridge}
            disabled={disabled}
            title={disabledReason ?? ""}
          >
            {loading ? "Bridging..." : "Bridge"}
          </button>
        </div>

      </div>

      <div className="flex items-center justify-center mt-4 sm:mt-6">
        <div className="flex items-center bg-[#23242b] rounded-lg px-2 py-1 font-semibold text-white text-sm sm:text-lg shadow-md">
          <span className="hidden sm:inline">Powered by</span>
          <span className="sm:hidden">By</span>
          <img src="/layerzero.svg" alt="LayerZero Logo" className="w-24 h-8 sm:w-32 sm:h-10 mx-2 sm:mx-3" />
        </div>
      </div>

      {/* Pop-up de succès */}
      <SuccessNotification
        show={showSuccess}
        onClose={() => setShowSuccess(false)}
        amount={amount}
        txHash={successTxHash}
        network={evmNetwork}
        bridgeDirection={bridgeDirection}
      />

      {/* Toast notifications */}
      <Toast
        message={toastMessage}
        type={toastType}
        show={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
