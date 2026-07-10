import { useEffect, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { api } from './api/client';
import { AuthScreen } from './ui/AuthScreen';
import { GameUI } from './ui/GameUI';
import { CanvasWorld } from './world/CanvasWorld';
import { useGameLoop } from './game/loop';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { LandingPage } from './ui/LandingPage';
import { LoadingScreen } from './ui/LoadingScreen';
import { SpectateMode } from './ui/SpectateMode';

type Stage = 'landing' | 'loading' | 'auth' | 'game';

export default function App() {
  const token = useGameStore((s) => s.token);
  const me = useGameStore((s) => s.me);
  const spectator = useGameStore((s) => s.spectator);
  const setSpectator = useGameStore((s) => s.setSpectator);
  const setAuth = useGameStore((s) => s.setAuth);
  const setMe = useGameStore((s) => s.setMe);
  const setWallet = useGameStore((s) => s.setWallet);

  const [stage, setStage] = useState<Stage>('landing');

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

  // once logged in from the auth screen, enter the game
  useEffect(() => {
    if (stage === 'auth' && token && me) setStage('game');
  }, [stage, token, me]);

  // logging out from inside the game returns to the landing page
  useEffect(() => {
    if (stage === 'game' && !token && !spectator) setStage('landing');
  }, [stage, token, spectator]);

  useGameLoop(Boolean(stage === 'game' && token && me && !spectator));

  const startSpectate = () => {
    setSpectator(true);
    setStage('game');
  };

  if (stage === 'landing') {
    return <LandingPage onPlay={() => setStage('loading')} onSpectate={startSpectate} />;
  }

  if (stage === 'loading') {
    return <LoadingScreen onDone={() => setStage(token ? 'game' : 'auth')} />;
  }

  if (stage === 'auth') {
    return <AuthScreen onSpectate={startSpectate} />;
  }

  // stage === 'game'
  if (spectator && !me) {
    return (
      <ErrorBoundary>
        <SpectateMode
          onExit={() => {
            setSpectator(false);
            setStage('auth');
          }}
        />
      </ErrorBoundary>
    );
  }

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
