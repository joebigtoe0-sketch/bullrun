/** Pixel icons for the top-left resource HUD (from prototype spec). */
export function GoldIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="5.6" fill="#f2b23a" stroke="#17100a" strokeWidth="1.8" />
      <circle cx="7" cy="7" r="2.6" fill="none" stroke="#b57f1d" strokeWidth="1.4" />
    </svg>
  );
}

export function HayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden>
      <rect x="2" y="3" width="10" height="8" rx="1.5" fill="#d9c65a" stroke="#17100a" strokeWidth="1.5" />
      <line x1="5.5" y1="3" x2="5.5" y2="11" stroke="#a8913c" strokeWidth="1.2" />
      <line x1="8.5" y1="3" x2="8.5" y2="11" stroke="#a8913c" strokeWidth="1.2" />
    </svg>
  );
}

export function OreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden style={{ marginLeft: 6 }}>
      <path d="M7 1 L13 7 L7 13 L1 7 Z" fill="#9aa0a6" stroke="#17100a" strokeWidth="1.5" />
    </svg>
  );
}

export function WoodIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden style={{ marginLeft: 6 }}>
      <rect x="1" y="4" width="12" height="3" rx="1.5" fill="#8a5a2b" stroke="#17100a" strokeWidth="1.2" />
      <rect x="2.5" y="8" width="9" height="3" rx="1.5" fill="#a5764a" stroke="#17100a" strokeWidth="1.2" />
    </svg>
  );
}
