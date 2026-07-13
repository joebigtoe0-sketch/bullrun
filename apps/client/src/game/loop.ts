import { useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useGameStore } from '../store/gameStore';
import { useSocket, gameSocketRef } from '../hooks/useSocket';
import {
  NODE_RESPAWN_MS,
  GATHER_DURATION_MS,
  gatherDurationFor,
  moveSpeedFor,
  INTERACT_USE_RANGE,
  PASTURE_PLOTS,
  pastureApproachPoint,
  nearestPasturePlot,
  distanceToPastureFence,
  isNearPasturePlot,
  nodeId,
  applyWorldCollision,
  findPath,
  isNearInteractable,
  isBuildingPanel,
} from '@bullrace/shared';
import { worldData } from '../store/gameStore';
import { addFloatText } from '../world/canvas/drawWorld';
import { BRSfx } from '../lib/sfx';
import { MAT_SWATCHES } from '@bullrace/shared';

let lastStepSfx = 0;
let lastSwingSfx = 0;
let lastGallopSfx = 0;

const M = worldData.M;
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function useGameLoop(active = true) {
  const meId = useGameStore((s) => s.me?.id);
  const { emitMove } = useSocket();
  const emitMoveRef = useRef(emitMove);
  emitMoveRef.current = emitMove;
  const lastMoveEmit = useRef(0);

  useEffect(() => {
    if (!active || !meId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (useGameStore.getState().chatInputFocused) return;
      if (MOVE_KEYS.includes(e.code)) {
        useGameStore.getState().setKey(e.code, true);
        e.preventDefault();
      }
      if (e.code === 'Escape') {
        useGameStore.getState().setPanel(null);
        useGameStore.getState().setInvOpen(false);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (useGameStore.getState().chatInputFocused) return;
      useGameStore.getState().setKey(e.code, false);
    };

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
        const spd = moveSpeedFor(s.me!.items);
        // Consume as many waypoints as this frame's travel budget allows so there's
        // never a dead frame at a waypoint (that caused a stutter at every tile).
        let budget = spd * dt;
        let path = s.movePath && s.movePath.length
          ? s.movePath.map((w) => ({ x: w.x, y: w.y }))
          : [{ x: s.moveTarget.x, y: s.moveTarget.y }];
        let reachedFinal = false;

        for (let guard = 0; guard < 32 && budget > 1e-4 && path.length; guard++) {
          const mt = path[0];
          const d = Math.hypot(mt.x - p.x, mt.y - p.y);

          if (path.length === 1) {
            const arrive = s.pending?.type === 'pasture' ? 0.5 : s.pending ? 1.7 : 0.12;
            if (d <= arrive) {
              reachedFinal = true;
            } else {
              const move = Math.min(budget, d);
              p.x += ((mt.x - p.x) / d) * move;
              p.y += ((mt.y - p.y) / d) * move;
            }
            break;
          }

          // intermediate waypoint — snap through, carry the leftover budget onward
          if (d <= budget) {
            p.x = mt.x;
            p.y = mt.y;
            budget -= d;
            path.shift();
          } else {
            p.x += ((mt.x - p.x) / d) * budget;
            p.y += ((mt.y - p.y) / d) * budget;
            budget = 0;
          }
        }

        if (reachedFinal) {
          s.setMovePath(null);
          s.setMoveTarget(null);
          s.setWalkDestination(null);
          if (s.pending) execPending(s.pending);
        } else if (s.movePath && path.length !== s.movePath.length) {
          s.setMovePath(path);
        }
      }

      if (
        s.pending?.type === 'pasture' &&
        s.pending.plotId != null &&
        isNearPasturePlot(p.x, p.y, s.pending.plotId)
      ) {
        s.setMovePath(null);
        s.setMoveTarget(null);
        execPending(s.pending);
      }

      p.x = Math.max(1, Math.min(M - 1, p.x));
      p.y = Math.max(1, Math.min(M - 1, p.y));
      if (applyWorldCollision(p)) {
        if (!s.movePath || s.movePath.length <= 1) s.setMoveTarget(null);
      }

      if (s.me && s.panel && isBuildingPanel(s.panel)) {
        const pos = s.me.position;
        if (s.panel === 'den') {
          if (s.denPlotId == null || !isNearPasturePlot(pos.x, pos.y, s.denPlotId)) {
            s.setPanel(null);
          }
        } else if (!isNearInteractable(pos.x, pos.y, s.panel, worldData.interactables)) {
          s.setPanel(null);
        }
      }

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

      // action sounds: footsteps, tool swings, race gallop
      if (s.moveTarget && now - lastStepSfx > 320) {
        lastStepSfx = now;
        BRSfx.step();
      }
      if (s.gather && now - lastSwingSfx > 480) {
        lastSwingSfx = now;
        if (s.gather.mat === 'wood') BRSfx.axeHit();
        else if (s.gather.mat === 'ore') BRSfx.pickHit();
        else BRSfx.forkHit();
      }
      if (s.raceAnim && !s.raceAnim.frozen && now - lastGallopSfx > 300) {
        lastGallopSfx = now;
        BRSfx.gallop();
      }

      if (s.gather) {
        const dur = Math.max(1, s.gather.dur ?? GATHER_DURATION_MS);
        const pct = Math.min(100, ((now - s.gather.start) / dur) * 100);
        if (Math.abs(pct - s.gatherPct) > 0.3) {
          useGameStore.setState({ gatherPct: pct });
        }
      } else if (s.gatherPct !== 0) {
        useGameStore.setState({ gatherPct: 0 });
      }

      if (s.gather && now - s.gather.start >= (s.gather.dur ?? GATHER_DURATION_MS)) {
        const nodeIdStr = s.gather.nodeId;
        const fxX = s.gather.nodeX;
        const fxY = s.gather.nodeY;
        const pos = s.me?.position;
        s.setGather(null);
        api.gatherComplete(nodeIdStr, pos?.x, pos?.y).then((res) => {
          const r = res as { qty: number; mat: string; xp?: number; leveledUp?: boolean; me: import('@bullrace/shared').MeResponse };
          useGameStore.getState().setNodeDead(nodeIdStr, Date.now() + NODE_RESPAWN_MS);
          useGameStore.getState().setMe(r.me);
          const px = fxX ?? pos?.x ?? 0;
          const py = fxY ?? pos?.y ?? 0;
          addFloatText(px, py, `+${r.qty} ${r.mat}`, MAT_SWATCHES[r.mat as 'hay'] ?? '#f3e7cd', true);
          setTimeout(() => addFloatText(px, py, `+${r.xp ?? r.qty} XP`, '#7ec8e3'), 260);
          if (r.leveledUp) {
            BRSfx.levelup();
            useGameStore.getState().toastMsg(`⭐ LEVEL UP! You are now level ${r.me.level}`);
          } else {
            BRSfx.pop();
          }
        }).catch((e) => useGameStore.getState().toastMsg(e.message));
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      step(dt, Date.now());
      if (t - lastTick > 30_000) {
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
  }, [active, meId]);
}

function syncPosition(x: number, y: number) {
  api.updatePosition(x, y).catch(() => {});
  gameSocketRef.current?.emit('move', { x, y });
}

function execPending(pending: { type: string; nodeId?: string; plotId?: number; x: number; y: number }) {
  const s = useGameStore.getState();
  s.setPending(null);
  if (pending.type === 'gather' && pending.nodeId) {
    const node = (s.worldNodes.length ? s.worldNodes : worldData.nodes.map((n) => ({
      id: nodeId(n.x, n.y, n.mat), x: n.x, y: n.y, mat: n.mat,
    }))).find((n) => n.id === pending.nodeId);
    s.setGather({
      nodeId: pending.nodeId,
      start: Date.now(),
      dur: gatherDurationFor(s.me?.items ?? [], node?.mat),
      mat: node?.mat,
      nodeX: node?.x,
      nodeY: node?.y,
    });
  } else if (pending.type === 'pasture' && pending.plotId !== undefined) {
    const plot = s.pastures.find((p) => p.id === pending.plotId);
    const def = PASTURE_PLOTS.find((p) => p.id === pending.plotId);
    const pos = s.me?.position;
    if (!plot || !def || !pos || !isNearPasturePlot(pos.x, pos.y, plot.id)) {
      s.toastMsg('Get closer to the den fence');
      return;
    }
    if (!plot.ownerId) {
      const alreadyOwns = s.pastures.some((p) => p.ownerId === s.me?.id);
      if (alreadyOwns) {
        s.toastMsg('You can only own one den');
        return;
      }
      s.setBuyDenConfirm({ plotId: plot.id, label: def.label, price: def.price });
    } else if (plot.ownerId) {
      s.setDenPlotId(plot.id);
      s.setPanel('den');
    }
  } else if (['stable', 'bet', 'market', 'forge', 'race', 'shop', 'wheel'].includes(pending.type)) {
    const pos = s.me?.position;
    if (!pos || !isNearInteractable(pos.x, pos.y, pending.type as 'stable' | 'bet' | 'market' | 'forge' | 'race' | 'shop' | 'wheel', worldData.interactables)) {
      s.toastMsg('Get closer to use that');
      return;
    }
    syncPosition(pos.x, pos.y);
    s.setPanel(pending.type as import('@bullrace/shared').PanelType);
  }
}

function startMoveTo(
  tx: number,
  ty: number,
  pending: { type: string; nodeId?: string; plotId?: number; x: number; y: number } | null,
) {
  const s = useGameStore.getState();
  const p = s.me?.position;
  if (!p) return;

  const path = findPath(p.x, p.y, tx, ty, M);
  if (!path.length) {
    s.toastMsg("Can't reach there");
    return;
  }

  s.setPending(pending);
  s.setMovePath(path);
  s.setWalkDestination({ x: tx, y: ty });

  if (
    pending &&
    path.length === 1 &&
    Math.hypot(p.x - tx, p.y - ty) < INTERACT_USE_RANGE
  ) {
    s.setMovePath(null);
    s.setMoveTarget(null);
    execPending(pending);
  }
}

export function handleWorldClick(wx: number, wy: number) {
  const s = useGameStore.getState();
  if (wx <= 0 || wy <= 0 || wx >= M || wy >= M) return;

  let best: { type: string; nodeId?: string; plotId?: number; x: number; y: number } | null = null;
  let bd = 1.6;
  const playerPos = s.me?.position ?? { x: wx, y: wy };

  const clickedPlot = nearestPasturePlot(wx, wy, 0.9);
  if (clickedPlot) {
    const approach = pastureApproachPoint(playerPos.x, playerPos.y, clickedPlot);
    bd = distanceToPastureFence(wx, wy, clickedPlot);
    best = { type: 'pasture', plotId: clickedPlot.id, x: approach.x, y: approach.y };
  }

  for (const it of worldData.interactables) {
    const d = Math.hypot(it.x - wx, it.y - wy);
    if (d < bd) { bd = d; best = { type: it.t, x: it.x, y: it.y }; }
  }

  const now = Date.now();
  const nodes = s.worldNodes.length ? s.worldNodes : worldData.nodes.map((n) => ({
    id: nodeId(n.x, n.y, n.mat),
    x: n.x,
    y: n.y,
    mat: n.mat,
  }));
  for (const n of nodes) {
    if (s.nodeDead[n.id] && s.nodeDead[n.id] > now) continue;
    const d = Math.hypot(n.x - wx, n.y - wy);
    if (d < Math.min(bd, 1.2)) {
      bd = d;
      best = { type: 'gather', nodeId: n.id, x: n.x, y: n.y };
    }
  }

  s.setGather(null);
  if (best) {
    startMoveTo(best.x, best.y, best);
  } else {
    s.setPending(null);
    startMoveTo(wx, wy, null);
  }
}

export function navigateToBuilding(p: 'stable' | 'race' | 'bet' | 'market' | 'forge' | 'shop' | 'wheel') {
  const s = useGameStore.getState();
  const me = s.me;
  if (!me) return;
  const it = worldData.interactables.find((i) => i.t === p);
  if (!it) return;
  if (isNearInteractable(me.position.x, me.position.y, p, worldData.interactables)) {
    syncPosition(me.position.x, me.position.y);
    s.setPanel(p);
    return;
  }
  startMoveTo(it.x, it.y, { type: p, x: it.x, y: it.y });
}
