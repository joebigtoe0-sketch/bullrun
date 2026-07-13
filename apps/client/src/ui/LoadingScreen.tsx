import { useEffect, useRef, useState } from 'react';
import { BRArt } from '../world/canvas/bullraceArt';
import { HeroBackdrop } from './HeroBackdrop';

const STAGES = ['World', 'Track', 'Market', 'Bulls', 'Ready'] as const;

const TIPS = [
  'Cross the track over the walkover bridge west of the hub.',
  'Gathering gives XP — level 10 lets a second bull follow you.',
  'Clothing from the General Store speeds up walking and gathering.',
  'Spin the daily wheel by the spawn for gold and exclusive gear.',
  'Breed two rare bulls for better odds of a legendary calf.',
  'Bet at the BETS booth before the race locks.',
  'Champion gear only drops from the wheel jackpot.',
];

const BAR_W = 520;
const RUN_H = 74;

/** Staged loader (~2.4s) — the bull IS the progress head, sprinting along the bar. */
export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pct, setPct] = useState(0);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const doneRef = useRef(false);

  useEffect(() => {
    const t0 = performance.now();
    const DURATION = 2400;
    let raf = 0;

    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = BAR_W * dpr;
      canvas.height = RUN_H * dpr;
    }

    const dust: { x: number; y: number; r: number; born: number }[] = [];
    let lastPuff = 0;

    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      setPct(Math.round(t * 100));

      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, BAR_W, RUN_H);

        // the bull gallops from the bar's left edge to its right edge with progress
        const bx = 26 + t * (BAR_W - 60);
        const groundY = RUN_H - 8;

        // dust puffs kicked up behind
        if (now - lastPuff > 90 && t < 1) {
          lastPuff = now;
          dust.push({ x: bx - 18, y: groundY - 2 + (Math.random() - 0.5) * 4, r: 2 + Math.random() * 2.5, born: now });
        }
        for (let i = dust.length - 1; i >= 0; i--) {
          const d = dust[i];
          const age = (now - d.born) / 650;
          if (age >= 1) {
            dust.splice(i, 1);
            continue;
          }
          ctx.fillStyle = `rgba(214,190,150,${(0.5 * (1 - age)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(d.x - age * 14, d.y - age * 8, d.r + age * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // bull sprite anchored to the ground line, running in place as it advances
        ctx.save();
        ctx.translate(bx, groundY);
        const isoF = (x: number, y: number) => ({ x: (x - y) * 32, y: (x + y) * 16 });
        BRArt.drawObj(ctx, isoF, {
          t: 'bull',
          x: 0,
          y: 0,
          coat: '#6e4526',
          moving: true,
          run: true,
          racing: true,
          ph: now / 48,
        }, { t: now / 1000, nowMs: Date.now() });
        ctx.restore();
      }

      if (t >= 1) {
        if (!doneRef.current) {
          doneRef.current = true;
          setTimeout(onDone, 250);
        }
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  const stageIdx = Math.min(STAGES.length - 1, Math.floor((pct / 100) * STAGES.length));

  return (
    <div className="loading-root">
      <HeroBackdrop variant="loading" />
      <div className="loading-card">
        <h1 className="landing-title" style={{ fontSize: 34 }}>BULL RACE</h1>
        <div className="loading-run">
          <canvas ref={canvasRef} style={{ width: BAR_W, height: RUN_H, maxWidth: '88vw' }} aria-hidden />
          <div className="loading-bar-row">
            <div className="loading-bar"><div className="loading-fill" style={{ width: `${pct}%` }} /></div>
            <span className="loading-pct">{pct}%</span>
          </div>
        </div>
        <div className="loading-stages">
          {STAGES.map((s, i) => (
            <span key={s} className={`loading-stage${i === stageIdx ? ' active' : ''}${i < stageIdx ? ' done' : ''}`}>
              {i < stageIdx ? '✓ ' : ''}{s}
            </span>
          ))}
        </div>
        <div className="loading-tip-label">TIP</div>
        <div className="loading-tip">{tip}</div>
      </div>
    </div>
  );
}
