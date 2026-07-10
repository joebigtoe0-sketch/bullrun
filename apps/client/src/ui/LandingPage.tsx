import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { GameGuide } from './GameGuide';
import { Logo } from './Logo';
import { HeroBackdrop } from './HeroBackdrop';

// TODO: point these at the real community links
const LINK_X = 'https://x.com/';
const LINK_DISCORD = 'https://discord.gg/';
const LINK_TELEGRAM = 'https://t.me/';

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
        <a className="landing-icon" href={LINK_DISCORD} target="_blank" rel="noreferrer" aria-label="Discord">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.9 3l-.6 1.2a18 18 0 0 0-6.6 0L8.1 3a19.8 19.8 0 0 0-4.4 1.4C1.4 8.5.8 12.5 1.1 16.4A19.9 19.9 0 0 0 6.1 19l1.1-1.7c-.6-.2-1.2-.5-1.8-.9l.4-.3a14.2 14.2 0 0 0 12.4 0l.4.3c-.6.4-1.2.7-1.8.9l1.1 1.7a19.9 19.9 0 0 0 5-2.6c.4-4.5-.7-8.4-2.6-12zM8.7 14.2c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/></svg>
        </a>
        <a className="landing-icon" href={LINK_TELEGRAM} target="_blank" rel="noreferrer" aria-label="Telegram">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><path d="M21.9 3.4 1.9 11.1c-1 .4-1 1.8.1 2.1l5 1.6 1.9 5.9c.3.9 1.4 1.1 2 .4l2.8-2.9 5.2 3.8c.8.6 2 .1 2.2-.9l3-16.2c.2-1.1-.9-2-2.2-1.5zM8.8 13.9l9.5-6.9c.3-.2.6.2.4.4l-7.7 7.5-.3 3.2-1.9-4.2z"/></svg>
        </a>
      </div>

      <div className="landing-hero">
        <Logo className="landing-logo" />
        <h1 className="landing-title">BULL RUN</h1>
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
