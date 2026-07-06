import { RARITIES, COAT_COLORS, FORGE_MIN_ORE } from '../constants.js';
import type { GameItem, ItemSlot, RarityKey } from '../types.js';

export function forgeChances(ore: number): number[] {
  const o = Math.max(FORGE_MIN_ORE, ore);
  if (o <= FORGE_MIN_ORE) return [1, 0, 0, 0, 0];

  const extra = o - FORGE_MIN_ORE;
  const uncommon = Math.min(0.42, extra * 0.0035);
  const rare = Math.min(0.28, extra * 0.002);
  const epic = Math.min(0.14, extra * 0.001);
  const legendary = Math.min(0.10, extra * 0.0007);
  const common = Math.max(0.05, 1 - uncommon - rare - epic - legendary);
  const raw = [common, uncommon, rare, epic, legendary];
  const sum = raw.reduce((a, c) => a + c, 0);
  return raw.map((x) => x / sum);
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
