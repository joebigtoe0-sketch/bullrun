import {
  WORLD_CX,
  WORLD_CY,
  WORLD_RX,
  WORLD_RY,
  TILE_COLORS,
  FENCE_RINGS,
  PASTURE_PLOTS,
  pastureCenter,
  type PasturePlotDef,
  fmtRaceCountdown,
  coatOf,
  applyWorldCollision,
  trackClamp,
  matNodeType,
  nodeId,
  RACE_LAPS,
  raceBullAt,
  raceGridPosition,
  raceProgressAt,
  formatRaceLapLabel,
  currentLap,
  CHAT_SPEECH_FADE_MS,
  type MeResponse,
  type OtherPlayer,
  type PasturePlotState,
  type WorldObject,
  type BullTrait,
} from '@bullrun/shared';
import { worldData, type SyncedWorldNode } from '../../store/gameStore';

const M = worldData.M;
const CX = WORLD_CX;
const CY = WORLD_CY;
const RX = WORLD_RX;
const RY = WORLD_RY;
/** Infield list anchor — just below the upper inner fence; list grows downward. */
const TRACK_LIST_WY = CY - RY * FENCE_RINGS[0].er + 0.9;

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

function denBullPos(bullId: number, def: PasturePlotDef): { x: number; y: number } {
  const seed = bullId * 7919;
  const rx = ((seed % 100) / 100 - 0.5) * (def.w * 0.55);
  const ry = (((seed >> 8) % 100) / 100 - 0.5) * (def.h * 0.45);
  const c = pastureCenter(def);
  return { x: c.x + rx, y: c.y + ry };
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
  ctx.font = "600 11px 'Nunito', system-ui, sans-serif";
  const w = ctx.measureText(txt).width + 10;
  ctx.fillStyle = 'rgba(23,16,10,.8)';
  ctx.fillRect(s.x - w / 2, s.y - yOff - 13, w, 16);
  ctx.fillStyle = color || '#f3e7cd';
  ctx.textAlign = 'center';
  ctx.fillText(txt, s.x, s.y - yOff - 1);
  ctx.textAlign = 'left';
}

function wrapSpeechLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [text.slice(0, 24)];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  text: string,
  alpha: number,
) {
  if (alpha <= 0) return;
  const s = iso(wx, wy);
  ctx.font = "600 10px 'Nunito', system-ui, sans-serif";
  const maxW = 118;
  const lines = wrapSpeechLines(ctx, text, maxW);
  const lineH = 12;
  const padX = 7;
  const padY = 5;
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), 20);
  const w = Math.min(maxW + padX * 2, textW + padX * 2);
  const h = lines.length * lineH + padY * 2;
  const bx = s.x - w / 2;
  const by = s.y - 78 - h;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(252,248,240,0.96)';
  ctx.strokeStyle = 'rgba(23,16,10,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s.x - 5, by + h);
  ctx.lineTo(s.x + 5, by + h);
  ctx.lineTo(s.x, by + h + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#2d2318';
  ctx.textAlign = 'center';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], s.x, by + padY + 9 + i * lineH);
  }
  ctx.textAlign = 'left';
  ctx.restore();
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
  trait?: BullTrait;
  facingLeft?: boolean;
  isMe?: boolean;
  gatherMat?: string;
  gatherStart?: number;
  walking?: boolean;
  speech?: { text: string; until: number };
};

function drawArm(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  wd: number,
  dd: number,
  h: number,
  elev: number,
  skin: string,
  skinD: string,
  skinL: string,
) {
  cube(ctx, wx, wy, wd, dd, h, elev, skin, skinD, skinL);
}

function drawPlayerCharacter(
  ctx: CanvasRenderingContext2D,
  o: DrawObj,
  now: number,
) {
  const isMe = o.t === 'player';
  if (o.speech) {
    const remain = o.speech.until - now;
    const fadeMs = CHAT_SPEECH_FADE_MS;
    const alpha = remain <= fadeMs ? Math.max(0, remain / fadeMs) : 1;
    if (alpha > 0) drawSpeechBubble(ctx, o.x, o.y, o.speech.text, alpha);
  }
  const shirt = isMe ? '#e8a33d' : (o.shirt || '#e8a33d');
  const skin = '#e8c49a';
  const skinD = '#b08d64';
  const skinL = '#cca87d';
  const hair = '#3a2a1a';
  const hairD = '#241608';
  const hairL = '#2f2012';

  const s = iso(o.x, o.y);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, 10, 5, 0, 0, 7);
  ctx.fill();

  const gatherMat = o.gatherMat;
  const gatherT = gatherMat && o.gatherStart ? (now - o.gatherStart) / 1000 : 0;
  const swing = Math.sin(gatherT * 7);
  const swing2 = Math.sin(gatherT * 7 + Math.PI);

  let lArmY = 0;
  let rArmY = 0;
  let lArmH = 6;
  let rArmH = 6;
  let tool: 'axe' | 'pick' | 'pull' | null = null;

  if (gatherMat === 'wood') {
    lArmH = 7 + swing * 3;
    rArmH = 7 + swing2 * 3;
    lArmY = -swing * 0.06;
    rArmY = swing * 0.06;
    tool = 'axe';
  } else if (gatherMat === 'ore') {
    lArmH = 6 + Math.abs(swing) * 4;
    rArmH = 5 + Math.abs(swing2) * 2;
    lArmY = swing * 0.05;
    tool = 'pick';
  } else if (gatherMat === 'hay') {
    lArmY = swing * 0.07;
    rArmY = swing2 * 0.07;
    lArmH = 5 + Math.abs(swing) * 2;
    rArmH = 5 + Math.abs(swing2) * 2;
    tool = 'pull';
  } else if (o.walking) {
    const bob = Math.sin(now / 140) * 0.04;
    lArmY = bob;
    rArmY = -bob;
  }

  // legs
  cube(ctx, o.x - 0.16, o.y - 0.1, 0.14, 0.12, 5, 0, '#4a3728', '#2e2118', '#3b2c20');
  cube(ctx, o.x + 0.02, o.y - 0.1, 0.14, 0.12, 5, 0, '#4a3728', '#2e2118', '#3b2c20');

  // arms (behind torso when idle, animated when gathering)
  drawArm(ctx, o.x - 0.3, o.y - 0.08 + lArmY, 0.11, 0.1, lArmH, 4, skin, skinD, skinL);
  drawArm(ctx, o.x + 0.19, o.y - 0.08 + rArmY, 0.11, 0.1, rArmH, 4, skin, skinD, skinL);

  // torso + head
  cube(ctx, o.x - 0.18, o.y - 0.13, 0.36, 0.26, 13, 3, shirt, shade(shirt, -40), shade(shirt, -20));
  cube(ctx, o.x - 0.14, o.y - 0.11, 0.28, 0.22, 9, 16, skin, skinD, skinL);
  cube(ctx, o.x - 0.14, o.y - 0.11, 0.28, 0.22, 3, 25, hair, hairD, hairL);

  // simple held tool while gathering
  if (tool === 'axe') {
    cube(ctx, o.x - 0.34, o.y - 0.12 + lArmY, 0.06, 0.06, 5 + swing * 2, 8, '#6e4526', '#4a2f18', '#5a3a20');
    cube(ctx, o.x - 0.38, o.y - 0.14 + lArmY, 0.1, 0.04, 2, 12 + swing * 2, '#8a8a8a', '#5a5a5a', '#707070');
  } else if (tool === 'pick') {
    cube(ctx, o.x - 0.32, o.y - 0.1 + lArmY, 0.05, 0.05, 8, 7, '#6e4526', '#4a2f18', '#5a3a20');
    cube(ctx, o.x - 0.36, o.y - 0.16 + lArmY, 0.12, 0.04, 2, 14, '#7a7a7a', '#4a4a4a', '#606060');
  } else if (tool === 'pull') {
    drawArm(ctx, o.x - 0.34, o.y - 0.06 + lArmY, 0.09, 0.08, 4, 10, skin, skinD, skinL);
    drawArm(ctx, o.x + 0.25, o.y - 0.06 + rArmY, 0.09, 0.08, 4, 10, skin, skinD, skinL);
  }

  const lbl = isMe ? 'You' : (o.name || 'Player');
  label(ctx, o.x, o.y, lbl, 40, isMe ? '#f2b23a' : '#fff');
}

function bullCoat(coat: string, trait: BullTrait | undefined, now: number, wx: number): string {
  if (trait === 'rainbow') return `hsl(${((now / 18 + wx * 30) % 360)}, 72%, 55%)`;
  return coat || '#33261d';
}

function drawBullVoxel(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  now: number,
  coat: string,
  trait: BullTrait | undefined,
  facingLeft: boolean,
  labelText?: string,
) {
  const c = bullCoat(coat, trait, now, wx);
  const ghost = trait === 'ghost';
  const head = facingLeft ? -0.28 : 0.28;
  const horn = facingLeft ? -0.3 : 0.3;
  const legF = facingLeft ? -0.38 : 0.24;
  const legB = facingLeft ? 0.24 : -0.38;
  const s = iso(wx, wy);

  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, 14, 6, 0, 0, 7);
  ctx.fill();

  if (ghost) ctx.globalAlpha = 0.2;

  cube(ctx, wx - 0.45, wy - 0.22, 0.9, 0.44, 11, 5, c, shade(c, -35), shade(c, -18));
  cube(ctx, wx + head, wy - 0.18, 0.34, 0.36, 9, 10, c, shade(c, -35), shade(c, -18));
  cube(ctx, wx + horn, wy - 0.3, 0.1, 0.1, 5, 19, '#e8e4da', '#b0ac9f', '#ccc8bb');
  cube(ctx, wx + horn, wy + 0.22, 0.1, 0.1, 5, 19, '#e8e4da', '#b0ac9f', '#ccc8bb');
  cube(ctx, wx + legB, wy - 0.16, 0.14, 0.12, 5, 0, shade(c, -25), shade(c, -50), shade(c, -35));
  cube(ctx, wx + legF, wy - 0.16, 0.14, 0.12, 5, 0, shade(c, -25), shade(c, -50), shade(c, -35));

  if (ghost) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 12, 16, 8, 0, 0, 7);
    ctx.stroke();
  }

  if (labelText) label(ctx, wx, wy, labelText, 34, ghost ? '#e8e4ff' : '#fff');
}

function drawRectPastureFence(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  const corners = [
    { x: cx, y: cy },
    { x: cx + w, y: cy },
    { x: cx + w, y: cy + h },
    { x: cx, y: cy + h },
  ];
  const railHeights = [7, 14];

  for (const rh of railHeights) {
    ctx.strokeStyle = '#8a6a2e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= corners.length; i++) {
      const p = corners[i % corners.length];
      const s = iso(p.x, p.y);
      if (i === 0) ctx.moveTo(s.x, s.y - rh);
      else ctx.lineTo(s.x, s.y - rh);
    }
    ctx.stroke();
    ctx.strokeStyle = '#e0c96a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= corners.length; i++) {
      const p = corners[i % corners.length];
      const s = iso(p.x, p.y);
      if (i === 0) ctx.moveTo(s.x, s.y - rh - 1);
      else ctx.lineTo(s.x, s.y - rh - 1);
    }
    ctx.stroke();
  }

  for (const p of corners) {
    cube(ctx, p.x - 0.07, p.y - 0.07, 0.14, 0.14, 11, 0, '#e0c96a', '#a8913c', '#c4ad50');
  }
}

function drawPasturePlots(
  ctx: CanvasRenderingContext2D,
  pastures: PasturePlotState[],
  meId: string | undefined,
) {
  for (const def of PASTURE_PLOTS) {
    drawRectPastureFence(ctx, def.cx, def.cy, def.w, def.h);
    const state = pastures.find((p) => p.id === def.id);
    const c = pastureCenter(def);
    let lbl = `FOR SALE ${def.price}g`;
    let col = '#7dc24f';
    if (state?.ownerId) {
      col = state.ownerId === meId ? '#f2b23a' : '#c9b896';
      lbl = state.ownerId === meId ? `${def.label} · Lv${state.level}` : (state.ownerName ?? 'Taken');
    }
    label(ctx, c.x, c.y, lbl, 22, col);
    if (state?.ownerId === meId) {
      label(ctx, c.x, c.y, 'click to manage', 38, '#bfe3a4');
    } else if (state?.ownerId) {
      label(ctx, c.x, c.y, 'click to view bulls', 38, '#c9b896');
    }
  }
}

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
  } else if (o.t === 'raceBooth') {
    cube(ctx, o.x - 0.62, o.y - 0.48, 1.24, 0.96, 14, 0, '#a84a20', '#6e321a', '#8a3d18');
    cube(ctx, o.x - 0.74, o.y - 0.58, 1.48, 1.16, 5, 14, '#f2b23a', '#b57f1d', '#d0991f');
    const roof = iso(o.x, o.y - 0.2);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        if ((i + j) % 2 === 0) ctx.fillStyle = '#fff';
        else ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(roof.x - 14 + i * 7, roof.y - 30 + j * 5, 7, 5);
      }
    }
    if (o.label) label(ctx, o.x, o.y, o.label, 32, '#f2b23a');
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
  } else if (o.t === 'post') {
    cube(ctx, o.x - 0.08, o.y - 0.08, 0.16, 0.16, 13, 0, '#e0c96a', '#a8913c', '#c4ad50');
    cube(ctx, o.x - 0.05, o.y - 0.05, 0.1, 0.1, 2, 13, '#f2b23a', '#b57f1d', '#d0991f');
  } else if (o.t === 'player' || o.t === 'other') {
    drawPlayerCharacter(ctx, o, now);
  } else if (o.t === 'bull') {
    drawBullVoxel(ctx, o.x, o.y, now, o.coat || '#33261d', o.trait, o.facingLeft ?? false, o.label);
  }
}

/** Text painted flat on isometric ground tiles (world x/y axes). */
function drawGroundText(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  lines: { text: string; size: number; color: string; y: number; x?: number }[],
  scale = 0.034,
  baseline: CanvasTextBaseline = 'middle',
) {
  const s = iso(wx, wy);
  const paint = (ox: number, oy: number, alpha: number, shadow = false) => {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.transform(32 * scale, 16 * scale, -32 * scale, 16 * scale, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = baseline;
    for (const line of lines) {
      ctx.font = `700 ${line.size}px 'Nunito', system-ui, sans-serif`;
      ctx.fillStyle = shadow ? 'rgba(23,16,10,0.85)' : line.color;
      ctx.fillText(line.text, ox + (line.x ?? 0), line.y + oy);
    }
    ctx.restore();
  };
  paint(1.5, 1.5, 0.5, true);
  paint(0, 0, 1);
}

type GroundLine = { text: string; size: number; color: string; y: number; x?: number };

function raceListLayout(count: number): { fontSize: number; lineHeight: number; cols: number; colGap: number; scale: number } {
  const row = (fontSize: number, cols: number, colGap: number, scale: number) => ({
    fontSize,
    lineHeight: Math.ceil(fontSize * 1.85),
    cols,
    colGap,
    scale,
  });
  if (count <= 6) return row(18, 1, 0, 0.032);
  if (count <= 12) return row(15, 2, 200, 0.028);
  if (count <= 24) return row(13, 2, 210, 0.026);
  if (count <= 36) return row(11, 3, 175, 0.023);
  return row(10, 3, 165, 0.02);
}

/** Multi-line / multi-column list painted on the infield grass (single isometric transform). */
function drawGroundTextList(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  options: {
    header?: { text: string; size: number }[];
    entries: string[];
    footer?: string[];
  },
) {
  const count = Math.max(1, options.entries.length);
  const layout = raceListLayout(count);
  const perCol = Math.ceil(options.entries.length / layout.cols) || 1;
  const lines: GroundLine[] = [];
  let y = 0;

  if (options.header?.length) {
    for (const h of options.header) {
      lines.push({ text: h.text, size: h.size, color: '#ffffff', y });
      y += Math.ceil(h.size * 1.2) + 10;
    }
    y += 8;
  }

  for (let c = 0; c < layout.cols; c++) {
    const slice = options.entries.slice(c * perCol, (c + 1) * perCol);
    const x = layout.cols === 1 ? 0 : (c - (layout.cols - 1) / 2) * layout.colGap;
    let colY = y;
    for (const text of slice) {
      lines.push({ text, size: layout.fontSize, color: '#ffffff', y: colY, x });
      colY += layout.lineHeight;
    }
  }

  if (options.footer?.length) {
    const footerY = y + perCol * layout.lineHeight + 12;
    options.footer.forEach((text, i) => {
      lines.push({ text, size: 12, color: '#ffffff', y: footerY + i * 18 });
    });
  }

  drawGroundText(ctx, wx, wy, lines, layout.scale, 'top');
}

function drawRaceTrackBoard(
  ctx: CanvasRenderingContext2D,
  now: number,
  raceLive: boolean,
  raceGrid: DrawState['raceGrid'],
  raceAnim: DrawState['raceAnim'],
  me: MeResponse | null,
  results: DrawState['results'],
  resultsUntil: number | null,
  betResult: string | null,
) {
  const wx = CX;
  const listWy = TRACK_LIST_WY;

  if (raceGrid) {
    const cd = Math.max(0, Math.ceil((raceGrid.startAt - now) / 1000));
    const gridBulls = [...raceGrid.bulls].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
    drawGroundTextList(ctx, wx, listWy, {
      header: [
        { text: cd > 0 ? String(cd) : 'GO!', size: 48 },
        { text: 'STARTING GRID', size: 18 },
      ],
      entries: gridBulls.map((b) => `${b.pos}. ${b.name}`),
    });
    return;
  }

  if (raceAnim) {
    const el = now - raceAnim.startT;
    const laps = raceAnim.laps ?? RACE_LAPS;
    const lap = currentLap(el, raceAnim.bulls[0]?.finishT ?? 1, laps, raceAnim.bulls[0]?.lapTimes);
    const sorted = [...raceAnim.bulls].sort((a, b) => {
      const pa = a.lapTimes?.length
        ? raceProgressAt(el, a.lapTimes)
        : Math.min(1, el / (a.finishT ?? 1));
      const pb = b.lapTimes?.length
        ? raceProgressAt(el, b.lapTimes)
        : Math.min(1, el / (b.finishT ?? 1));
      return pb - pa;
    });
    drawGroundTextList(ctx, wx, listWy, {
      header: [{ text: formatRaceLapLabel(lap, laps), size: 24 }],
      entries: sorted.map((b, i) => `${i + 1}. ${b.name}`),
    });
    return;
  }

  if (results?.length && resultsUntil && now < resultsUntil) {
    const labels = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
    const resultLines = results.map((r) => {
      const label = labels[r.pos - 1] ?? `${r.pos}th`;
      const prize = r.prize ? `+${r.prize}g` : '—';
      const name = r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name;
      return `${label}  ${name}   ${prize}`;
    });
    const footer = betResult
      ? [betResult.length > 40 ? `${betResult.slice(0, 38)}…` : betResult]
      : undefined;
    drawGroundTextList(ctx, wx, listWy, {
      header: [{ text: 'RACE RESULTS', size: 22 }],
      entries: resultLines,
      footer,
    });
    return;
  }

  if (me?.race && !raceLive) {
    const cd = fmtRaceCountdown(new Date(me.race.startAt).getTime(), now);
    drawGroundText(ctx, wx, CY - 0.35, [
      { text: 'NEXT RACE', size: 22, color: '#ffffff', y: -12 },
      { text: cd, size: 50, color: '#ffffff', y: 28 },
    ], 0.036);
  }
}

export interface DrawState {
  cam: { x: number; y: number };
  me: MeResponse | null;
  otherPlayers: OtherPlayer[];
  nodeDead: Record<string, number>;
  walkDestination: { x: number; y: number } | null;
  worldNodes: SyncedWorldNode[];
  raceAnim: {
    bulls: Array<{ id: number | string; name: string; coat: string; trait?: BullTrait; pos: number; finishT: number; lapTimes?: number[]; owner?: string }>;
    startT: number;
    laps?: number;
  } | null;
  raceGrid: {
    bulls: Array<{ id: number | string; name: string; coat: string; trait?: BullTrait; pos: number; finishT: number; lapTimes?: number[]; owner?: string }>;
    startAt: number;
    laps: number;
  } | null;
  raceLive: boolean;
  results: import('@bullrun/shared').RaceResult[] | null;
  resultsUntil: number | null;
  betResult: string | null;
  pastures: PasturePlotState[];
  gather: { mat?: string; start: number } | null;
  walking: boolean;
  folPos: Record<number, { x: number; y: number }>;
  otherFolPos: Record<string, Record<number, { x: number; y: number }>>;
  speechBubbles: Record<string, { text: string; until: number }>;
  myPlayerId: string | null;
  camOff: { x: number; y: number };
  dpr: number;
}

export function drawWorld(ctx: CanvasRenderingContext2D, state: DrawState) {
  const { cam, me, otherPlayers, nodeDead, walkDestination, worldNodes, raceAnim, raceGrid, raceLive, results, resultsUntil, betResult, pastures, gather, walking, folPos, otherFolPos, speechBubbles, myPlayerId, camOff, dpr } = state;
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

  drawRaceTrackBoard(ctx, now, raceLive, raceGrid, raceAnim, me, results, resultsUntil, betResult);

  drawFenceRails(ctx);
  drawPasturePlots(ctx, pastures, me?.id);

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

  const list: { d: number; o: DrawObj }[] = [];

  for (const o of worldData.objs) {
    if (o.t === 'tree' || o.t === 'rock' || o.t === 'hay') continue;
    const obj: DrawObj = { ...o };
    list.push({ d: o.x + o.y, o: obj });
  }

  for (const n of worldNodes) {
    const dead = nodeDead[n.id];
    if (dead && dead > now) continue;
    const local = worldData.nodes.find((w) => nodeId(w.x, w.y, w.mat) === n.id);
    const t = matNodeType(n.mat);
    list.push({
      d: n.x + n.y,
      o: {
        t,
        x: n.x,
        y: n.y,
        mat: n.mat,
        big: local?.big,
      },
    });
  }

  for (const p of otherPlayers) {
    list.push({
      d: p.x + p.y,
      o: {
        t: 'other',
        x: p.x,
        y: p.y,
        shirt: p.shirt,
        name: p.displayName,
        speech: speechBubbles[p.id],
      },
    });
    const pf = otherFolPos[p.id] ?? {};
    let prev = { x: p.x, y: p.y };
    for (const b of p.bulls ?? []) {
      let f = pf[b.id];
      if (!f) f = { x: p.x + 1.5, y: p.y + 1.5 };
      list.push({
        d: f.x + f.y,
        o: {
          t: 'bull',
          x: f.x,
          y: f.y,
          coat: b.coat,
          trait: b.trait,
          label: b.name,
          facingLeft: f.x > prev.x,
        },
      });
      prev = f;
    }
  }

  if (me) {
    list.push({
      d: me.position.x + me.position.y,
      o: {
        t: 'player',
        x: me.position.x,
        y: me.position.y,
        gatherMat: gather?.mat,
        gatherStart: gather?.start,
        walking: walking && !gather,
        speech: myPlayerId ? speechBubbles[myPlayerId] : undefined,
      },
    });

    const racingIds = raceAnim ? new Set(raceAnim.bulls.map((b) => b.id)) : new Set<number | string>();

    for (const b of me.bulls) {
      if (!me.followingBullIds?.includes(b.id)) continue;
      if (me.entered.includes(b.id) || racingIds.has(b.id)) continue;
      let f = folPos[b.id];
      if (!f) {
        f = { x: me.position.x + 1.5, y: me.position.y + 1.5 };
        folPos[b.id] = f;
      }
      list.push({
        d: f.x + f.y,
        o: {
          t: 'bull',
          x: f.x,
          y: f.y,
          coat: coatOf(b, me.items),
          trait: b.trait,
          label: b.name,
          facingLeft: f.x > me.position.x,
        },
      });
    }
  }

  for (const plot of pastures) {
    if (!plot.ownerId || !plot.denBulls?.length) continue;
    const def = PASTURE_PLOTS.find((p) => p.id === plot.id);
    if (!def) continue;
    for (const b of plot.denBulls) {
      const pos = denBullPos(b.id, def);
      list.push({
        d: pos.x + pos.y,
        o: {
          t: 'bull',
          x: pos.x,
          y: pos.y,
          coat: b.coat,
          trait: b.trait,
          label: b.name,
          facingLeft: false,
        },
      });
    }
  }

  if (raceGrid && !raceAnim) {
    const total = raceGrid.bulls.length;
    raceGrid.bulls.forEach((b, i) => {
      const pos = raceGridPosition(b.pos ?? i + 1, total);
      list.push({
        d: pos.x + pos.y,
        o: {
          t: 'bull',
          x: pos.x,
          y: pos.y,
          coat: b.coat,
          trait: b.trait as BullTrait | undefined,
          label: b.name,
          facingLeft: pos.facingLeft,
        },
      });
    });
  }

  if (raceAnim) {
    const el = now - raceAnim.startT;
    const laps = raceAnim.laps ?? RACE_LAPS;
    const fieldSize = raceAnim.bulls.length;
    for (let i = 0; i < raceAnim.bulls.length; i++) {
      const b = raceAnim.bulls[i]!;
      const slot = b.pos ?? i + 1;
      const pos = raceBullAt(el, b.finishT, slot, laps, b.lapTimes, fieldSize);
      list.push({
        d: pos.x + pos.y,
        o: {
          t: 'bull',
          x: pos.x,
          y: pos.y,
          coat: b.coat,
          trait: b.trait as BullTrait | undefined,
          label: b.name,
          facingLeft: pos.facingLeft,
        },
      });
    }
  }

  if (walkDestination) {
    const s = iso(walkDestination.x, walkDestination.y);
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
  const followIds = new Set(me.followingBullIds ?? []);
  for (const b of me.bulls) {
    if (!followIds.has(b.id)) continue;
    if (me.entered.includes(b.id) || racingIds.has(b.id)) continue;
    let f = folPos[b.id];
    if (!f) f = folPos[b.id] = { x: me.position.x + 1.5, y: me.position.y + 1.5 };
    const d = Math.hypot(prev.x - f.x, prev.y - f.y);
    if (d > 1.5) {
      const spd = Math.min(6.5, 3.6 + (d - 1.5) * 1.5);
      f.x += ((prev.x - f.x) / d) * spd * dt;
      f.y += ((prev.y - f.y) / d) * spd * dt;
    }
    applyWorldCollision(f);
    prev = f;
  }
}

export function stepOtherFollowers(
  otherFolPos: Record<string, Record<number, { x: number; y: number }>>,
  players: OtherPlayer[],
  dt: number,
) {
  for (const p of players) {
    if (!otherFolPos[p.id]) otherFolPos[p.id] = {};
    const folPos = otherFolPos[p.id];
    let prev = { x: p.x, y: p.y };
    for (const b of p.bulls ?? []) {
      let f = folPos[b.id];
      if (!f) f = folPos[b.id] = { x: p.x + 1.5, y: p.y + 1.5 };
      const d = Math.hypot(prev.x - f.x, prev.y - f.y);
      if (d > 1.5) {
        const spd = Math.min(6.5, 3.6 + (d - 1.5) * 1.5);
        f.x += ((prev.x - f.x) / d) * spd * dt;
        f.y += ((prev.y - f.y) / d) * spd * dt;
      }
      applyWorldCollision(f);
      prev = f;
    }
  }
}

export function screenToGrid(mx: number, my: number) {
  const a = mx / 32;
  const b = my / 16;
  return { x: (b + a) / 2, y: (b - a) / 2 };
}
