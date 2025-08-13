import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { FC } from 'react';

type Props = { readonly children: React.ReactNode };

const endpoint = process.env.NEXT_PUBLIC_HELIUS_API_KEY && process.env.NEXT_PUBLIC_HELIUS_API_KEY !== 'YOUR_HELIUS_API_KEY_HERE'
  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`
  : "https://api.mainnet-beta.solana.com";

// Liste des wallets dispo dans la pop-up
const wallets = [
  new PhantomWalletAdapter(),
  new BackpackWalletAdapter(), // 👈 ajout
  new SolflareWalletAdapter(),
];

export const SolanaWalletProvider: FC<Props> = ({ children }) => (
  <ConnectionProvider endpoint={endpoint}>
    <WalletProvider wallets={wallets} autoConnect={true}>
      {children}
    </WalletProvider>
  </ConnectionProvider>
);
