import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import type { Adapter } from '@solana/wallet-adapter-base';
import { getConfig } from '../config';
import '@solana/wallet-adapter-react-ui/styles.css';

export function WalletProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const wallets = useMemo<Adapter[]>(() => [], []);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="auth-screen" />;
  }

  const endpoint = getConfig().solanaRpc;
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
