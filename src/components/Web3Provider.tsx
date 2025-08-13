"use client";

import { createWeb3Modal } from '@web3modal/wagmi/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { mainnet, base } from 'wagmi/chains'
import { createConfig, http } from 'wagmi'
import { walletConnect } from 'wagmi/connectors'
import { ReactNode } from 'react'

// 1. Get projectId from https://cloud.walletconnect.com
const projectId = '8c4cc611fb2be9cf2d2c78f8c4fbf2f5' // Project ID public pour tests

// 2. Create wagmiConfig
const config = createConfig({
  chains: [mainnet, base],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
  connectors: [
    walletConnect({
      projectId,
      metadata: {
        name: 'FUCKCOIN Bridge',
        description: 'Bridge FUCKCOIN between Solana and EVM chains',
        url: 'https://bridgefuckcoin.app',
        icons: ['https://bridgefuckcoin.app/logo.png']
      }
    })
  ],
})

// 3. Create modal
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: false, // Optional - defaults to your Cloud configuration
  themeMode: 'dark',
  themeVariables: {
    '--w3m-color-mix': '#0a0a0a',
    '--w3m-color-mix-strength': 20
  }
})

const queryClient = new QueryClient()

interface Web3ProviderProps {
  children: ReactNode
}

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}