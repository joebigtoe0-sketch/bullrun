/** Types for the BRArt canvas art library (bullrunArt.js). */

export type IsoFn = (x: number, y: number) => { x: number; y: number };

/** World object handed to drawObj — extra fields depend on `t`. */
export interface ArtObj {
  t: string;
  x: number;
  y: number;
  label?: string;
  dead?: number;
  big?: boolean;
  /** rail */
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  /** bridge */
  dir?: 'x' | 'y';
  len?: number;
  /** characters/bulls */
  ph?: number;
  moving?: boolean;
  run?: boolean;
  racing?: boolean;
  coat?: string;
  shirt?: string;
  hair?: string;
  name?: string;
  lvl?: number;
  chop?: { tool: 'axe' | 'pick' | 'sickle' | 'pitchfork'; ph: number } | null;
  /** mirror horizontally around the anchor (face screen-left) */
  flip?: boolean;
  /** character clothing colors by slot */
  gear?: { hat?: string; outfit?: string; boots?: string; gloves?: string };
}

export interface ArtOpts {
  /** animation clock, seconds */
  t?: number;
  /** wall clock, ms — used for `dead` node checks */
  nowMs?: number;
  stableLevel?: number;
}

export interface Faces {
  top?: string;
  left?: string;
  right?: string;
}

export const BRArt: {
  TW: number;
  TH: number;
  RARC: Record<string, string>;
  iso: IsoFn;
  hash(x: number, y: number, s?: number): number;
  mul(c: string, f: number): string;
  mix(c1: string, c2: string, t: number): string;
  cube(ctx: CanvasRenderingContext2D, iso: IsoFn, wx: number, wy: number, wd: number, dd: number, h: number, elev: number, base: string, faces?: Faces): void;
  decal(ctx: CanvasRenderingContext2D, iso: IsoFn, wx: number, wy: number, du: number, axis: 'x' | 'y', elev: number, h: number, col: string): void;
  decalFrame(ctx: CanvasRenderingContext2D, iso: IsoFn, wx: number, wy: number, du: number, axis: 'x' | 'y', elev: number, h: number, col: string, lw?: number): void;
  decalCorners(iso: IsoFn, wx: number, wy: number, du: number, axis: 'x' | 'y', elev: number, h: number): { x: number; y: number }[];
  faceLine(ctx: CanvasRenderingContext2D, iso: IsoFn, x1: number, y1: number, e1: number, x2: number, y2: number, e2: number, col: string, lw?: number): void;
  diamond(ctx: CanvasRenderingContext2D, iso: IsoFn, x: number, y: number, col: string): void;
  shadow(ctx: CanvasRenderingContext2D, iso: IsoFn, x: number, y: number, rx: number, ry: number): void;
  label(ctx: CanvasRenderingContext2D, iso: IsoFn, wx: number, wy: number, txt: string, yOff: number, color?: string): void;
  tile(ctx: CanvasRenderingContext2D, iso: IsoFn, x: number, y: number, type: string): void;
  drawObj(ctx: CanvasRenderingContext2D, iso: IsoFn, o: ArtObj, opts?: ArtOpts): void;
  drawItem(ctx: CanvasRenderingContext2D, iso: IsoFn, slot: string, rarity: string, color?: string): void;
};
