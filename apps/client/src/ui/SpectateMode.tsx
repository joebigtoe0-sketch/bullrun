import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { CanvasWorld } from '../world/CanvasWorld';
import { OnlineBadge } from './OnlineBadge';
import { useOnlineCount } from '../hooks/useOnlineCount';
import { worldData } from '../store/gameStore';

const M = worldData.M;

/** Watch the world without an account: live socket feed, free camera, wheel zoom. */
export function SpectateMode({ onExit }: { onExit: () => void }) {
  useSocket(); // connects with the spectator token
  const playersOnline = useOnlineCount();

  // free camera: WASD / arrows pan
  useEffect(() => {
    useGameStore.getState().setFreeCamUntil(Number.MAX_SAFE_INTEGER);
    const onKeyDown = (e: KeyboardEvent) => useGameStore.getState().setKey(e.code, true);
    const onKeyUp = (e: KeyboardEvent) => useGameStore.getState().setKey(e.code, false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let raf = 0;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const s = useGameStore.getState();
      const keys = s.keys;
      let cx = 0;
      let cy = 0;
      if (keys.KeyW || keys.ArrowUp) { cx -= 1; cy -= 1; }
      if (keys.KeyS || keys.ArrowDown) { cx += 1; cy += 1; }
      if (keys.KeyA || keys.ArrowLeft) { cx -= 1; cy += 1; }
      if (keys.KeyD || keys.ArrowRight) { cx += 1; cy -= 1; }
      if (cx || cy) {
        const l = Math.hypot(cx, cy);
        const nx = Math.max(4, Math.min(M - 4, s.cam.x + (cx / l) * 16 * dt));
        const ny = Math.max(4, Math.min(M - 4, s.cam.y + (cy / l) * 16 * dt));
        s.setCam(nx, ny);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      useGameStore.getState().setFreeCamUntil(0);
    };
  }, []);

  return (
    <div className="game-root">
      <CanvasWorld />
      <div className="spectate-hud">
        <div className="hud-chip spectate-chip">
          <span className="spectate-dot" /> SPECTATING
        </div>
        <OnlineBadge count={playersOnline} />
        <div className="hud-chip muted sm">WASD to pan · scroll to zoom</div>
        <button type="button" className="br-btn gold" onClick={onExit}>Login to play</button>
      </div>
    </div>
  );
}
