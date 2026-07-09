export type MatType = 'hay' | 'ore' | 'wood';
export type StatType = 'speed' | 'stamina' | 'accel';
export type ItemSlot = 'coat' | 'horns' | 'hooves' | 'tail' | 'accessory';
export type RarityKey = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type TileType = 'g1' | 'g2' | 'dirt' | 'stone' | 'trk1' | 'trk2';
export type PanelType = 'stable' | 'race' | 'bet' | 'market' | 'forge' | 'den' | 'help' | 'results' | null;
export type BullLocation = 'stable' | 'den' | 'following';
export type BullTrait = 'normal' | 'rainbow' | 'ghost';
export type BullRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface Materials {
  hay: number;
  ore: number;
  wood: number;
}

export interface ItemBonus {
  stat: StatType;
  amt: number;
}

export interface GameItem {
  id: number;
  slot: ItemSlot;
  rarity: RarityKey;
  rarityColor: string;
  name: string;
  color: string;
  bonus: ItemBonus | null;
  equippedTo: number | null;
}

export interface Bull {
  id: number;
  name: string;
  level: number;
  xp: number;
  speed: number;
  stamina: number;
  accel: number;
  temper: number;
  energy: number;
  coat: string;
  trait?: BullTrait;
  rarity?: BullRarity;
  location?: BullLocation;
  denPlotId?: number | null;
}

export interface NpcBull {
  id: string;
  name: string;
  owner: string;
  coat: string;
  speed: number;
  stamina: number;
  accel: number;
  temper: number;
  isNpc: true;
}

export interface RaceBull {
  id: number | string;
  name: string;
  level?: number;
  xp?: number;
  speed: number;
  stamina: number;
  accel: number;
  temper: number;
  energy?: number;
  coat: string;
  trait?: BullTrait;
  owner?: string;
  isMine?: boolean;
  isNpc?: boolean;
  score?: number;
  pos?: number;
  finishT?: number;
  /** Per-lap durations (ms); cumulative sum equals finishT. */
  lapTimes?: number[];
  userId?: string;
  /** Lane on the starting grid (1…n). Distinct from finish `pos`. */
  gridSlot?: number;
}

export interface Stable {
  level: number;
  wood: number;
}

export interface MarketListing {
  id: string;
  sellerId: string;
  sellerName: string;
  type: 'material' | 'item' | 'bull' | 'gold';
  mat?: MatType;
  qty?: number;
  item?: GameItem;
  bull?: Partial<Bull>;
  price: number;
  tokenPrice?: number;
  status: 'open' | 'reserved' | 'cancelling' | 'sold' | 'cancelled';
  soldAt?: number;
  cooldownUntil?: number;
}

export interface ShopBull {
  name: string;
  coat: string;
  speed: number;
  stamina: number;
  accel: number;
  temper: number;
  seller: string;
  price: number;
}

export interface WorldNode {
  t: 'tree' | 'rock' | 'hay';
  mat: MatType;
  x: number;
  y: number;
  dead: number;
  big?: boolean;
}

export interface WorldObject {
  t: string;
  x: number;
  y: number;
  label?: string;
  mat?: MatType;
  dead?: number;
  big?: boolean;
  /** rail segment endpoints (fence rails between posts) */
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  /** bridge orientation + span (world units) */
  dir?: 'x' | 'y';
  len?: number;
  /** extra depth-sort bias so tall spans draw over what they cross */
  dSort?: number;
}

export interface Interactable {
  t: 'stable' | 'bet' | 'market' | 'forge' | 'race';
  x: number;
  y: number;
  label: string;
}

export interface NpcWanderer {
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
  name: string;
  lvl: number;
  shirt: string;
}

export interface WorldData {
  M: number;
  CX: number;
  CY: number;
  RX: number;
  RY: number;
  tiles: TileType[][];
  objs: WorldObject[];
  nodes: WorldNode[];
  interactables: Interactable[];
  npcs: NpcWanderer[];
  pasturePlots: import('./pastures.js').PasturePlotDef[];
}

export interface PastureDisplayBull {
  id: number;
  name: string;
  coat: string;
  trait?: BullTrait;
  rarity?: BullRarity;
  level?: number;
  speed?: number;
  stamina?: number;
  accel?: number;
}

export interface PasturePlotState {
  id: number;
  ownerId: string | null;
  ownerName: string | null;
  level: number;
  woodInvested: number;
  displayBull: PastureDisplayBull | null;
  denBulls: PastureDisplayBull[];
  denCount: number;
  denCapacity: number;
  nextSpawnAt: number | null;
}

export interface PlayerPosition {
  x: number;
  y: number;
}

export interface OtherPlayerBull {
  id: number;
  name: string;
  coat: string;
  trait?: BullTrait;
}

export interface OtherPlayer {
  id: string;
  username: string;
  displayName: string;
  x: number;
  y: number;
  stableLevel: number;
  shirt: string;
  bulls: OtherPlayerBull[];
}

export interface ActiveBet {
  bullId: number | string;
  name: string;
  amount: number;
  odds: number;
}

export interface RaceState {
  id: string;
  phase: 'scheduled' | 'running' | 'finished';
  startAt: number;
  endAt?: number;
  startT?: number;
  endT?: number;
  bulls: RaceBull[];
  field: NpcBull[];
  entered: number[];
}

export interface RaceResult {
  name: string;
  owner: string;
  pos: number;
  prize: number;
  mine: boolean;
}

export interface BreedingState {
  a: Bull;
  b: Bull;
  done: number;
}

export interface GatherState {
  nodeId: string;
  start: number;
  dur: number;
  px: number;
  py: number;
}

export interface PlayerState {
  gold: number;
  mats: Materials;
  bulls: Bull[];
  items: GameItem[];
  nextBullId: number;
  nextItemId: number;
  stable: Stable;
  helpSeen: boolean;
  player: PlayerPosition;
  entered: number[];
  bet: ActiveBet | null;
  betAmount: number;
  breeding: BreedingState | null;
  breedSel: number[];
  forgeOre: number;
  forgeResult: string;
  listPrice: Record<MatType, number>;
  panel: PanelType;
  invOpen: boolean;
  equipTarget: number | null;
  toast: string;
  gather: GatherState | null;
  moveTarget: PlayerPosition | null;
  pending: PendingAction | null;
  race: RaceState | null;
  results: RaceResult[] | null;
  betResult: string | null;
  nextRace: number;
  interval: number;
  shopBulls: ShopBull[];
  myListings: MarketListing[];
}

export type PendingAction =
  | { type: 'gather'; node: WorldNode; x: number; y: number }
  | { type: 'stable' | 'bet' | 'market' | 'forge' | 'race'; x: number; y: number };

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  walletAddress?: string | null;
  hasDisplayName?: boolean;
  gold: number;
  mats: Materials;
  stable: Stable;
  helpSeen: boolean;
  position: PlayerPosition;
  bulls: Bull[];
  items: GameItem[];
  entered: number[];
  bet: ActiveBet | null;
  betAmount: number;
  breeding: BreedingState | null;
  breedSel: number[];
  forgeOre: number;
  listPrice: Record<MatType, number>;
  followingBullIds: number[];
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    walletAddress?: string | null;
    hasDisplayName?: boolean;
  };
}

export interface MeResponse extends UserProfile {
  race: {
    id: string;
    status: string;
    startAt: string;
    field: NpcBull[];
    entered: string[];
  } | null;
  marketListings: MarketListing[];
  shopBulls: ShopBull[];
}

export interface ChatMessage {
  id: string;
  displayName: string;
  text: string;
  at: number;
}

export interface SocketEvents {
  world_snapshot: {
    players: OtherPlayer[];
    nodes: { id: string; x: number; y: number; mat: MatType; deadUntil: number | null }[];
    race: { id: string; status: string; startAt: number; field: NpcBull[] } | null;
  };
  player_joined: OtherPlayer;
  player_left: { id: string };
  player_moved: { id: string; x: number; y: number };
  node_depleted: { id: string; deadUntil: number };
  node_respawned: { id: string };
  race_scheduled: { id: string; startAt: number; field: NpcBull[] };
  race_started: { id: string; bulls: RaceBull[]; startT: number; endT: number };
  race_standings: { id: string; standings: { pos: number; name: string; finished: boolean }[] };
  race_finished: { id: string; results: RaceResult[]; betResults: Record<string, string> };
  listing_created: MarketListing;
  listing_sold: { id: string; buyerId: string };
  chat_message: ChatMessage;
}
