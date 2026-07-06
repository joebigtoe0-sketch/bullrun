import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { api } from './api/client';
import { AuthScreen } from './ui/AuthScreen';
import { GateScreen } from './ui/GateScreen';
import { GameUI } from './ui/GameUI';
import { CanvasWorld } from './world/CanvasWorld';
import { useGameLoop } from './game/loop';
import { ErrorBoundary } from './ui/ErrorBoundary';

export default function App() {
  const token = useGameStore((s) => s.token);
  const me = useGameStore((s) => s.me);
  const hasDisplayName = useGameStore((s) => s.hasDisplayName);
  const hasAccess = useGameStore((s) => s.hasAccess);
  const setAuth = useGameStore((s) => s.setAuth);
  const setMe = useGameStore((s) => s.setMe);
  const setWallet = useGameStore((s) => s.setWallet);
  const checkAccess = useGameStore((s) => s.checkAccess);

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

  useEffect(() => {
    if (token && me && hasDisplayName) {
      void checkAccess();
    }
  }, [token, me, hasDisplayName, checkAccess]);

  useGameLoop();

  if (!token) return <AuthScreen />;
  if (!me) {
    return (
      <div className="auth-screen">
        <div className="auth-card"><p>Loading ranch…</p></div>
      </div>
    );
  }
  if (!hasDisplayName) return <AuthScreen />;
  if (hasAccess === null) {
    return (
      <div className="auth-screen">
        <div className="auth-card"><p>Checking token balance…</p></div>
      </div>
    );
  }
  if (!hasAccess) return <GateScreen />;

  return (
    <ErrorBoundary>
      <div className="game-root">
        <CanvasWorld />
        <GameUI />
      </div>
    </ErrorBoundary>
  );
}
