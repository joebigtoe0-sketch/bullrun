import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { api } from './api/client';
import { AuthScreen } from './ui/AuthScreen';
import { GameUI } from './ui/GameUI';
import { GameCanvas } from './world/GameCanvas';
import { useGameLoop } from './game/loop';
import { ErrorBoundary } from './ui/ErrorBoundary';

export default function App() {
  const token = useGameStore((s) => s.token);
  const me = useGameStore((s) => s.me);
  const setAuth = useGameStore((s) => s.setAuth);
  const setMe = useGameStore((s) => s.setMe);

  useEffect(() => {
    if (token && !me) {
      api.me()
        .then((m) => {
          setMe(m);
          setAuth(token, { id: m.id, username: m.username, displayName: m.displayName });
        })
        .catch(() => useGameStore.getState().logout());
    }
  }, [token, me, setAuth, setMe]);

  useGameLoop();

  if (!token || !me) return <AuthScreen />;

  return (
    <ErrorBoundary>
      <div className="game-root">
        <GameCanvas />
        <GameUI />
      </div>
    </ErrorBoundary>
  );
}
