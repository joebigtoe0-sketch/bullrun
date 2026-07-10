import {
  WORLD_CX,
  WORLD_CY,
  WORLD_RX,
  WORLD_RY,
  FENCE_RINGS,
  PASTURE_PLOTS,
  pastureCenter,
  type PasturePlotDef,
  fmtRaceCountdown,
  coatOf,
  bullGearFromItems,
  applyWorldCollision,
  trackClamp,
  matNodeType,
  nodeId,
  RACE_LAPS,
  raceBullAt,
  raceGridPosition,
  raceFinishPosition,
  raceElapsedMs,
  raceMaxDurationMs,
  formatRaceLapLabel,
  currentLap,
  liveStandings,
  formatLiveStandingLine,
  CHAT_SPEECH_FADE_MS,
  shirtColorForId,
  isOnBridge,
  isTrackBlocked,
  BRIDGE_X,
  BRIDGE_Y,
  BRIDGE_LEN,
  type MeResponse,
  type GameItem,
  type BullGear,
  type OtherPlayer,
  type PasturePlotState,
  type WorldObject,
  type BullTrait,
} from '@bullrun/shared';
import { worldData, type SyncedWorldNode } from '../../store/gameStore';
import { BRArt, type ArtObj } from './bullrunArt';

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

/** Follower bull position + walk-cycle state (mutated in place each frame). */
export interface FollowerPos {
  x: number;
  y: number;
  ph?: number;
  moving?: boolean;
  flip?: boolean;
  back?: boolean;
}

/** Den bulls graze in a slow wander bounded inside the fence. */
interface DenWander {
  x: number;
  y: number;
  tx: number;
  ty: number;
  ph: number;
  wait: number;
  moving: boolean;
  flip: boolean;
  back: boolean;
}
const denWander = new Map<number, DenWander>();
let denLastT = 0;

function denBounds(def: PasturePlotDef) {
  const m = 0.8; // keep clear of the fence
  return { x0: def.cx + m, x1: def.cx + def.w - m, y0: def.cy + m, y1: def.cy + def.h - m };
}

function stepDenBull(id: number, def: PasturePlotDef, dt: number): DenWander {
  const b = denBounds(def);
  let w = denWander.get(id);
  if (!w) {
    const seed = id * 7919;
    const x = b.x0 + ((seed % 100) / 100) * (b.x1 - b.x0);
    const y = b.y0 + (((seed >> 8) % 100) / 100) * (b.y1 - b.y0);
    w = { x, y, tx: x, ty: y, ph: 0, wait: Math.random() * 3, moving: false, flip: false, back: false };
    denWander.set(id, w);
  }
  if (w.wait > 0) {
    w.wait -= dt;
    w.moving = false;
  } else {
    const d = Math.hypot(w.tx - w.x, w.ty - w.y);
    if (d < 0.15) {
      w.tx = b.x0 + Math.random() * (b.x1 - b.x0);
      w.ty = b.y0 + Math.random() * (b.y1 - b.y0);
      w.wait = 1.5 + Math.random() * 4;
      w.moving = false;
    } else {
      const spd = 1.1;
      const sx = ((w.tx - w.x) / d) * spd * dt;
      const sy = ((w.ty - w.y) / d) * spd * dt;
      w.x += sx;
      w.y += sy;
      w.moving = true;
      w.ph += spd * dt * 2.4;
      const screenDx = sx - sy;
      const screenDy = sx + sy;
      if (Math.abs(screenDx) > 0.0005) w.flip = screenDx < 0;
      if (Math.abs(screenDy) > 0.0005) w.back = screenDy < 0;
    }
  }
  return w;
}

function label(ctx: CanvasRenderingContext2D, wx: number, wy: number, txt: string, yOff: number, color: string) {
  BRArt.label(ctx, iso, wx, wy, txt, yOff, color);
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
  ctx.font = "600 10px 'Pixelify Sans', monospace";
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

/** Checkered start/finish strip painted across the track at CX. */
function drawStartFinishStrip(ctx: CanvasRenderingContext2D) {
  const sy0 = CY + RY * 0.83;
  const sy1 = CY + RY * 1.17;
  const nCk = 7;
  for (let i = 0; i < nCk; i++) {
    for (let j = 0; j < 2; j++) {
      const ya = sy0 + ((sy1 - sy0) * i) / nCk;
      const yb = sy0 + ((sy1 - sy0) * (i + 1)) / nCk;
      const xa = CX + (j - 1) * 0.38;
      const xb = xa + 0.38;
      ctx.fillStyle = (i + j) % 2 ? '#efe9dc' : '#241a10';
      const q = [iso(xa, ya), iso(xb, ya), iso(xb, yb), iso(xa, yb)];
      ctx.beginPath();
      ctx.moveTo(q[0].x, q[0].y);
      for (let k = 1; k < 4; k++) ctx.lineTo(q[k].x, q[k].y);
      ctx.closePath();
      ctx.fill();
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
  seed?: number;
  facingLeft?: boolean;
  isMe?: boolean;
  gatherMat?: string;
  gatherStart?: number;
  walking?: boolean;
  ph?: number;
  moving?: boolean;
  run?: boolean;
  racing?: boolean;
  flip?: boolean;
  back?: boolean;
  bridgeElev?: number;
  gear?: Record<string, { color: string; accent: string }>;
  bullGear?: BullGear;
  speech?: { text: string; until: number };
};

/** Stable numeric seed from a bull id (number or string). */
function bullSeed(id: number | string | undefined): number | undefined {
  if (id == null) return undefined;
  if (typeof id === 'number') return id;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 9973;
}

/* ---- floating gather feedback ("+3 wood", "+3 XP", sparks) ---- */
interface FloatFx {
  x: number;
  y: number;
  text: string;
  color: string;
  start: number;
  sparks: boolean;
}

const floatFx: FloatFx[] = [];

export function addFloatText(x: number, y: number, text: string, color = '#bfe3a4', sparks = false) {
  floatFx.push({ x, y, text, color, start: performance.now(), sparks });
}

function drawFloatFx(ctx: CanvasRenderingContext2D) {
  const now = performance.now();
  for (let i = floatFx.length - 1; i >= 0; i--) {
    const f = floatFx[i];
    const t = (now - f.start) / 1200;
    if (t >= 1) {
      floatFx.splice(i, 1);
      continue;
    }
    const s = iso(f.x, f.y);
    const rise = t * 30;
    ctx.save();
    ctx.globalAlpha = 1 - t * t;
    if (f.sparks) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + f.start % 7;
        const r = 6 + t * 22;
        ctx.fillStyle = k % 2 ? '#f2c94c' : '#bfe3a4';
        ctx.fillRect(s.x + Math.cos(a) * r - 1.2, s.y - 14 - rise * 0.7 + Math.sin(a) * r * 0.5 - 1.2, 2.4, 2.4);
      }
    }
    ctx.font = "700 13px 'Pixelify Sans', monospace";
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(23,16,10,.85)';
    ctx.fillText(f.text, s.x + 1.5, s.y - 34 - rise + 1.5);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, s.x, s.y - 34 - rise);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

/*
 * Facing rules — the walk trackers store `left` = last horizontal screen direction:
 * - person art faces down-LEFT by default (eyes on the +y face) -> mirror when moving right
 * - bull art faces down-RIGHT (head on +x); back mode pre-mirrors the head to up-left,
 *   so the screen mirror must invert while facing away
 */
function personFlip(left: boolean, back: boolean): boolean {
  return back ? left : !left;
}
function bullFlip(left: boolean, back: boolean): boolean {
  return back ? !left : left;
}

/** Per-player walk cycle derived from observed movement (positions come from the server). */
const walkAnim = new Map<string, { x: number; y: number; ph: number; moving: boolean; flip: boolean; back: boolean }>();
function otherWalkAnim(id: string, x: number, y: number) {
  let w = walkAnim.get(id);
  if (!w) {
    w = { x, y, ph: 0, moving: false, flip: false, back: false };
    walkAnim.set(id, w);
  }
  const dx = x - w.x;
  const dy = y - w.y;
  const dm = Math.hypot(dx, dy);
  w.moving = dm > 0.003;
  if (w.moving) {
    w.ph += Math.min(0.6, dm * 3);
    const screenDx = dx - dy;
    const screenDy = dx + dy;
    if (Math.abs(screenDx) > 0.002) w.flip = screenDx < 0;
    if (Math.abs(screenDy) > 0.002) w.back = screenDy < 0;
  }
  w.x = x;
  w.y = y;
  return w;
}

function drawRectPastureFence(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  const corners = [
    { x: cx, y: cy },
    { x: cx + w, y: cy },
    { x: cx + w, y: cy + h },
    { x: cx, y: cy + h },
  ];
  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % corners.length];
    BRArt.drawObj(ctx, iso, { t: 'rail', x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
  }
  for (const p of corners) {
    BRArt.drawObj(ctx, iso, { t: 'post', x: p.x, y: p.y });
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

const GATHER_TOOL: Record<string, 'axe' | 'pick' | 'sickle' | 'pitchfork'> = {
  wood: 'axe',
  ore: 'pick',
  hay: 'pitchfork',
};

/** Equipped character clothing → render colors by slot. */
type GearPiece = { color: string; accent: string };
function gearFromItems(items: GameItem[] | undefined): Record<string, GearPiece> {
  const gear: Record<string, GearPiece> = {};
  for (const it of items ?? []) {
    if (it.kind === 'char' && it.equipped) gear[it.slot] = { color: it.color, accent: it.rarityColor };
  }
  return gear;
}

/** Own player's facing, tracked from frame-to-frame movement. */
const myWalk = { x: 0, y: 0, flip: false, back: false, init: false };

/** Pixel height of the bridge deck under an entity standing on it (0 = not on bridge). */
function bridgeElevAt(x: number, y: number): number {
  if (!isOnBridge(x, y)) return 0;
  const half = BRIDGE_LEN / 2;
  const u = Math.max(-half, Math.min(half, y - BRIDGE_Y));
  const arch = 2 + 38 * (1 - (u / half) * (u / half));
  return Math.max(0, arch) + 2.4;
}

/** Sort key for anyone standing on the deck — always paints over the bridge span (dSort 4.5). */
const BRIDGE_RIDER_D = BRIDGE_X + BRIDGE_Y + 5.5;

/** Delegate drawing to the shared BRArt library, mapping game state to art objects. */
function drawObj(ctx: CanvasRenderingContext2D, o: DrawObj, stableLevel: number, now: number, artT: number) {
  const opts = { t: artT, nowMs: now, stableLevel };

  const lifted = o.bridgeElev ?? 0;
  if (lifted > 0) {
    ctx.save();
    ctx.translate(0, -lifted);
  }
  try {

  if (o.t === 'player' || o.t === 'other') {
    if (o.speech) {
      const remain = o.speech.until - now;
      const alpha = remain <= CHAT_SPEECH_FADE_MS ? Math.max(0, remain / CHAT_SPEECH_FADE_MS) : 1;
      if (alpha > 0) drawSpeechBubble(ctx, o.x, o.y, o.speech.text, alpha);
    }
    const chop = o.gatherMat && o.gatherStart
      ? { tool: GATHER_TOOL[o.gatherMat] ?? 'pitchfork', ph: (now - o.gatherStart) / 90 }
      : null;
    BRArt.drawObj(ctx, iso, {
      t: o.t === 'player' ? 'player' : 'npc',
      x: o.x,
      y: o.y,
      shirt: o.shirt,
      name: o.name,
      lvl: o.lvl,
      moving: o.walking || o.moving,
      ph: o.ph ?? now / 111,
      chop,
      flip: o.flip,
      back: o.back,
      gear: o.gear,
    }, opts);
    return;
  }

  if (o.t === 'bull') {
    BRArt.drawObj(ctx, iso, {
      t: 'bull',
      x: o.x,
      y: o.y,
      coat: o.bullGear?.coat || o.coat || '#33261d',
      trait: o.trait,
      seed: o.seed,
      label: o.label,
      ph: o.ph,
      moving: o.moving,
      run: o.run,
      racing: o.racing,
      flip: o.flip,
      back: o.back,
      bullGear: o.bullGear,
    }, opts);
    return;
  }

  BRArt.drawObj(ctx, iso, o as ArtObj, opts);
  } finally {
    if (lifted > 0) ctx.restore();
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
      ctx.font = `700 ${line.size}px 'Pixelify Sans', monospace`;
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

  if (raceAnim?.frozen) {
    drawGroundTextList(ctx, wx, listWy, {
      header: [{ text: 'FINISH', size: 28 }],
      entries: [...raceAnim.bulls]
        .sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99))
        .map((b) => `${b.pos}. ${b.name}`),
    });
    return;
  }

  if (raceAnim && !raceAnim.frozen) {
    const el = raceElapsedMs(raceAnim, now);
    const laps = raceAnim.laps ?? RACE_LAPS;
    const lap = currentLap(el, raceAnim.bulls[0]?.finishT ?? 1, laps, raceAnim.bulls[0]?.lapTimes);
    const standings = liveStandings(raceAnim.bulls, el);
    drawGroundTextList(ctx, wx, listWy, {
      header: [{ text: formatRaceLapLabel(lap, laps), size: 24 }],
      entries: standings.map(formatLiveStandingLine),
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
    id?: string;
    bulls: Array<{ id: number | string; name: string; coat: string; trait?: BullTrait; pos: number; gridSlot?: number; finishT: number; lapTimes?: number[]; owner?: string; gear?: import('@bullrun/shared').BullGear }>;
    startT: number;
    laps?: number;
    frozen?: boolean;
    elapsedMs?: number;
    elapsedAt?: number;
    maxElapsedMs?: number;
  } | null;
  raceGrid: {
    bulls: Array<{ id: number | string; name: string; coat: string; trait?: BullTrait; pos: number; gridSlot?: number; finishT: number; lapTimes?: number[]; owner?: string; gear?: import('@bullrun/shared').BullGear }>;
    startAt: number;
    laps: number;
  } | null;
  raceLive: boolean;
  results: import('@bullrun/shared').RaceResult[] | null;
  resultsUntil: number | null;
  betResult: string | null;
  pastures: PasturePlotState[];
  gather: { mat?: string; start: number; nodeX?: number; nodeY?: number } | null;
  walking: boolean;
  folPos: Record<number, FollowerPos>;
  otherFolPos: Record<string, Record<number, FollowerPos>>;
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

  const artT = performance.now() / 1000;

  for (let x = 0; x < M; x++) {
    for (let y = 0; y < M; y++) {
      const s = iso(x, y);
      if (s.x + ox < -80 || s.x + ox > cw + 80 || s.y + oy < -60 || s.y + oy > ch + 60) continue;
      BRArt.tile(ctx, iso, x, y, worldData.tiles[x][y]);
    }
  }

  // track edge lines (subtle) + mid divider + checkered start/finish strip
  drawRing(ctx, 0.82, 'rgba(96,62,30,.4)');
  drawRing(ctx, 1.18, 'rgba(96,62,30,.4)');
  drawRing(ctx, 1.0, 'rgba(245,240,228,.4)');
  drawStartFinishStrip(ctx);

  drawRaceTrackBoard(ctx, now, raceLive, raceGrid, raceAnim, me, results, resultsUntil, betResult);

  drawPasturePlots(ctx, pastures, me?.id);

  const list: { d: number; o: DrawObj }[] = [];

  for (const o of worldData.objs) {
    if (o.t === 'tree' || o.t === 'rock' || o.t === 'hay') continue;
    const obj: DrawObj = { ...o };
    list.push({ d: o.x + o.y + (o.dSort ?? 0), o: obj });
  }

  for (const n of worldNodes) {
    const dead = nodeDead[n.id];
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
        dead: dead && dead > now ? dead : undefined,
      },
    });
  }

  const racingBullIds = new Set<string>(
    [...(raceAnim?.bulls ?? []), ...(raceGrid?.bulls ?? [])].map((b) => String(b.id)),
  );

  for (const p of otherPlayers) {
    const walk = otherWalkAnim(p.id, p.x, p.y);
    const pElev = bridgeElevAt(p.x, p.y);
    list.push({
      d: pElev > 0 ? BRIDGE_RIDER_D : p.x + p.y,
      o: {
        t: 'other',
        x: p.x,
        y: p.y,
        shirt: p.shirt,
        name: p.displayName,
        lvl: p.level ?? 1,
        moving: walk.moving,
        ph: walk.ph,
        flip: personFlip(walk.flip, walk.back),
        back: walk.back,
        bridgeElev: pElev,
        speech: speechBubbles[p.id],
      },
    });
    const pf = otherFolPos[p.id] ?? {};
    for (const b of p.bulls ?? []) {
      if (racingBullIds.has(String(b.id))) continue;
      let f = pf[b.id];
      if (!f) f = { x: p.x + 1.5, y: p.y + 1.5 };
      const fElev = bridgeElevAt(f.x, f.y);
      list.push({
        d: fElev > 0 ? BRIDGE_RIDER_D : f.x + f.y,
        o: {
          t: 'bull',
          x: f.x,
          y: f.y,
          coat: b.coat,
          trait: b.trait,
          seed: bullSeed(b.id),
          label: b.name,
          ph: f.ph,
          moving: f.moving,
          flip: bullFlip(!!f.flip, !!f.back),
          back: f.back,
          bridgeElev: fElev,
        },
      });
    }
  }

  if (me) {
    // facing: follow movement direction; face the node while gathering
    if (!myWalk.init) {
      myWalk.x = me.position.x;
      myWalk.y = me.position.y;
      myWalk.init = true;
    }
    const mdx = me.position.x - myWalk.x;
    const mdy = me.position.y - myWalk.y;
    const mScreenDx = mdx - mdy;
    const mScreenDy = mdx + mdy;
    if (Math.abs(mScreenDx) > 0.002) myWalk.flip = mScreenDx < 0;
    if (Math.abs(mScreenDy) > 0.002) myWalk.back = mScreenDy < 0;
    myWalk.x = me.position.x;
    myWalk.y = me.position.y;
    let myLeft = myWalk.flip;
    let myBack = myWalk.back;
    if (gather && gather.nodeX != null && gather.nodeY != null) {
      const nodeScreenDx = (gather.nodeX - gather.nodeY) - (me.position.x - me.position.y);
      const nodeScreenDy = (gather.nodeX + gather.nodeY) - (me.position.x + me.position.y);
      if (Math.abs(nodeScreenDx) > 0.01) myLeft = nodeScreenDx < 0;
      myBack = nodeScreenDy < -0.05;
    }
    const myFlip = personFlip(myLeft, myBack);
    const myElev = bridgeElevAt(me.position.x, me.position.y);
    list.push({
      d: myElev > 0 ? BRIDGE_RIDER_D : me.position.x + me.position.y,
      o: {
        t: 'player',
        x: me.position.x,
        y: me.position.y,
        shirt: myPlayerId ? shirtColorForId(myPlayerId) : undefined,
        label: `Lv ${me.level ?? 1} · You`,
        gatherMat: gather?.mat,
        gatherStart: gather?.start,
        walking: walking && !gather,
        flip: myFlip,
        back: myBack,
        bridgeElev: myElev,
        gear: gearFromItems(me.items),
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
      const fElev = bridgeElevAt(f.x, f.y);
      list.push({
        d: fElev > 0 ? BRIDGE_RIDER_D : f.x + f.y,
        o: {
          t: 'bull',
          x: f.x,
          y: f.y,
          coat: coatOf(b, me.items),
          bullGear: bullGearFromItems(b.id, me.items),
          trait: b.trait,
          seed: bullSeed(b.id),
          label: b.name,
          ph: f.ph,
          moving: f.moving,
          flip: bullFlip(!!f.flip, !!f.back),
          back: f.back,
          bridgeElev: fElev,
        },
      });
    }
  }

  const myFollowing = new Set(me?.followingBullIds ?? []);
  const myBullById = new Map(me?.bulls.map((b) => [b.id, b]) ?? []);

  const denDt = denLastT ? Math.min(0.05, (now - denLastT) / 1000) : 0;
  denLastT = now;

  for (const plot of pastures) {
    if (!plot.ownerId || !plot.denBulls?.length) continue;
    const def = PASTURE_PLOTS.find((p) => p.id === plot.id);
    if (!def) continue;
    for (const b of plot.denBulls) {
      if (myFollowing.has(b.id)) continue;
      const own = myBullById.get(b.id);
      if (own && own.location !== 'den') continue;
      const w = stepDenBull(b.id, def, denDt);
      list.push({
        d: w.x + w.y,
        o: {
          t: 'bull',
          x: w.x,
          y: w.y,
          coat: b.coat,
          bullGear: me ? bullGearFromItems(b.id, me.items) : undefined,
          trait: b.trait,
          seed: bullSeed(b.id),
          label: b.name,
          ph: w.ph,
          moving: w.moving,
          flip: bullFlip(w.flip, w.back),
          back: w.back,
        },
      });
    }
  }

  if (raceGrid && !raceAnim) {
    const total = raceGrid.bulls.length;
    raceGrid.bulls.forEach((b, i) => {
      const slot = b.gridSlot ?? i + 1;
      const pos = raceGridPosition(slot, total);
      list.push({
        d: pos.x + pos.y,
        o: {
          t: 'bull',
          x: pos.x,
          y: pos.y,
          coat: b.gear?.coat || b.coat,
          bullGear: b.gear,
          trait: b.trait as BullTrait | undefined,
          seed: bullSeed(b.id),
          label: b.name,
          racing: true,
          // lap 1 launches toward -x: away from the camera, no mirror
          back: true,
          flip: false,
        },
      });
    });
  }

  if (raceAnim) {
    const el = raceAnim.frozen
      ? raceMaxDurationMs(raceAnim.bulls)
      : raceElapsedMs(raceAnim, now);
    const laps = raceAnim.laps ?? RACE_LAPS;
    const fieldSize = raceAnim.bulls.length;
    for (let i = 0; i < raceAnim.bulls.length; i++) {
      const b = raceAnim.bulls[i]!;
      const gridSlot = b.gridSlot ?? i + 1;
      const place = b.pos ?? i + 1;
      const pos = raceAnim.frozen
        ? raceFinishPosition(place, fieldSize)
        : raceBullAt(el, b.finishT, gridSlot, laps, b.lapTimes, fieldSize, place);
      let left = pos.facingLeft;
      let back = !!raceAnim.frozen; // finish line-up faces the direction of travel (up-left)
      if (raceAnim.frozen) left = true;
      if (!raceAnim.frozen) {
        const ahead = raceBullAt(el + 80, b.finishT, gridSlot, laps, b.lapTimes, fieldSize, place);
        const sdx = (ahead.x - pos.x) - (ahead.y - pos.y);
        const sdy = (ahead.x - pos.x) + (ahead.y - pos.y);
        if (Math.abs(sdx) > 0.0005) left = sdx < 0;
        back = sdy < 0;
      }
      const flip = bullFlip(left, back);
      list.push({
        d: pos.x + pos.y,
        o: {
          t: 'bull',
          x: pos.x,
          y: pos.y,
          coat: b.gear?.coat || b.coat,
          bullGear: b.gear,
          trait: b.trait as BullTrait | undefined,
          seed: bullSeed(b.id),
          label: b.name,
          racing: true,
          moving: !raceAnim.frozen,
          run: !raceAnim.frozen,
          ph: el / 60,
          flip,
          back,
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
  for (const it of list) drawObj(ctx, it.o, stableLevel, now, artT);

  drawFloatFx(ctx);

  ctx.restore();
}

/** Where a follower should head: straight at the owner, or via the bridge when the track is in the way. */
function chasePoint(f: { x: number; y: number }, owner: { x: number; y: number }): { x: number; y: number } {
  const blocked =
    isTrackBlocked((f.x + owner.x) / 2, (f.y + owner.y) / 2) ||
    isTrackBlocked(f.x * 0.25 + owner.x * 0.75, f.y * 0.25 + owner.y * 0.75) ||
    isTrackBlocked(f.x * 0.75 + owner.x * 0.25, f.y * 0.75 + owner.y * 0.25);
  if (!blocked) return owner;
  const endIn = { x: BRIDGE_X, y: BRIDGE_Y - BRIDGE_LEN / 2 - 0.2 };
  const endOut = { x: BRIDGE_X, y: BRIDGE_Y + BRIDGE_LEN / 2 + 0.2 };
  if (isOnBridge(f.x, f.y)) {
    // already on the deck — cross toward the end nearer the owner
    const dIn = Math.hypot(owner.x - endIn.x, owner.y - endIn.y);
    const dOut = Math.hypot(owner.x - endOut.x, owner.y - endOut.y);
    return dIn < dOut ? endIn : endOut;
  }
  // approach the bridge from my own side first
  const dIn = Math.hypot(f.x - endIn.x, f.y - endIn.y);
  const dOut = Math.hypot(f.x - endOut.x, f.y - endOut.y);
  return dIn < dOut ? endIn : endOut;
}

function stepFollowerToward(f: FollowerPos, owner: { x: number; y: number }, dt: number) {
  const d = Math.hypot(owner.x - f.x, owner.y - f.y);
  if (d > 16) {
    // hopelessly separated (e.g. desync) — catch up instantly
    f.x = owner.x + 1.2;
    f.y = owner.y + 1.2;
    f.moving = false;
    applyWorldCollision(f);
    return;
  }
  if (d > 1.5) {
    const target = chasePoint(f, owner);
    const td = Math.hypot(target.x - f.x, target.y - f.y);
    if (td > 0.05) {
      const spd = Math.min(6.5, 3.6 + (d - 1.5) * 1.5);
      const stepX = ((target.x - f.x) / td) * spd * dt;
      const stepY = ((target.y - f.y) / td) * spd * dt;
      f.x += stepX;
      f.y += stepY;
      f.moving = true;
      f.ph = (f.ph ?? 0) + spd * dt * 2.4;
      const screenDx = stepX - stepY;
      const screenDy = stepX + stepY;
      if (Math.abs(screenDx) > 0.0005) f.flip = screenDx < 0;
      if (Math.abs(screenDy) > 0.0005) f.back = screenDy < 0;
    }
  } else {
    f.moving = false;
  }
  applyWorldCollision(f);
}

export function stepFollowers(
  folPos: Record<number, FollowerPos>,
  me: MeResponse,
  dt: number,
  racingIds: Set<number | string> = new Set(),
) {
  let prev: { x: number; y: number } = me.position;
  const followIds = new Set(me.followingBullIds ?? []);
  for (const b of me.bulls) {
    if (!followIds.has(b.id)) continue;
    if (me.entered.includes(b.id) || racingIds.has(b.id)) continue;
    let f = folPos[b.id];
    if (!f) f = folPos[b.id] = { x: me.position.x + 1.5, y: me.position.y + 1.5 };
    stepFollowerToward(f, prev, dt);
    prev = f;
  }
}

export function stepOtherFollowers(
  otherFolPos: Record<string, Record<number, FollowerPos>>,
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
      stepFollowerToward(f, prev, dt);
      prev = f;
    }
  }
}

export function screenToGrid(mx: number, my: number) {
  const a = mx / 32;
  const b = my / 16;
  return { x: (b + a) / 2, y: (b - a) / 2 };
}
