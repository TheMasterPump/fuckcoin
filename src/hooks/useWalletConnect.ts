"use client";
import { useState, useCallback } from 'react';
import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { ethers } from 'ethers';

const PROJECT_ID = '8c4cc611fb2be9cf2d2c78f8c4fbf2f5'; // Project ID public

export const useWalletConnect = () => {
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [address, setAddress] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string>('');

  const connectWalletConnect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError('');

      // Créer le provider WalletConnect
      const wcProvider = await EthereumProvider.init({
        projectId: PROJECT_ID,
        chains: [1, 8453], // Ethereum + Base mainnet
        showQrModal: true,
        metadata: {
          name: 'FUCKCOIN Bridge',
          description: 'Bridge FUCKCOIN between networks',
          url: 'https://bridgefuckcoin.app',
          icons: ['https://bridgefuckcoin.app/logo.png']
        }
      });

      // Se connecter
      const accounts = await wcProvider.enable();
      
      setProvider(wcProvider);
      setAddress(accounts[0]);
      
      // Écouter les événements
      wcProvider.on('accountsChanged', (accounts: string[]) => {
        setAddress(accounts[0] || '');
      });
      
      wcProvider.on('disconnect', () => {
        setProvider(null);
        setAddress('');
      });

      return {
        provider: new ethers.providers.Web3Provider(wcProvider as any),
        address: accounts[0]
      };

    } catch (err: any) {
      setError(err?.message || 'Connection failed');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      if (provider) {
        await provider.disconnect();
        setProvider(null);
        setAddress('');
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  }, [provider]);

  return {
    connectWalletConnect,
    disconnect,
    provider,
    address,
    isConnecting,
    error,
    isConnected: !!address
  };
};