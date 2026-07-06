import { useGameStore } from '../store/gameStore';

export function GateScreen() {
  const {
    tokenBalance,
    accessRequired,
    accessChecking,
    checkAccess,
    logout,
  } = useGameStore();

  const missing = Math.max(0, accessRequired - tokenBalance);

  return (
    <div className="auth-screen gate-screen">
      <div className="auth-card">
        <h1>🐂 Bull Run</h1>
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

        <button type="button" className="br-btn gold auth-btn" onClick={() => void checkAccess()} disabled={accessChecking}>
          {accessChecking ? 'Checking balance…' : "I've bought — re-check balance"}
        </button>
        <button type="button" className="link-btn" onClick={logout}>Disconnect wallet</button>
      </div>
    </div>
  );
}
