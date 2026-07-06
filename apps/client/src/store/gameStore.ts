import { create } from 'zustand';
import { buildWorld, nodeId, RACE_RESULTS_DISPLAY_MS, CHAT_LOG_MAX, CHAT_SPEECH_MS } from '@bullrun/shared';
import type { MeResponse, OtherPlayer, PanelType, PasturePlotState, RaceResult, BullTrait, MatType, ChatMessage } from '@bullrun/shared';

export interface SyncedWorldNode {
  id: string;
  x: number;
  y: number;
  mat: MatType;
}

export const worldData = buildWorld();
const seedNodes: SyncedWorldNode[] = worldData.nodes.map((n) => ({
  id: nodeId(n.x, n.y, n.mat),
  x: n.x,
  y: n.y,
  mat: n.mat,
}));

interface GameStore {
  token: string | null;
  user: { id: string; username: string; displayName: string } | null;
  me: MeResponse | null;
  panel: PanelType;
  invOpen: boolean;
  equipTarget: number | null;
  toast: string;
  otherPlayers: OtherPlayer[];
  nodeDead: Record<string, number>;
  worldNodes: SyncedWorldNode[];
  walkDestination: { x: number; y: number } | null;
  raceLive: { id: string; standings: { pos: number; name: string }[] } | null;
  raceAnim: { bulls: Array<{ id: number | string; name: string; coat: string; trait?: BullTrait; pos: number; finishT: number; lapTimes?: number[]; owner?: string }>; startT: number; endT: number; laps?: number } | null;
  raceGrid: { id: string; bulls: Array<{ id: number | string; name: string; coat: string; trait?: BullTrait; pos: number; finishT: number; lapTimes?: number[]; owner?: string }>; startAt: number; laps: number } | null;
  pastures: PasturePlotState[];
  denPlotId: number | null;
  results: RaceResult[] | null;
  resultsUntil: number | null;
  betResult: string | null;
  forgeResult: string;
  moveTarget: { x: number; y: number } | null;
  movePath: { x: number; y: number }[] | null;
  pending: { type: string; nodeId?: string; plotId?: number; x: number; y: number } | null;
  gather: { nodeId: string; start: number; dur: number; mat?: string } | null;
  buyDenConfirm: { plotId: number; label: string; price: number } | null;
  keys: Record<string, boolean>;
  chatInputFocused: boolean;
  cam: { x: number; y: number };
  freeCamUntil: number;
  shopBulls: MeResponse['shopBulls'];
  chatLog: ChatMessage[];
  speechBubbles: Record<string, { text: string; until: number }>;

  setAuth: (token: string, user: { id: string; username: string; displayName: string }) => void;
  setMe: (me: MeResponse) => void;
  setPosition: (x: number, y: number) => void;
  setPanel: (p: PanelType) => void;
  setInvOpen: (v: boolean) => void;
  setEquipTarget: (id: number | null) => void;
  toastMsg: (msg: string) => void;
  setOtherPlayers: (p: OtherPlayer[]) => void;
  updateOtherPlayer: (id: string, x: number, y: number) => void;
  addOtherPlayer: (p: OtherPlayer) => void;
  removeOtherPlayer: (id: string) => void;
  setNodeDead: (id: string, until: number) => void;
  clearNodeDead: (id: string) => void;
  setWorldNodes: (nodes: SyncedWorldNode[]) => void;
  setWalkDestination: (d: { x: number; y: number } | null) => void;
  setRaceLive: (r: GameStore['raceLive']) => void;
  setRaceAnim: (r: GameStore['raceAnim']) => void;
  setRaceGrid: (r: GameStore['raceGrid']) => void;
  setResults: (r: RaceResult[] | null, betResult?: string | null, until?: number) => void;
  clearResults: () => void;
  setForgeResult: (s: string) => void;
  setMoveTarget: (t: { x: number; y: number } | null) => void;
  setMovePath: (path: { x: number; y: number }[] | null) => void;
  advanceMovePath: () => void;
  setPending: (p: GameStore['pending']) => void;
  setGather: (g: GameStore['gather']) => void;
  setBuyDenConfirm: (c: GameStore['buyDenConfirm']) => void;
  setKey: (code: string, down: boolean) => void;
  setChatInputFocused: (v: boolean) => void;
  setCam: (x: number, y: number) => void;
  setFreeCamUntil: (t: number) => void;
  setPastures: (p: PasturePlotState[]) => void;
  setDenPlotId: (id: number | null) => void;
  addChatMessage: (msg: ChatMessage) => void;
  pruneSpeechBubbles: () => void;
  logout: () => void;
}

let toastTimer: ReturnType<typeof setTimeout>;

export const useGameStore = create<GameStore>((set, get) => ({
  token: localStorage.getItem('bullrun.token'),
  user: null,
  me: null,
  panel: null,
  invOpen: false,
  equipTarget: null,
  toast: '',
  otherPlayers: [],
  nodeDead: {},
  worldNodes: seedNodes,
  walkDestination: null,
  raceLive: null,
  raceAnim: null,
  raceGrid: null,
  results: null,
  resultsUntil: null,
  betResult: null,
  forgeResult: '',
  moveTarget: null,
  movePath: null,
  pending: null,
  gather: null,
  buyDenConfirm: null,
  keys: {},
  chatInputFocused: false,
  cam: { x: 33, y: 41 },
  freeCamUntil: 0,
  shopBulls: [],
  pastures: [],
  denPlotId: null,
  chatLog: [],
  speechBubbles: {},

  setAuth: (token, user) => {
    localStorage.setItem('bullrun.token', token);
    set({ token, user });
  },
  setMe: (me) => {
    const prev = get().me;
    if (!prev) {
      set({
        me,
        panel: null,
        shopBulls: me.shopBulls,
        cam: { x: me.position.x, y: me.position.y },
      });
      return;
    }
    set({
      me: { ...me, position: prev.position },
      shopBulls: me.shopBulls,
    });
  },
  setPosition: (x, y) => {
    const me = get().me;
    if (!me) return;
    if (me.position.x === x && me.position.y === y) return;
    set({ me: { ...me, position: { x, y } } });
  },
  setPanel: (p) => set({ panel: p, denPlotId: p === 'den' ? get().denPlotId : null }),
  setInvOpen: (v) => set({ invOpen: v, equipTarget: v ? get().equipTarget : null }),
  setEquipTarget: (id) => set({ equipTarget: id }),
  toastMsg: (msg) => {
    clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: '' }), 2600);
  },
  setOtherPlayers: (p) => set({ otherPlayers: p.map((pl) => ({ ...pl, bulls: pl.bulls ?? [] })) }),
  updateOtherPlayer: (id, x, y) =>
    set({ otherPlayers: get().otherPlayers.map((p) => (p.id === id ? { ...p, x, y } : p)) }),
  addOtherPlayer: (p) =>
    set({
      otherPlayers: [
        ...get().otherPlayers.filter((o) => o.id !== p.id),
        { ...p, bulls: p.bulls ?? [] },
      ],
    }),
  removeOtherPlayer: (id) => set({ otherPlayers: get().otherPlayers.filter((p) => p.id !== id) }),
  setNodeDead: (id, until) => set({ nodeDead: { ...get().nodeDead, [id]: until } }),
  clearNodeDead: (id) => {
    const nd = { ...get().nodeDead };
    delete nd[id];
    set({ nodeDead: nd });
  },
  setWorldNodes: (nodes) => set({ worldNodes: nodes }),
  setWalkDestination: (d) => set({ walkDestination: d }),
  setRaceLive: (r) => set({ raceLive: r }),
  setRaceAnim: (r) => set({ raceAnim: r, ...(r ? { raceGrid: null } : {}) }),
  setRaceGrid: (r) => set({ raceGrid: r }),
  setResults: (r, betResult = null, until) =>
    set({
      results: r,
      betResult: betResult ?? null,
      resultsUntil: r ? (until ?? Date.now() + RACE_RESULTS_DISPLAY_MS) : null,
    }),
  clearResults: () => set({ results: null, resultsUntil: null, betResult: null }),
  setForgeResult: (s) => set({ forgeResult: s }),
  setMoveTarget: (t) => set({ moveTarget: t }),
  setMovePath: (path) =>
    set({ movePath: path, moveTarget: path && path.length > 0 ? path[0] : null }),
  advanceMovePath: () => {
    const path = get().movePath;
    if (!path || path.length <= 1) {
      set({ movePath: null, moveTarget: null });
      return;
    }
    const rest = path.slice(1);
    set({ movePath: rest, moveTarget: rest[0] });
  },
  setPending: (p) => set({ pending: p }),
  setGather: (g) => set({ gather: g }),
  setBuyDenConfirm: (c) => set({ buyDenConfirm: c }),
  setKey: (code, down) => set({ keys: { ...get().keys, [code]: down } }),
  setChatInputFocused: (v) => set({ chatInputFocused: v }),
  setCam: (x, y) => set({ cam: { x, y } }),
  setFreeCamUntil: (t) => set({ freeCamUntil: t }),
  setPastures: (p) => set({ pastures: p }),
  setDenPlotId: (id) => set({ denPlotId: id }),
  addChatMessage: (msg) => {
    const until = Date.now() + CHAT_SPEECH_MS;
    set({
      chatLog: [...get().chatLog, msg].slice(-CHAT_LOG_MAX),
      speechBubbles: { ...get().speechBubbles, [msg.id]: { text: msg.text, until } },
    });
  },
  pruneSpeechBubbles: () => {
    const now = Date.now();
    const bb = get().speechBubbles;
    let changed = false;
    const next = { ...bb };
    for (const [id, b] of Object.entries(bb)) {
      if (b.until < now) {
        delete next[id];
        changed = true;
      }
    }
    if (changed) set({ speechBubbles: next });
  },
  logout: () => {
    localStorage.removeItem('bullrun.token');
    set({
      token: null,
      user: null,
      me: null,
      otherPlayers: [],
      pastures: [],
      denPlotId: null,
      buyDenConfirm: null,
      chatLog: [],
      speechBubbles: {},
    });
  },
}));
