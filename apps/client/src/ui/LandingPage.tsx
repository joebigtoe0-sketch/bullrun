import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { GameGuide } from './GameGuide';
import { Logo } from './Logo';
import { HeroBackdrop } from './HeroBackdrop';

const LINK_X = 'https://x.com/bullraceonsol';

export function LandingPage({ onPlay, onSpectate }: { onPlay: () => void; onSpectate: () => void }) {
  const [stats, setStats] = useState<{ online: number; monthlyPlayers: number; goldWon: number; contract: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    api.publicStats().then((s) => alive && setStats(s)).catch(() => {});
    const id = setInterval(() => {
      api.publicStats().then((s) => alive && setStats(s)).catch(() => {});
    }, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const contract = stats?.contract || '';
  const copy = () => {
    if (!contract) return;
    navigator.clipboard.writeText(contract).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="landing-root">
      <HeroBackdrop variant="landing" />

      <div className="landing-topbar">
        <button type="button" className="landing-link" onClick={() => setGuideOpen(true)}>How to Play</button>
        <a className="landing-icon" href={LINK_X} target="_blank" rel="noreferrer" aria-label="X">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23.3 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L1 2h6.4l4.4 5.9L18.9 2zm-1.1 18.1h1.7L7.1 3.8H5.3l12.5 16.3z"/></svg>
        </a>
      </div>

      <div className="landing-hero">
        <Logo className="landing-logo" />
        <h1 className="landing-title">BULL RACE</h1>
        <p className="landing-blurb">
          Raise, breed, and race bulls in a shared voxel ranch. Gather, forge gear, dress up your
          rancher, bet on global races, and trade it all on the player market — live with everyone online.
        </p>
        {contract && (
          <div className="landing-contract">
            <span className="landing-contract-label">CONTRACT</span>
            <span className="landing-contract-addr">{contract}</span>
            <button type="button" className="small-btn" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
        )}
        <div className="landing-cta">
          <button type="button" className="br-btn gold landing-play" onClick={onPlay}>Play Now</button>
          <button type="button" className="br-btn landing-spectate" onClick={onSpectate}>Spectate</button>
        </div>
      </div>

      <div className="landing-stats">
        <div className="landing-stat">
          <span className="landing-stat-val green">{stats ? stats.online : '—'}</span>
          <span className="landing-stat-label">online</span>
        </div>
        <div className="landing-stat">
          <span className="landing-stat-val blue">{stats ? stats.monthlyPlayers : '—'}</span>
          <span className="landing-stat-label">this month</span>
        </div>
        <div className="landing-stat">
          <span className="landing-stat-val gold">{stats ? `${stats.goldWon.toLocaleString()}g` : '—'}</span>
          <span className="landing-stat-label">race winnings</span>
        </div>
      </div>

      {guideOpen && <GameGuide onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
