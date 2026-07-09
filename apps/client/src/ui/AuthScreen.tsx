import { useState } from 'react';
import { api, saveToken } from '../api/client';
import { useGameStore } from '../store/gameStore';
import { Logo } from './Logo';
import { OnlineBadge } from './OnlineBadge';
import { GameGuide } from './GameGuide';
import { useOnlineCount } from '../hooks/useOnlineCount';

type Mode = 'login' | 'register';

export function AuthScreen() {
  const setAuth = useGameStore((s) => s.setAuth);
  const setMe = useGameStore((s) => s.setMe);

  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const playersOnline = useOnlineCount();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res =
        mode === 'register'
          ? await api.register(username.trim(), password, displayName.trim() || undefined)
          : await api.login(username.trim(), password);
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

  const canSubmit = username.trim().length >= 3 && password.length >= 4;

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <OnlineBadge count={playersOnline} />
        <Logo className="auth-logo" />
        <h1>Bull Run</h1>
        <p>Bull racing MMO</p>

        <form onSubmit={submit}>
          <input
            autoFocus
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={24}
            autoComplete="username"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={72}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
          />
          {mode === 'register' && (
            <input
              placeholder="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={24}
            />
          )}
          {error && <div className="error">{error}</div>}
          <button type="submit" className="br-btn gold auth-btn" disabled={loading || !canSubmit}>
            {loading ? '…' : mode === 'register' ? 'Create account & play' : 'Log in'}
          </button>
        </form>

        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setError('');
            setMode(mode === 'login' ? 'register' : 'login');
          }}
        >
          {mode === 'login' ? 'New here? Create an account →' : '← Back to log in'}
        </button>
        <p className="auth-hint" style={{ marginTop: 10, marginBottom: 0 }}>
          No wallet needed to play — connect one later in Profile for the token market and daily wheel.
        </p>
        <button type="button" className="link-btn" onClick={() => setGuideOpen(true)}>Read the game guide →</button>
      </div>
      {guideOpen && <GameGuide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
