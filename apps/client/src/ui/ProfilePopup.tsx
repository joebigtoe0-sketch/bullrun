import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import bs58 from 'bs58';
import { api } from '../api/client';
import { useGameStore } from '../store/gameStore';

export function ProfilePopup() {
  const profileOpen = useGameStore((s) => s.profileOpen);
  const setProfileOpen = useGameStore((s) => s.setProfileOpen);
  const me = useGameStore((s) => s.me);
  const walletAddress = useGameStore((s) => s.walletAddress);
  const tokenBalance = useGameStore((s) => s.tokenBalance);
  const refreshTokenBalance = useGameStore((s) => s.refreshTokenBalance);
  const setWallet = useGameStore((s) => s.setWallet);
  const toast = useGameStore((s) => s.toastMsg);
  const logout = useGameStore((s) => s.logout);
  const { publicKey, signMessage, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (profileOpen && walletAddress) void refreshTokenBalance();
  }, [profileOpen, walletAddress, refreshTokenBalance]);

  if (!profileOpen || !me) return null;

  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : 'Not connected';

  const linkWallet = async () => {
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }
    if (!signMessage) {
      toast("Your wallet doesn't support message signing");
      return;
    }
    setLinking(true);
    try {
      const addr = publicKey.toBase58();
      const { message } = await api.linkWalletNonce(addr);
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const res = await api.linkWalletVerify(addr, bs58.encode(sigBytes));
      setWallet(res.walletAddress);
      toast('Wallet connected!');
      void refreshTokenBalance();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setLinking(false);
    }
  };

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
  };

  return (
    <div className="modal-overlay" onClick={() => setProfileOpen(false)}>
      <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Profile</span>
          <button type="button" className="close-btn" onClick={() => setProfileOpen(false)}>✕</button>
        </div>
        <div className="profile-body" style={{ padding: '16px 18px' }}>
          <div className="profile-row">
            <span className="profile-label">Display name</span>
            <span className="profile-val">{me.displayName}</span>
          </div>
          <div className="profile-row">
            <span className="profile-label">Username</span>
            <span className="profile-val">{me.username}</span>
          </div>
          <div className="profile-row">
            <span className="profile-label">Wallet</span>
            <span className="profile-val mono">{shortWallet}</span>
          </div>
          {walletAddress ? (
            <div className="profile-row">
              <span className="profile-label">Token balance</span>
              <span className="profile-val">{tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          ) : (
            <>
              <p className="auth-hint" style={{ margin: '12px 0 8px' }}>
                Connect a Solana wallet to sell gold for tokens, buy token listings, and spin the daily wheel.
              </p>
              <button
                type="button"
                className="br-btn gold"
                style={{ width: '100%' }}
                disabled={linking}
                onClick={() => void linkWallet()}
              >
                {linking ? 'Waiting for signature…' : connected ? 'Sign & link wallet' : 'Connect wallet'}
              </button>
            </>
          )}
          <AudioControls />

          <button type="button" className="br-btn red profile-disconnect" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

function AudioRow({ label, muted, vol, onMute, onVol }: {
  label: string; muted: boolean; vol: number; onMute: () => void; onVol: (v: number) => void;
}) {
  return (
    <div className="audio-row">
      <button type="button" className="audio-mute" onClick={onMute} aria-label={`${muted ? 'Unmute' : 'Mute'} ${label}`}>
        {muted ? '🔇' : '🔊'}
      </button>
      <span className="audio-label">{label}</span>
      <input
        className="audio-slider"
        type="range"
        min={0}
        max={100}
        value={Math.round(vol * 100)}
        disabled={muted}
        onChange={(e) => onVol(Number(e.target.value) / 100)}
      />
      <span className="audio-pct">{muted ? 'off' : `${Math.round(vol * 100)}%`}</span>
    </div>
  );
}

function AudioControls() {
  const audio = useGameStore((s) => s.audio);
  const setAudio = useGameStore((s) => s.setAudio);
  return (
    <div className="audio-controls">
      <div className="profile-label" style={{ margin: '14px 0 6px' }}>Audio</div>
      <AudioRow
        label="Music" muted={audio.musicMuted} vol={audio.musicVol}
        onMute={() => setAudio({ musicMuted: !audio.musicMuted })}
        onVol={(v) => setAudio({ musicVol: v })}
      />
      <AudioRow
        label="Sound FX" muted={audio.sfxMuted} vol={audio.sfxVol}
        onMute={() => setAudio({ sfxMuted: !audio.sfxMuted })}
        onVol={(v) => setAudio({ sfxVol: v })}
      />
    </div>
  );
}
