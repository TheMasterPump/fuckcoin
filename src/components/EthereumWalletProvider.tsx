import React, { createContext, useContext, useState, ReactNode } from "react";
import { ethers } from "ethers";

type EthereumWalletContextType = {
  account: string | null;
  balance: string | null;
  provider: ethers.providers.Web3Provider | null;
  connectWallet: () => Promise<void>;
};

const EthereumWalletContext = createContext<EthereumWalletContextType | undefined>(undefined);

export const EthereumWalletProvider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);

  const connectWallet = async () => {
    // @ts-ignore
    if (!window.ethereum) return;
    // @ts-ignore
    const [selectedAccount] = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(selectedAccount);

    // @ts-ignore
    const _provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(_provider);

    const balanceWei = await _provider.getBalance(selectedAccount);
    setBalance(ethers.utils.formatEther(balanceWei));
  };

  return (
    <EthereumWalletContext.Provider value={{ account, balance, provider, connectWallet }}>
      {children}
    </EthereumWalletContext.Provider>
  );
};

export const useEthereumWallet = () => {
  const context = useContext(EthereumWalletContext);
  if (!context) throw new Error("useEthereumWallet must be used within an EthereumWalletProvider");
  return context;
};
