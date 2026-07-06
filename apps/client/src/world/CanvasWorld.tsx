import { useEffect, useRef } from 'react';
import { useGameStore, worldData } from '../store/gameStore';
import { handleWorldClick } from '../game/loop';
import {
  drawWorld,
  stepFollowers,
  screenToGrid,
} from './canvas/drawWorld';

/** Canvas 2D world renderer — ported directly from the prototype spec. */
export function CanvasWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camOffRef = useRef({ x: 0, y: 0 });
  const folPosRef = useRef<Record<number, { x: number; y: number }>>({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastT = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;

      const state = useGameStore.getState();
      if (state.me) {
        const racingIds = state.raceAnim
          ? new Set(state.raceAnim.bulls.map((b) => b.id))
          : new Set<number | string>();
        stepFollowers(folPosRef.current, state.me, dt, racingIds);
      }

      drawWorld(ctx, {
        cam: state.cam,
        me: state.me,
        otherPlayers: state.otherPlayers,
        nodeDead: state.nodeDead,
        moveTarget: state.moveTarget,
        raceAnim: state.raceAnim,
        raceLive: !!state.raceLive,
        folPos: folPosRef.current,
        camOff: camOffRef.current,
        dpr: window.devicePixelRatio || 1,
      });

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - camOffRef.current.x;
    const my = e.clientY - rect.top - camOffRef.current.y;
    const { x, y } = screenToGrid(mx, my);
    if (x <= 0 || y <= 0 || x >= worldData.M || y >= worldData.M) return;
    handleWorldClick(x, y);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, display: 'block' }}
      onClick={onClick}
    />
  );
}
