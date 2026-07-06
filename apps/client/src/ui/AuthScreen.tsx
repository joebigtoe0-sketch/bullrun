import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import bs58 from 'bs58';
import { api, saveToken } from '../api/client';
import { useGameStore } from '../store/gameStore';
import { Logo } from './Logo';

type Step = 'connect' | 'sign' | 'displayName';

export function AuthScreen() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const setAuth = useGameStore((s) => s.setAuth);
  const setMe = useGameStore((s) => s.setMe);
  const setWallet = useGameStore((s) => s.setWallet);
  const token = useGameStore((s) => s.token);
  const hasDisplayName = useGameStore((s) => s.hasDisplayName);

  const [step, setStep] = useState<Step>('connect');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const wallet = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (token && !hasDisplayName) setStep('displayName');
  }, [token, hasDisplayName]);

  useEffect(() => {
    if (connected && wallet && step === 'connect' && !token) setStep('sign');
  }, [connected, wallet, step, token]);

  const signIn = useCallback(async () => {
    if (!wallet || !signMessage) {
      setError("Your wallet doesn't support message signing.");
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { message } = await api.authNonce(wallet);
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(sigBytes);
      const res = await api.authVerify(wallet, signature);
      setWallet(wallet);
      saveToken(res.token);
      if (res.user.hasDisplayName) {
        setAuth(res.token, res.user);
        const me = await api.me();
        setMe(me);
      } else {
        setPendingToken(res.token);
        setDisplayName('');
        setStep('displayName');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [wallet, signMessage, setAuth, setMe, setWallet]);

  const submitDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (name.length < 2) return;
    setError('');
    setLoading(true);
    try {
      const tok = pendingToken ?? token;
      if (tok && !token) saveToken(tok);
      const res = await api.setDisplayName(name);
      saveToken(res.token);
      setAuth(res.token, res.user);
      const me = await api.me();
      setMe(me);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setError('');
    setPendingToken(null);
    localStorage.removeItem('bullrun.token');
    disconnect().catch(() => {});
    setStep('connect');
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo className="auth-logo" />
        <h1>Bull Run</h1>
        <p>Token-gated bull racing MMO</p>

        {step === 'displayName' ? (
          <form onSubmit={submitDisplayName}>
            <p className="auth-hint">Wallet connected. Pick a display name for the ranch.</p>
            <input
              autoFocus
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={24}
              required
            />
            {error && <div className="error">{error}</div>}
            <button type="submit" className="br-btn gold auth-btn" disabled={loading || displayName.trim().length < 2}>
              {loading ? '...' : 'Enter game'}
            </button>
          </form>
        ) : step === 'sign' ? (
          <>
            <p className="auth-hint">Connected as <span className="wallet-chip">{wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : ''}</span></p>
            <p className="auth-hint">Sign a free message to prove you own this wallet.</p>
            {error && <div className="error">{error}</div>}
            <div className="auth-actions">
              <button type="button" className="br-btn gold auth-btn" onClick={signIn} disabled={loading}>
                {loading ? 'Waiting for signature…' : 'Sign & continue'}
              </button>
              <button type="button" className="link-btn" onClick={reset}>Use a different wallet</button>
            </div>
          </>
        ) : (
          <>
            <p className="auth-hint">Connect your Solana wallet to play. Hold 1,000 tokens to enter.</p>
            <button type="button" className="br-btn gold auth-btn auth-connect-btn" onClick={() => setVisible(true)}>
              <span className="auth-connect-icon" aria-hidden>
                <svg viewBox="0 0 24 24"><path d="M4 8h16v2H4V8zm0 5h10v2H4v-2z"/></svg>
              </span>
              Connect wallet
            </button>
          </>
        )}
      </div>
    </div>
  );
}
