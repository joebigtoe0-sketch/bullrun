import { useEffect, useRef } from 'react';
import { useGameStore, worldData } from '../store/gameStore';
import { handleWorldClick } from '../game/loop';
import {
  drawWorld,
  stepFollowers,
  stepOtherFollowers,
  screenToGrid,
  type FollowerPos,
} from './canvas/drawWorld';

/** Canvas 2D world renderer — ported directly from the prototype spec. */
export function CanvasWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camOffRef = useRef({ x: 0, y: 0 });
  const folPosRef = useRef<Record<number, FollowerPos>>({});
  const otherFolPosRef = useRef<Record<string, Record<number, FollowerPos>>>({});

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

      let state = useGameStore.getState();
      if (state.resultsUntil && Date.now() > state.resultsUntil) {
        useGameStore.getState().clearResults();
        state = useGameStore.getState();
      }
      useGameStore.getState().pruneSpeechBubbles();
      useGameStore.getState().freezeRaceIfDue();
      state = useGameStore.getState();

      if (state.me) {
        const racingIds = state.raceAnim || state.raceGrid
          ? new Set((state.raceAnim ?? state.raceGrid)!.bulls.map((b) => b.id))
          : new Set<number | string>();
        stepFollowers(folPosRef.current, state.me, dt, racingIds);
      }
      stepOtherFollowers(otherFolPosRef.current, state.otherPlayers, dt);

      drawWorld(ctx, {
        cam: state.cam,
        me: state.me,
        otherPlayers: state.otherPlayers,
        nodeDead: state.nodeDead,
        walkDestination: state.walkDestination,
        worldNodes: state.worldNodes,
        raceAnim: state.raceAnim,
        raceGrid: state.raceGrid,
        raceLive: !!state.raceLive,
        results: state.results,
        resultsUntil: state.resultsUntil,
        betResult: state.betResult,
        pastures: state.pastures,
        gather: state.gather,
        walking: !!(
          state.moveTarget ||
          state.keys.KeyW || state.keys.KeyA || state.keys.KeyS || state.keys.KeyD ||
          state.keys.ArrowUp || state.keys.ArrowDown || state.keys.ArrowLeft || state.keys.ArrowRight
        ),
        folPos: folPosRef.current,
        otherFolPos: otherFolPosRef.current,
        speechBubbles: state.speechBubbles,
        myPlayerId: state.user?.id ?? null,
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
      className="world-canvas"
      style={{ position: 'absolute', inset: 0, display: 'block' }}
      onClick={onClick}
    />
  );
}
