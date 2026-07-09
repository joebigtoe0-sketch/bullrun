import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useGameStore } from '../store/gameStore';

export function ProfilePopup() {
  const profileOpen = useGameStore((s) => s.profileOpen);
  const setProfileOpen = useGameStore((s) => s.setProfileOpen);
  const me = useGameStore((s) => s.me);
  const walletAddress = useGameStore((s) => s.walletAddress);
  const tokenBalance = useGameStore((s) => s.tokenBalance);
  const refreshTokenBalance = useGameStore((s) => s.refreshTokenBalance);
  const logout = useGameStore((s) => s.logout);
  const { disconnect } = useWallet();

  useEffect(() => {
    if (profileOpen) void refreshTokenBalance();
  }, [profileOpen, refreshTokenBalance]);

  if (!profileOpen || !me) return null;

  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : '—';

  const handleDisconnect = () => {
    setProfileOpen(false);
    disconnect().catch(() => {});
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
            <span className="profile-label">Wallet</span>
            <span className="profile-val mono">{shortWallet}</span>
          </div>
          <div className="profile-row">
            <span className="profile-label">Token balance</span>
            <span className="profile-val">{tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <button type="button" className="br-btn red profile-disconnect" onClick={handleDisconnect}>
            Disconnect wallet
          </button>
        </div>
      </div>
    </div>
  );
}
