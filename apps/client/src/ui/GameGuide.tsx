import { useState } from 'react';
import { ALL_GUIDE_SECTIONS, GUIDE_GROUPS } from './gameGuideContent';

export interface GameGuideProps {
  onClose: () => void;
  /** Optional — marks tutorial seen (in-game first visit). */
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function GameGuide({ onClose, onDismiss, dismissLabel = 'Close' }: GameGuideProps) {
  const [activeId, setActiveId] = useState(ALL_GUIDE_SECTIONS[0]?.id ?? 'intro');
  const active = ALL_GUIDE_SECTIONS.find((s) => s.id === activeId) ?? ALL_GUIDE_SECTIONS[0]!;

  return (
    <div className="guide-overlay" onClick={onClose}>
      <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="guide-header">
          <span>Bull Race — Game Guide</span>
          <button type="button" className="guide-close" onClick={onClose} aria-label="Close guide">✕</button>
        </div>
        <div className="guide-body">
          <nav className="guide-nav">
            {GUIDE_GROUPS.map((group) => (
              <div key={group.label} className="guide-nav-group">
                <div className="guide-nav-label">{group.label}</div>
                {group.sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`guide-nav-item${s.id === activeId ? ' active' : ''}`}
                    onClick={() => setActiveId(s.id)}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="guide-content">
            <h2 className="guide-title">{active.title}</h2>
            {active.body}
          </div>
        </div>
        <div className="guide-footer">
          {onDismiss ? (
            <button type="button" className="br-btn gold" onClick={onDismiss}>{dismissLabel}</button>
          ) : (
            <button type="button" className="br-btn gold" onClick={onClose}>{dismissLabel}</button>
          )}
        </div>
      </div>
    </div>
  );
}
