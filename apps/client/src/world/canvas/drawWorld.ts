import {
  WORLD_CX,
  WORLD_CY,
  WORLD_RX,
  WORLD_RY,
  TILE_COLORS,
  FENCE_RINGS,
  fmtCountdown,
  coatOf,
  trackClamp,
  nodeId,
  type MeResponse,
  type OtherPlayer,
  type WorldObject,
} from '@bullrun/shared';
import { worldData } from '../../store/gameStore';

const M = worldData.M;
const CX = WORLD_CX;
const CY = WORLD_CY;
const RX = WORLD_RX;
const RY = WORLD_RY;

export function iso(x: number, y: number) {
  return { x: (x - y) * 32, y: (x + y) * 16 };
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function cube(
  ctx: CanvasRenderingContext2D,
  wx: number, wy: number, wd: number, dd: number, h: number, elev: number,
  top: string, left: string, right: string,
) {
  const c1 = iso(wx, wy), c2 = iso(wx + wd, wy), c3 = iso(wx + wd, wy + dd), c4 = iso(wx, wy + dd);
  const e = elev, hh = elev + h;
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(c2.x, c2.y - hh); ctx.lineTo(c3.x, c3.y - hh); ctx.lineTo(c3.x, c3.y - e); ctx.lineTo(c2.x, c2.y - e);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(c4.x, c4.y - hh); ctx.lineTo(c3.x, c3.y - hh); ctx.lineTo(c3.x, c3.y - e); ctx.lineTo(c4.x, c4.y - e);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(c1.x, c1.y - hh); ctx.lineTo(c2.x, c2.y - hh); ctx.lineTo(c3.x, c3.y - hh); ctx.lineTo(c4.x, c4.y - hh);
  ctx.closePath(); ctx.fill();
}

function label(ctx: CanvasRenderingContext2D, wx: number, wy: number, txt: string, yOff: number, color: string) {
  const s = iso(wx, wy);
  ctx.font = "600 11px 'Pixelify Sans', monospace";
  const w = ctx.measureText(txt).width + 10;
  ctx.fillStyle = 'rgba(23,16,10,.8)';
  ctx.fillRect(s.x - w / 2, s.y - yOff - 13, w, 16);
  ctx.fillStyle = color || '#f3e7cd';
  ctx.textAlign = 'center';
  ctx.fillText(txt, s.x, s.y - yOff - 1);
  ctx.textAlign = 'left';
}

function drawRing(ctx: CanvasRenderingContext2D, er: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const s = iso(CX + Math.cos(a) * RX * er, CY + Math.sin(a) * RY * er);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Horizontal rails connecting fence posts into a continuous fence. */
function drawFenceRails(ctx: CanvasRenderingContext2D) {
  const railHeights = [9, 17];

  for (const { er, n } of FENCE_RINGS) {
    const posts: { wx: number; wy: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      posts.push({ wx: CX + Math.cos(a) * RX * er, wy: CY + Math.sin(a) * RY * er });
    }

    for (const rh of railHeights) {
      ctx.strokeStyle = '#8a6a2e';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const p = posts[i % n];
        const s = iso(p.wx, p.wy);
        if (i === 0) ctx.moveTo(s.x, s.y - rh);
        else ctx.lineTo(s.x, s.y - rh);
      }
      ctx.stroke();

      ctx.strokeStyle = '#e0c96a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const p = posts[i % n];
        const s = iso(p.wx, p.wy);
        if (i === 0) ctx.moveTo(s.x, s.y - rh - 1);
        else ctx.lineTo(s.x, s.y - rh - 1);
      }
      ctx.stroke();
    }
  }
}

type DrawObj = WorldObject & {
  t: string;
  dead?: number;
  big?: boolean;
  mat?: string;
  label?: string;
  shirt?: string;
  lvl?: number;
  name?: string;
  coat?: string;
  isMe?: boolean;
};

function drawObj(ctx: CanvasRenderingContext2D, o: DrawObj, stableLevel: number, now: number) {
  if (o.t === 'tree') {
    if (o.dead && o.dead > now) {
      cube(ctx, o.x - 0.16, o.y - 0.16, 0.32, 0.32, 6, 0, '#8a6a44', '#5e4527', '#6f5432');
      return;
    }
    const s = o.big ? 1.25 : 1;
    cube(ctx, o.x - 0.14, o.y - 0.14, 0.28 * s, 0.28 * s, 10 * s, 0, '#8a6a44', '#5e4527', '#6f5432');
    cube(ctx, o.x - 0.5 * s, o.y - 0.5 * s, 1 * s, 1 * s, 13 * s, 10 * s, '#4fae3d', '#2e7a22', '#3d942e');
    cube(ctx, o.x - 0.32 * s, o.y - 0.32 * s, 0.64 * s, 0.64 * s, 10 * s, 23 * s, '#5cbf48', '#37852a', '#47a136');
  } else if (o.t === 'rock') {
    if (o.dead && o.dead > now) {
      cube(ctx, o.x - 0.2, o.y - 0.2, 0.4, 0.4, 4, 0, '#9a9a95', '#6f6f6a', '#84847f');
      return;
    }
    cube(ctx, o.x - 0.4, o.y - 0.3, 0.8, 0.6, 12, 0, '#b0b0aa', '#7c7c76', '#94948e');
    cube(ctx, o.x + 0.05, o.y - 0.5, 0.45, 0.45, 8, 0, '#a5a59f', '#73736d', '#8a8a84');
  } else if (o.t === 'hay') {
    if (o.dead && o.dead > now) return;
    cube(ctx, o.x - 0.35, o.y - 0.3, 0.7, 0.6, 9, 0, '#e0c96a', '#a8913c', '#c4ad50');
    cube(ctx, o.x - 0.2, o.y - 0.15, 0.4, 0.35, 6, 9, '#e8d47e', '#b09a48', '#ccb65c');
  } else if (o.t === 'house') {
    cube(ctx, o.x - 1, o.y - 1, 2, 2, 26, 0, '#d9c49a', '#8f7a52', '#b8a271');
    cube(ctx, o.x - 1.15, o.y - 1.15, 2.3, 2.3, 10, 26, '#6b4a33', '#41291a', '#553a26');
    const d = iso(o.x, o.y + 1);
    ctx.fillStyle = '#41291a';
    ctx.fillRect(d.x - 6, d.y - 20, 12, 20);
    const wn = iso(o.x + 1, o.y);
    ctx.fillStyle = '#a8d8e8';
    ctx.fillRect(wn.x - 14, wn.y - 22, 10, 9);
  } else if (o.t === 'stable') {
    cube(ctx, o.x - 1.2, o.y - 1, 2.4, 2, 24, 0, '#c9a06a', '#8a6538', '#a8814d');
    cube(ctx, o.x - 1.35, o.y - 1.15, 2.7, 2.3, 10, 24, '#8e3b2e', '#5e2119', '#762e23');
    const d = iso(o.x, o.y + 1);
    ctx.fillStyle = '#41291a';
    ctx.fillRect(d.x - 9, d.y - 22, 18, 22);
    ctx.strokeStyle = '#c9a06a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(d.x - 9, d.y - 22);
    ctx.lineTo(d.x + 9, d.y);
    ctx.moveTo(d.x + 9, d.y - 22);
    ctx.lineTo(d.x - 9, d.y);
    ctx.stroke();
    if (o.label) label(ctx, o.x, o.y, `${o.label} · Lv ${stableLevel}`, 46, '#f2b23a');
  } else if (o.t === 'booth') {
    cube(ctx, o.x - 0.8, o.y - 0.6, 1.6, 1.2, 18, 0, '#3b6ea5', '#22436a', '#2d5787');
    cube(ctx, o.x - 0.95, o.y - 0.75, 1.9, 1.5, 6, 18, '#e8e0cc', '#b0a88f', '#ccc4ab');
    if (o.label) label(ctx, o.x, o.y, o.label, 36, '#7ec8e3');
  } else if (o.t === 'market') {
    cube(ctx, o.x - 0.9, o.y - 0.6, 1.8, 1.2, 16, 0, '#a5522f', '#6e321a', '#8a4224');
    cube(ctx, o.x - 1.05, o.y - 0.75, 2.1, 1.5, 6, 16, '#e0c96a', '#a8913c', '#c4ad50');
    if (o.label) label(ctx, o.x, o.y, o.label, 34, '#e0c96a');
  } else if (o.t === 'forge') {
    cube(ctx, o.x - 0.9, o.y - 0.7, 1.8, 1.4, 20, 0, '#6a6a66', '#44443f', '#57574f');
    cube(ctx, o.x + 0.25, o.y - 0.35, 0.4, 0.4, 10, 20, '#4a4a45', '#2e2e2a', '#3c3c37');
    const s = iso(o.x + 0.45, o.y - 0.15);
    ctx.fillStyle = `rgba(240,140,60,${0.5 + 0.3 * Math.sin(now / 250)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 34, 4, 0, 7);
    ctx.fill();
    if (o.label) label(ctx, o.x, o.y, o.label, 40, '#e07840');
  } else if (o.t === 'sign') {
    cube(ctx, o.x - 0.06, o.y - 0.06, 0.12, 0.12, 16, 0, '#8a6a44', '#5e4527', '#6f5432');
    if (o.label) label(ctx, o.x, o.y, o.label, 20, '#f2b23a');
  } else if (o.t === 'post') {
    cube(ctx, o.x - 0.08, o.y - 0.08, 0.16, 0.16, 13, 0, '#e0c96a', '#a8913c', '#c4ad50');
    cube(ctx, o.x - 0.05, o.y - 0.05, 0.1, 0.1, 2, 13, '#f2b23a', '#b57f1d', '#d0991f');
  } else if (o.t === 'player' || o.t === 'other') {
    const isMe = o.t === 'player';
    const shirt = isMe ? '#e8a33d' : (o.shirt || '#e8a33d');
    const s = iso(o.x, o.y);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 10, 5, 0, 0, 7);
    ctx.fill();
    cube(ctx, o.x - 0.18, o.y - 0.13, 0.36, 0.26, 13, 3, shirt, shade(shirt, -40), shade(shirt, -20));
    cube(ctx, o.x - 0.14, o.y - 0.11, 0.28, 0.22, 9, 16, '#e8c49a', '#b08d64', '#cca87d');
    cube(ctx, o.x - 0.14, o.y - 0.11, 0.28, 0.22, 3, 25, '#3a2a1a', '#241608', '#2f2012');
    const lbl = isMe ? 'You' : (o.name || 'Player');
    label(ctx, o.x, o.y, lbl, 40, isMe ? '#f2b23a' : '#fff');
  } else if (o.t === 'bull') {
    const c = o.coat || '#33261d';
    const s = iso(o.x, o.y);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 14, 6, 0, 0, 7);
    ctx.fill();
    cube(ctx, o.x - 0.45, o.y - 0.22, 0.9, 0.44, 11, 5, c, shade(c, -35), shade(c, -18));
    cube(ctx, o.x + 0.28, o.y - 0.18, 0.34, 0.36, 9, 10, c, shade(c, -35), shade(c, -18));
    cube(ctx, o.x + 0.3, o.y - 0.3, 0.1, 0.1, 5, 19, '#e8e4da', '#b0ac9f', '#ccc8bb');
    cube(ctx, o.x + 0.3, o.y + 0.22, 0.1, 0.1, 5, 19, '#e8e4da', '#b0ac9f', '#ccc8bb');
    cube(ctx, o.x - 0.38, o.y - 0.16, 0.14, 0.12, 5, 0, shade(c, -25), shade(c, -50), shade(c, -35));
    cube(ctx, o.x + 0.24, o.y - 0.16, 0.14, 0.12, 5, 0, shade(c, -25), shade(c, -50), shade(c, -35));
    if (o.label) label(ctx, o.x, o.y, o.label, 34, '#fff');
  }
}

export interface DrawState {
  cam: { x: number; y: number };
  me: MeResponse | null;
  otherPlayers: OtherPlayer[];
  nodeDead: Record<string, number>;
  moveTarget: { x: number; y: number } | null;
  raceAnim: {
    bulls: Array<{ id: number | string; name: string; coat: string; pos: number; finishT: number }>;
    startT: number;
  } | null;
  raceLive: boolean;
  folPos: Record<number, { x: number; y: number }>;
  camOff: { x: number; y: number };
  dpr: number;
}

export function drawWorld(ctx: CanvasRenderingContext2D, state: DrawState) {
  const { cam, me, otherPlayers, nodeDead, moveTarget, raceAnim, raceLive, folPos, camOff, dpr } = state;
  const now = Date.now();
  const cw = window.innerWidth;
  const ch = window.innerHeight;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#69a949';
  ctx.fillRect(0, 0, cw, ch);

  const cp = iso(cam.x, cam.y);
  const ox = cw / 2 - cp.x;
  const oy = ch / 2 - cp.y + 30;
  camOff.x = ox;
  camOff.y = oy;

  ctx.save();
  ctx.translate(ox, oy);

  for (let x = 0; x < M; x++) {
    for (let y = 0; y < M; y++) {
      const s = iso(x, y);
      if (s.x + ox < -80 || s.x + ox > cw + 80 || s.y + oy < -60 || s.y + oy > ch + 60) continue;
      ctx.fillStyle = TILE_COLORS[worldData.tiles[x][y]];
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + 32, s.y + 16);
      ctx.lineTo(s.x, s.y + 32);
      ctx.lineTo(s.x - 32, s.y + 16);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawFenceRails(ctx);

  drawRing(ctx, 0.82, '#f5f0e4');
  drawRing(ctx, 1.18, '#f5f0e4');

  const p1 = iso(CX, CY + RY * 0.82);
  const p2 = iso(CX, CY + RY * 1.18);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const c = iso(CX, CY);
  cube(ctx, CX - 0.08, CY - 0.08, 0.16, 0.16, 20, 0, '#8a6a44', '#5e4527', '#6f5432');
  const lbl = raceLive
    ? 'RACING!'
    : me?.race
      ? `NEXT RACE ${fmtCountdown(new Date(me.race.startAt).getTime() - now)}`
      : 'NEXT RACE';
  ctx.font = "700 14px 'Pixelify Sans', monospace";
  const lw = ctx.measureText(lbl).width + 16;
  ctx.fillStyle = '#17100a';
  ctx.fillRect(c.x - lw / 2, c.y - 44, lw, 22);
  ctx.fillStyle = raceLive ? '#7dc24f' : '#f2b23a';
  ctx.textAlign = 'center';
  ctx.fillText(lbl, c.x, c.y - 28);
  ctx.textAlign = 'left';

  const list: { d: number; o: DrawObj }[] = [];

  for (const o of worldData.objs) {
    const obj: DrawObj = { ...o };
    if ((o.t === 'tree' || o.t === 'rock' || o.t === 'hay') && o.mat) {
      const id = nodeId(o.x, o.y, o.mat);
      const dead = nodeDead[id];
      if (dead) obj.dead = dead;
    }
    list.push({ d: o.x + o.y, o: obj });
  }

  for (const p of otherPlayers) {
    list.push({ d: p.x + p.y, o: { t: 'other', x: p.x, y: p.y, shirt: p.shirt, name: p.displayName } });
  }

  if (me) {
    list.push({ d: me.position.x + me.position.y, o: { t: 'player', x: me.position.x, y: me.position.y } });

    const racingIds = raceAnim ? new Set(raceAnim.bulls.map((b) => b.id)) : new Set<number | string>();

    for (const b of me.bulls) {
      if (me.entered.includes(b.id) || racingIds.has(b.id)) continue;
      let f = folPos[b.id];
      if (!f) {
        f = { x: me.position.x + 1.5, y: me.position.y + 1.5 };
        folPos[b.id] = f;
      }
      list.push({
        d: f.x + f.y,
        o: { t: 'bull', x: f.x, y: f.y, coat: coatOf(b, me.items), label: b.name },
      });
    }
  }

  if (raceAnim) {
    const el = now - raceAnim.startT;
    for (const b of raceAnim.bulls) {
      const prog = Math.min(1, el / b.finishT);
      const a = Math.PI / 2 + prog * Math.PI * 2;
      const er = 0.88 + (b.pos % 3) * 0.1;
      const bx = CX + Math.cos(a) * RX * er;
      const by = CY + Math.sin(a) * RY * er;
      list.push({ d: bx + by, o: { t: 'bull', x: bx, y: by, coat: b.coat, label: b.name } });
    }
  }

  if (moveTarget) {
    const s = iso(moveTarget.x, moveTarget.y);
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 10, 5, 0, 0, 7);
    ctx.stroke();
  }

  list.sort((a, b) => a.d - b.d);
  const stableLevel = me?.stable.level ?? 1;
  for (const it of list) drawObj(ctx, it.o, stableLevel, now);

  ctx.restore();
}

export function stepFollowers(
  folPos: Record<number, { x: number; y: number }>,
  me: MeResponse,
  dt: number,
  racingIds: Set<number | string> = new Set(),
) {
  let prev = me.position;
  for (const b of me.bulls) {
    if (me.entered.includes(b.id) || racingIds.has(b.id)) continue;
    let f = folPos[b.id];
    if (!f) f = folPos[b.id] = { x: me.position.x + 1.5, y: me.position.y + 1.5 };
    const d = Math.hypot(prev.x - f.x, prev.y - f.y);
    if (d > 1.5) {
      const spd = Math.min(6.5, 3.6 + (d - 1.5) * 1.5);
      f.x += ((prev.x - f.x) / d) * spd * dt;
      f.y += ((prev.y - f.y) / d) * spd * dt;
    }
    trackClamp(f, CX, CY, RX, RY);
    prev = f;
  }
}

export function screenToGrid(mx: number, my: number) {
  const a = mx / 32;
  const b = my / 16;
  return { x: (b + a) / 2, y: (b - a) / 2 };
}
