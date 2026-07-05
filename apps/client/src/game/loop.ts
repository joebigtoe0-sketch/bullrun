import { useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import {
  GATHER_DURATION_MS,
  WORLD_CX,
  WORLD_CY,
  WORLD_RX,
  WORLD_RY,
  nodeId,
  trackClamp,
} from '@bullrun/shared';
import { worldData } from '../store/gameStore';

const M = worldData.M;

export function useGameLoop() {
  const meId = useGameStore((s) => s.me?.id);
  const { emitMove } = useSocket();
  const emitMoveRef = useRef(emitMove);
  emitMoveRef.current = emitMove;
  const lastMoveEmit = useRef(0);

  useEffect(() => {
    if (!meId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        useGameStore.getState().setKey(e.code, true);
        e.preventDefault();
      }
      if (e.code === 'Escape') {
        useGameStore.getState().setPanel(null);
        useGameStore.getState().setInvOpen(false);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => useGameStore.getState().setKey(e.code, false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let raf = 0;
    let lastT = performance.now();
    let lastTick = 0;

    const step = (dt: number, now: number) => {
      const s = useGameStore.getState();
      const p = { x: s.me!.position.x, y: s.me!.position.y };
      const keys = s.keys;
      let cx = 0, cy = 0;
      if (keys.KeyW || keys.ArrowUp) { cx -= 1; cy -= 1; }
      if (keys.KeyS || keys.ArrowDown) { cx += 1; cy += 1; }
      if (keys.KeyA || keys.ArrowLeft) { cx -= 1; cy += 1; }
      if (keys.KeyD || keys.ArrowRight) { cx += 1; cy -= 1; }

      if (cx || cy) {
        const l = Math.hypot(cx, cy);
        const cam = s.cam;
        let nx = cam.x + (cx / l) * 14 * dt;
        let ny = cam.y + (cy / l) * 14 * dt;
        nx = Math.max(4, Math.min(M - 4, nx));
        ny = Math.max(4, Math.min(M - 4, ny));
        s.setCam(nx, ny);
        s.setFreeCamUntil(now + 3500);
      }

      if (s.moveTarget) {
        s.setFreeCamUntil(0);
        const mt = s.moveTarget;
        const d = Math.hypot(mt.x - p.x, mt.y - p.y);
        const arrive = s.pending ? 1.7 : 0.15;
        if (d < arrive) {
          s.setMoveTarget(null);
          if (s.pending) execPending(s.pending);
        } else {
          p.x += ((mt.x - p.x) / d) * 4.4 * dt;
          p.y += ((mt.y - p.y) / d) * 4.4 * dt;
        }
      }

      p.x = Math.max(1, Math.min(M - 1, p.x));
      p.y = Math.max(1, Math.min(M - 1, p.y));
      if (trackClamp(p, WORLD_CX, WORLD_CY, WORLD_RX, WORLD_RY)) s.setMoveTarget(null);

      if (now > s.freeCamUntil) {
        const f = Math.min(1, 4 * dt);
        s.setCam(s.cam.x + (p.x - s.cam.x) * f, s.cam.y + (p.y - s.cam.y) * f);
      }

      if (s.me && (p.x !== s.me.position.x || p.y !== s.me.position.y)) {
        s.setPosition(p.x, p.y);
        if (now - lastMoveEmit.current > 100) {
          emitMoveRef.current(p.x, p.y);
          lastMoveEmit.current = now;
        }
      }

      if (s.gather && now - s.gather.start >= s.gather.dur) {
        const nodeIdStr = s.gather.nodeId;
        s.setGather(null);
        api.gatherComplete(nodeIdStr).then((res) => {
          const r = res as { qty: number; mat: string; me: import('@bullrun/shared').MeResponse };
          useGameStore.getState().setMe(r.me);
          useGameStore.getState().toastMsg(`+${r.qty} ${r.mat}`);
        }).catch((e) => useGameStore.getState().toastMsg(e.message));
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      step(dt, t);
      if (t - lastTick > 1000) {
        lastTick = t;
        api.me().then((m) => {
          if (m) useGameStore.getState().setMe(m);
        }).catch((err) => console.warn('/me sync failed', err));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [meId]);
}

function execPending(pending: { type: string; nodeId?: string; x: number; y: number }) {
  const s = useGameStore.getState();
  s.setPending(null);
  if (pending.type === 'gather' && pending.nodeId) {
    s.setGather({ nodeId: pending.nodeId, start: Date.now(), dur: GATHER_DURATION_MS });
  } else if (['stable', 'bet', 'market', 'forge', 'race'].includes(pending.type)) {
    s.setPanel(pending.type as import('@bullrun/shared').PanelType);
  }
}

export function handleWorldClick(wx: number, wy: number) {
  const s = useGameStore.getState();
  if (wx <= 0 || wy <= 0 || wx >= M || wy >= M) return;

  let best: { type: string; nodeId?: string; x: number; y: number } | null = null;
  let bd = 1.6;

  for (const it of worldData.interactables) {
    const d = Math.hypot(it.x - wx, it.y - wy);
    if (d < bd) { bd = d; best = { type: it.t, x: it.x, y: it.y }; }
  }

  const now = Date.now();
  for (const n of worldData.nodes) {
    const id = nodeId(n.x, n.y, n.mat);
    if (s.nodeDead[id] && s.nodeDead[id] > now) continue;
    const d = Math.hypot(n.x - wx, n.y - wy);
    if (d < Math.min(bd, 1.2)) {
      bd = d;
      best = { type: 'gather', nodeId: id, x: n.x, y: n.y };
    }
  }

  s.setGather(null);
  const p = s.me?.position ?? { x: 0, y: 0 };
  if (best) {
    s.setPending(best);
    if (Math.hypot(p.x - best.x, p.y - best.y) < 2) {
      s.setMoveTarget(null);
      execPending(best);
    } else {
      s.setMoveTarget({ x: best.x, y: best.y });
    }
  } else {
    s.setPending(null);
    s.setMoveTarget({ x: wx, y: wy });
  }
}
