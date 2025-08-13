"use client";

import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount, useDisconnect } from 'wagmi'
import { useCallback } from 'react'

export const useEthereumWalletConnect = () => {
  const { open } = useWeb3Modal()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  const connectWalletConnect = useCallback(async () => {
    try {
      await open()
      return { success: true }
    } catch (error) {
      console.error('WalletConnect error:', error)
      throw error
    }
  }, [open])

  const disconnectWalletConnect = useCallback(() => {
    disconnect()
  }, [disconnect])

  return {
    connectWalletConnect,
    disconnect: disconnectWalletConnect,
    address: address || '',
    isConnected,
    isWalletConnect: true
  }
}