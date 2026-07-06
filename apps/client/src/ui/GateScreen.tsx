import { useGameStore } from '../store/gameStore';
import { Logo } from './Logo';
import { OnlineBadge } from './OnlineBadge';
import { GameGuide } from './GameGuide';
import { useOnlineCount } from '../hooks/useOnlineCount';
import { useState } from 'react';

export function GateScreen() {
  const [guideOpen, setGuideOpen] = useState(false);
  const playersOnline = useOnlineCount();
  const {
    tokenBalance,
    accessRequired,
    accessChecking,
    tokenGateConfigured,
    checkAccess,
    logout,
  } = useGameStore();

  const missing = Math.max(0, accessRequired - tokenBalance);

  return (
    <div className="auth-screen gate-screen">
      <div className="auth-card">
        <OnlineBadge count={playersOnline} />
        <Logo className="auth-logo" />
        <h1>Bull Run</h1>
        <p>Hold <strong>{accessRequired.toLocaleString()}</strong> tokens to play</p>

        <div className="gate-stats">
          <div className="gate-stat">
            <span className="gate-stat-label">Your balance</span>
            <span className="gate-stat-val blue">{tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="gate-stat">
            <span className="gate-stat-label">Still needed</span>
            <span className="gate-stat-val orange">{missing.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {!tokenGateConfigured ? (
          <p className="auth-hint gate-config-hint">
            Token gate is not configured on the server. Set <strong>TOKEN_ADDRESS</strong> and <strong>HELIUS_RPC_URL</strong> in Railway.
          </p>
        ) : tokenBalance === 0 ? (
          <p className="auth-hint gate-config-hint">
            Balance reads as 0 — double-check <strong>TOKEN_ADDRESS</strong> matches your token mint on mainnet.
          </p>
        ) : null}

        <button type="button" className="br-btn gold auth-btn" onClick={() => void checkAccess()} disabled={accessChecking}>
          {accessChecking ? 'Checking balance…' : "I've bought — re-check balance"}
        </button>
        <button type="button" className="link-btn" onClick={logout}>Disconnect wallet</button>
        <button type="button" className="link-btn" onClick={() => setGuideOpen(true)}>Read the game guide →</button>
      </div>
      {guideOpen && <GameGuide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
