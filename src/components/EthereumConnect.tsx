// src/components/EthereumConnect.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useEthereumWalletConnect } from "@/hooks/useWeb3Modal";

type SupportedNet = "ethereum" | "base";

interface EthereumConnectProps {
  onConnect?: (
    address: string,
    nativeBalanceEth: string,
    provider: ethers.providers.Web3Provider,
    tokenBalance?: string
  ) => void;
  /** Réseau imposé par le parent (pas de sélecteur ici) */
  network: SupportedNet;
  /** Adresse ERC20 FUCKCOIN sur ce réseau (par défaut: Ethereum) */
  tokenAddress?: string;
  /** Si true, on switch/ajoute la chain automatiquement dans MetaMask */
  autoSwitch?: boolean;
  /** Classe appliquée au bouton (tu gères le style dans page.tsx) */
  buttonClassName?: string;
  /** Libellé du bouton (facultatif) */
  buttonLabel?: string;
}

const NETWORKS: Record<
  SupportedNet,
  {
    chainIdHex: string;
    chainIdDec: number;
    name: string;
    rpcUrls: string[];
    currency: { name: string; symbol: string; decimals: number };
    blockExplorer: string;
  }
> = {
  ethereum: {
    chainIdHex: "0x1",
    chainIdDec: 1,
    name: "Ethereum Mainnet",
    rpcUrls: [process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || "https://eth.drpc.org", "https://rpc.ankr.com/eth"],
    currency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://etherscan.io",
  },
  base: {
    chainIdHex: "0x2105", // 8453
    chainIdDec: 8453,
    name: "Base",
    rpcUrls: [process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"],
    currency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://basescan.org",
  },
};

const MIN_ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

// FUCKCOIN ERC-20 (Ethereum/Base mainnet). Pour Base, passe l'adresse via la prop tokenAddress.
const DEFAULT_TOKEN = "0x95dB68675CaC0E52E7124039f167f435e85c9c39";

const EthereumConnect: React.FC<EthereumConnectProps> = ({
  onConnect,
  network,
  tokenAddress = DEFAULT_TOKEN,
  autoSwitch = true,
  buttonClassName,
  buttonLabel = "Select Wallet",
}) => {
  const [account, setAccount] = useState<string | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  
  // Hook WalletConnect
  const walletConnect = useEthereumWalletConnect();

  // Détection mobile
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      typeof navigator !== 'undefined' ? navigator.userAgent : ''
    );
  };

  const disconnect = () => {
    setAccount(null);
    setNativeBalance(null);
    setTokenBalance(null);
    setError("");
    setShowWalletOptions(false);
    
    // Déconnecter WalletConnect aussi si connecté
    if (walletConnect.isConnected) {
      walletConnect.disconnect();
    }
  };

  const netCfg = useMemo(() => NETWORKS[network], [network]);

  // Helpers - Detection avec logs
  const getProvider = () => {
    const eth = (typeof window !== "undefined" && (window as any).ethereum) || null;
    
    console.log('🔍 Ethereum provider detection:', {
      hasWindow: typeof window !== "undefined",
      hasEthereum: !!(window as any).ethereum,
      isMetaMask: eth?.isMetaMask,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || ''),
      userAgent: navigator?.userAgent
    });
    
    if (!eth) {
      throw new Error("No Ethereum wallet detected. Please install MetaMask or open this page in MetaMask app browser.");
    }
    
    // Accepter tout provider Ethereum sur mobile ET desktop
    return new ethers.providers.Web3Provider(eth, "any");
  };

  // Provider alternatif avec notre RPC Infura direct
  const getDirectProvider = () => {
    const rpcUrl = network === 'base' 
      ? (process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org")
      : (process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || "https://eth.drpc.org");
    return new ethers.providers.JsonRpcProvider(rpcUrl);
  };

  const switchOrAddChain = async () => {
    if (!autoSwitch) return;
    if (!netCfg) throw new Error("Invalid EVM network.");
    const eth = (window as any).ethereum;
    if (!eth) return;
    
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: netCfg.chainIdHex }],
      });
    } catch (switchErr: any) {
      // 4902 = chaîne non ajoutée
      if (switchErr?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: netCfg.chainIdHex,
              chainName: netCfg.name,
              rpcUrls: netCfg.rpcUrls,
              nativeCurrency: netCfg.currency,
              blockExplorerUrls: [netCfg.blockExplorer],
            },
          ],
        });
      } else {
        throw switchErr;
      }
    }
  };

  const readBalances = async (
    provider: ethers.providers.Web3Provider,
    user: string
  ) => {
    // Solde natif
    const wei = await provider.getBalance(user);
    const native = ethers.utils.formatEther(wei);
    setNativeBalance(native);

    // Test de base - vérifier si le contrat existe
    try {
      const code = await provider.getCode(tokenAddress);
      if (code === '0x') {
        setTokenBalance("0");
        return { nativeBalance: native, tokenBalance: "0" };
      }
    } catch (codeErr) {
      // Contract check failed, continue anyway
    }

    // Solde token - essayer avec le provider direct d'abord
    let tokenBal = null;
    try {
      // Essayer avec le provider direct (Infura)
      const directProvider = getDirectProvider();
      const directErc20 = new ethers.Contract(tokenAddress, MIN_ERC20_ABI, directProvider);
      
      let dec = tokenDecimals;
      try {
        dec = await directErc20.decimals();
        setTokenDecimals(dec);
      } catch (decErr) {
        // Failed to read decimals, use default
      }
      
      // Lire balance avec provider direct
      try {
        const rawDirect = await directErc20.balanceOf(user);
        
        if (rawDirect.gt(0)) {
          tokenBal = ethers.utils.formatUnits(rawDirect, dec);
        } else {
          // Si direct donne 0, essayer avec MetaMask provider
          const erc20 = new ethers.Contract(tokenAddress, MIN_ERC20_ABI, provider);
          const rawMetaMask = await erc20.balanceOf(user);
          tokenBal = ethers.utils.formatUnits(rawMetaMask, dec);
        }
      } catch (directErr) {
        const erc20 = new ethers.Contract(tokenAddress, MIN_ERC20_ABI, provider);
        const raw = await erc20.balanceOf(user);
        tokenBal = ethers.utils.formatUnits(raw, dec);
      }
      
      setTokenBalance(tokenBal);
    } catch (tokenErr) {
      setTokenBalance(null);
    }
    
    return { nativeBalance: native, tokenBalance: tokenBal };
  };

  const connectWallet = async () => {
    try {
      console.log('🚀 Starting wallet connection...');
      setLoading(true);
      setError("");

      if (!netCfg) throw new Error("Invalid EVM network.");

      // Essayer directement sans vérifications compliquées
      const provider = getProvider();
      console.log('✅ Provider obtained');

      // Basculer vers le bon réseau si demandé
      await switchOrAddChain();
      console.log('✅ Chain switched/verified');

      // Demander les comptes
      console.log('🔑 Requesting accounts...');
      const accounts: string[] = await provider.send("eth_requestAccounts", []);
      console.log('✅ Accounts received:', accounts?.length);
      
      const selected = accounts?.[0];
      if (!selected) throw new Error("No account selected.");
      setAccount(selected);

      // Lire les soldes
      console.log('💰 Reading balances...');
      const balances = await readBalances(provider, selected);
      console.log('✅ Balances read');

      onConnect?.(selected, balances.nativeBalance || "0", provider, balances.tokenBalance || "0");
      console.log('🎉 Connection successful!');
    } catch (e: any) {
      console.error('❌ Connection error:', e);
      setError(e?.message || "Connection error.");
    } finally {
      setLoading(false);
    }
  };

  const connectWalletConnect = async () => {
    try {
      console.log('🚀 Starting WalletConnect connection...');
      setLoading(true);
      setError("");

      await walletConnect.connectWalletConnect();
      
      // WalletConnect est maintenant connecté, récupérer l'adresse
      if (walletConnect.address) {
        setAccount(walletConnect.address);
        console.log('✅ WalletConnect connected:', walletConnect.address);
        
        // Pour WalletConnect, on utilise notre RPC direct pour les balances
        const directProvider = getDirectProvider();
        const balances = await readBalances(directProvider, walletConnect.address);
        
        onConnect?.(walletConnect.address, balances.nativeBalance || "0", directProvider, balances.tokenBalance || "0");
        console.log('🎉 WalletConnect connection successful!');
      }
    } catch (e: any) {
      console.error('❌ WalletConnect connection error:', e);
      setError(e?.message || "WalletConnect connection error.");
    } finally {
      setLoading(false);
    }
  };

  // Si le parent change de réseau et qu'on est déjà connecté → switch + relire
  useEffect(() => {
    (async () => {
      if (!account) return;
      try {
        const provider = getProvider();
        await switchOrAddChain();
        await readBalances(provider, account);
      } catch (e) {
        // Network switch failed, continue
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  // Écouter les changements WalletConnect
  useEffect(() => {
    if (walletConnect.isConnected && walletConnect.address && !account) {
      // WalletConnect s'est connecté
      setAccount(walletConnect.address);
      (async () => {
        try {
          const directProvider = getDirectProvider();
          const balances = await readBalances(directProvider, walletConnect.address);
          onConnect?.(walletConnect.address, balances.nativeBalance || "0", directProvider, balances.tokenBalance || "0");
        } catch (e) {
          console.error('Error reading WalletConnect balances:', e);
        }
      })();
    } else if (!walletConnect.isConnected && account === walletConnect.address) {
      // WalletConnect s'est déconnecté
      disconnect();
    }
  }, [walletConnect.isConnected, walletConnect.address, account, onConnect]);

  // Écoute MetaMask (changement de compte / réseau)
  useEffect(() => {
    const eth = (typeof window !== "undefined" && (window as any).ethereum) || null;
    if (!eth) return;

    const handleAccountsChanged = (accs: string[]) => {
      const a = accs?.[0] || null;
      setAccount(a);
      if (!a) {
        setNativeBalance(null);
        setTokenBalance(null);
      } else {
        try {
          const provider = getProvider();
          readBalances(provider, a).then((balances) => {
            onConnect?.(a, balances.nativeBalance || "0", provider, balances.tokenBalance || "0");
          });
        } catch {}
      }
    };

    const handleChainChanged = () => {
      // Plus de rechargement automatique - juste se déconnecter
      console.log('Chain changed, disconnecting...');
      disconnect();
    };

    eth.on?.("accountsChanged", handleAccountsChanged);
    eth.on?.("chainChanged", handleChainChanged);
    return () => {
      eth.removeListener?.("accountsChanged", handleAccountsChanged);
      eth.removeListener?.("chainChanged", handleChainChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const symbol = netCfg?.currency?.symbol ?? "ETH";

  return (
    <div className="flex items-center gap-2">
      {!account && !walletConnect.isConnected ? (
        <div className="relative">
          <button
            onClick={() => setShowWalletOptions(!showWalletOptions)}
            className={buttonClassName ?? ""}
            disabled={loading}
          >
            {loading ? "Connecting..." : buttonLabel}
          </button>
          
          {showWalletOptions && (
            <div className="absolute top-full left-0 mt-1 bg-[#181a20] border border-gray-700 rounded p-2 min-w-48 z-50">
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    setShowWalletOptions(false);
                    connectWallet();
                  }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded text-sm"
                >
                  <span>🦊</span> MetaMask
                </button>
                
                {isMobile() && (
                  <button
                    onClick={() => {
                      setShowWalletOptions(false);
                      connectWalletConnect();
                    }}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded text-sm"
                  >
                    <span>🔗</span> WalletConnect
                    <span className="text-xs text-gray-400">(mobile wallets)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="px-3 py-2 bg-[#181a20] rounded text-xs font-mono">
            {(account || walletConnect.address)?.slice(0, 6)}...{(account || walletConnect.address)?.slice(-4)}
          </span>
          <button
            onClick={disconnect}
            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
      {error && <div className="text-red-500 text-xs ml-2">{error}</div>}
    </div>
  );
};

export default EthereumConnect;
