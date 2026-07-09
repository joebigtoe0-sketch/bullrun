import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { api } from './api/client';
import { AuthScreen } from './ui/AuthScreen';
import { GameUI } from './ui/GameUI';
import { CanvasWorld } from './world/CanvasWorld';
import { useGameLoop } from './game/loop';
import { ErrorBoundary } from './ui/ErrorBoundary';

export default function App() {
  const token = useGameStore((s) => s.token);
  const me = useGameStore((s) => s.me);
  const setAuth = useGameStore((s) => s.setAuth);
  const setMe = useGameStore((s) => s.setMe);
  const setWallet = useGameStore((s) => s.setWallet);

  useEffect(() => {
    if (token && !me) {
      api.me()
        .then((m) => {
          setMe(m);
          setAuth(token, {
            id: m.id,
            username: m.username,
            displayName: m.displayName,
            walletAddress: m.walletAddress,
            hasDisplayName: m.hasDisplayName,
          });
          if (m.walletAddress) setWallet(m.walletAddress);
        })
        .catch(() => useGameStore.getState().logout());
    }
  }, [token, me, setAuth, setMe, setWallet]);

  useGameLoop(Boolean(token && me));

  if (!token) return <AuthScreen />;
  if (!me) {
    return (
      <div className="auth-screen">
        <div className="auth-card"><p>Loading ranch…</p></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="game-root">
        <CanvasWorld />
        <GameUI />
      </div>
    </ErrorBoundary>
  );
}
