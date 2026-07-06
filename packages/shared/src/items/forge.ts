import { RARITIES, COAT_COLORS, FORGE_MIN_ORE, FORGE_MAX_ORE } from '../constants.js';
import type { GameItem, ItemSlot, RarityKey } from '../types.js';

/** [ore, common chance] — log-interpolated between anchors. */
const FORGE_COMMON_ANCHORS: [number, number][] = [
  [FORGE_MIN_ORE, 1.0],
  [500, 0.95],
  [1000, 0.88],
  [FORGE_MAX_ORE, 0.10],
];

/** How non-common odds split across Uncommon → Legendary. */
const FORGE_RARE_SPLIT = [0.50, 0.28, 0.15, 0.07] as const;

export function clampForgeOre(ore: number): number {
  return Math.min(FORGE_MAX_ORE, Math.max(FORGE_MIN_ORE, Math.round(ore)));
}

function forgeCommonChance(ore: number): number {
  const o = clampForgeOre(ore);
  if (o <= FORGE_COMMON_ANCHORS[0][0]) return FORGE_COMMON_ANCHORS[0][1];

  for (let i = 0; i < FORGE_COMMON_ANCHORS.length - 1; i++) {
    const [o0, c0] = FORGE_COMMON_ANCHORS[i];
    const [o1, c1] = FORGE_COMMON_ANCHORS[i + 1];
    if (o <= o1) {
      const t = (Math.log(o) - Math.log(o0)) / (Math.log(o1) - Math.log(o0));
      return c0 + t * (c1 - c0);
    }
  }
  return FORGE_COMMON_ANCHORS[FORGE_COMMON_ANCHORS.length - 1][1];
}

export function forgeChances(ore: number): number[] {
  const o = clampForgeOre(ore);
  if (o <= FORGE_MIN_ORE) return [1, 0, 0, 0, 0];

  const common = forgeCommonChance(o);
  const rem = 1 - common;
  const splitSum = FORGE_RARE_SPLIT.reduce((a, c) => a + c, 0);
  return [
    common,
    ...FORGE_RARE_SPLIT.map((w) => (rem * w) / splitSum),
  ];
}

export function rollRarityIndex(ore: number): number {
  const ch = forgeChances(ore);
  let roll = Math.random();
  let acc = 0;
  for (let i = 0; i < 5; i++) {
    acc += ch[i];
    if (roll < acc) return i;
  }
  return 0;
}

export function makeItem(rarIdx: number, nextItemId: number): GameItem {
  const slots: ItemSlot[] = ['coat', 'horns', 'hooves', 'tail', 'accessory'];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const rar = RARITIES[rarIdx];
  const adj: Record<RarityKey, string> = {
    Common: 'Plain',
    Uncommon: 'Sturdy',
    Rare: 'Polished',
    Epic: 'Enchanted',
    Legendary: 'Mythic',
  };
  const noun: Record<ItemSlot, string> = {
    coat: 'Coat',
    horns: 'Horns',
    hooves: 'Hooves',
    tail: 'Tail Wrap',
    accessory: 'Harness',
  };
  const bonusAmt = [0, 40, 70, 110, 160][rarIdx];
  const stats = ['speed', 'stamina', 'accel'] as const;
  return {
    id: nextItemId,
    slot,
    rarity: rar.k,
    rarityColor: rar.c,
    name: `${adj[rar.k]} ${noun[slot]}`,
    color: slot === 'coat' ? COAT_COLORS[Math.floor(Math.random() * COAT_COLORS.length)] : rar.c,
    bonus: bonusAmt > 0 ? { stat: stats[Math.floor(Math.random() * 3)], amt: bonusAmt } : null,
    equippedTo: null,
  };
}

import { SHOP_BULL_NAMES, SHOP_COATS, SHOP_SELLERS } from '../constants.js';
import type { ShopBull } from '../types.js';

export function makeShopBulls(): ShopBull[] {
  const r = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
  return [0, 1].map(() => {
    const b = {
      name: SHOP_BULL_NAMES[r(0, 7)],
      coat: SHOP_COATS[r(0, 5)],
      speed: r(4, 8),
      stamina: r(4, 8),
      accel: r(4, 8),
      temper: r(1, 8),
      seller: SHOP_SELLERS[r(0, 3)],
    };
    return { ...b, price: 200 + (b.speed + b.stamina + b.accel) * 15 };
  });
}
