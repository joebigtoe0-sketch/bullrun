import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

const btn = 'br-btn';

/** Center-screen results board (countdown & live race info render on the track canvas). */
export function RaceTrackBoard() {
  const results = useGameStore((s) => s.results);
  const betResult = useGameStore((s) => s.betResult);
  const setPanel = useGameStore((s) => s.setPanel);
  const setResults = useGameStore((s) => s.setResults);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!results) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [results]);

  if (!results) return null;

  return (
    <div className="race-track-board-overlay">
      <div className="race-track-board">
        <div className="race-track-board-header">🏁 Race Results</div>
        <div className="race-track-board-body">
          {results.map((r) => (
            <div key={r.pos} className={`race-track-row ${r.mine ? 'mine' : ''}`}>
              <span>
                <b className="gold">{['1st', '2nd', '3rd', '4th', '5th', '6th'][r.pos - 1]}</b> {r.name}
                <span className="muted sm"> {r.owner}</span>
              </span>
              <span className="green-txt">{r.prize ? `+${r.prize}g` : '—'}</span>
            </div>
          ))}
          {betResult && <div className="race-track-row green-txt">{betResult}</div>}
          <button className={`${btn} gold`} onClick={() => { setResults(null); setPanel(null); }}>Continue</button>
        </div>
      </div>
    </div>
  );
}
