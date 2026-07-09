import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useGameStore } from '../store/gameStore';
import { ChatPanel } from './ChatPanel';
import { ItemIcon } from './ItemIcon';
import { ProfilePopup } from './ProfilePopup';
import { GameGuide } from './GameGuide';
import { OnlineBadge } from './OnlineBadge';
import { useOnlineCount } from '../hooks/useOnlineCount';
import {
  MAT_SWATCHES,
  bullSlots,
  denCapacity,
  eff,
  coatOf,
  forgeChances,
  statCap,
  maxBullLevel,
  MARKET_LIST_QUANTITIES,
  MARKET_GOLD_QUANTITIES,
  MARKET_FEE,
  buildGoldListingMessage,
  buyerPaysTokens,
  materialListingTotal,
  stableWoodNeed,
  stableGoldNeed,
  energyPerMinute,
  fmtCountdown,
  fmtRaceCountdown,
  RARITIES,
  MAX_FOLLOWING_BULLS,
  PASTURE_PLOTS,
  PASTURE_WOOD_UPGRADE_COST,
  PASTURE_SPAWN_MS,
  pastureUpgradeGoldCost,
  BULL_RARITY_COLOR,
  BULL_RARITY_LABEL,
  inferBullRarity,
  BULL_MAX_ENERGY,
  FORGE_MIN_ORE,
  FORGE_MAX_ORE,
  clampForgeOre,
  BREED_COST,
  trainHayCost,
  bullBaseStat,
  bullItemBonus,
  itemBonusAmt,
  STORE_CATALOG,
  CHAR_STAT_LABEL,
  xpNeedForLevel,
  maxFollowingForLevel,
  MAX_CHAR_LEVEL,
  WHEEL_MIN_TOKENS,
  WHEEL_GOLD_TIERS,
} from '@bullrun/shared';
import type { Bull, BullRarity, CharStatType, ItemSlot, MatType, MeResponse, PastureDisplayBull, StatType } from '@bullrun/shared';
import { navigateToBuilding } from '../game/loop';
import { GoldIcon, HayIcon, OreIcon, WoodIcon } from './HudIcons';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { useGoldTokenBuy } from '../hooks/useGoldTokenBuy';
import { useRef } from 'react';
import { BRSfx } from '../lib/sfx';

const btn = 'br-btn';

const EQUIP_SLOTS: ItemSlot[] = ['coat', 'horns', 'hooves', 'tail', 'accessory'];
const SLOT_LABEL: Record<ItemSlot, string> = {
  coat: 'Coat',
  horns: 'Horns',
  hooves: 'Hooves',
  tail: 'Tail',
  accessory: 'Gear',
};
const panel = 'br-panel';

function bullRarity(bull: Bull): BullRarity {
  return inferBullRarity(bull.trait, bull.rarity);
}

function displayBullRarity(bull: PastureDisplayBull): BullRarity {
  return inferBullRarity(bull.trait, bull.rarity);
}

function PanelHeader({ title, color, onClose }: { title: string; color?: string; onClose: () => void }) {
  return (
    <div className="panel-header">
      <div className="panel-title" style={{ color: color || '#f2b23a' }}>{title}</div>
      <button className="close-btn" onClick={onClose}>✕</button>
    </div>
  );
}

function StablePanel() {
  const me = useGameStore((s) => s.me)!;
  const setMe = useGameStore((s) => s.setMe);
  const toast = useGameStore((s) => s.toastMsg);
  const setPanel = useGameStore((s) => s.setPanel);
  const setInvOpen = useGameStore((s) => s.setInvOpen);
  const setEquipTarget = useGameStore((s) => s.setEquipTarget);
  const slots = bullSlots(me.stable.level);
  const woodNeed = stableWoodNeed(me.stable.level);
  const goldNeed = stableGoldNeed(me.stable.level);
  const stableBulls = me.bulls.filter((b) => (b.location ?? 'stable') === 'stable');
  const readyToLevel = me.stable.wood >= woodNeed;
  const upgradeLabel = readyToLevel
    ? `Level up (${goldNeed}g)`
    : me.stable.wood + 10 >= woodNeed
      ? `Add 10 wood (+${goldNeed}g to level!)`
      : 'Add 10 wood';
  const followingBulls = me.bulls.filter((b) => me.followingBullIds?.includes(b.id));
  const followSlots = MAX_FOLLOWING_BULLS;

  const act = async (fn: () => Promise<MeResponse>, ok?: string) => {
    try { const r = await fn(); setMe(r); if (ok) toast(ok); }
    catch (e) { toast((e as Error).message); }
  };

  return (
    <div className={panel}>
      <PanelHeader title="Your Stable" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <div className="card">
          <div className="row-between">
            <span className="bold">Stable Level {me.stable.level}</span>
            <span className="muted">{energyPerMinute(me.stable.level).toFixed(1)} energy/min regen</span>
          </div>
          <div className="bar"><div className="bar-fill wood" style={{ width: `${Math.min(100, me.stable.wood / woodNeed * 100)}%` }} /></div>
          <div className="row-between">
            <span className="muted">
              Wood {me.stable.wood} / {woodNeed}
              {readyToLevel ? ` · ${goldNeed}g to level up` : ''}
              {' · '}{stableBulls.length}/{slots} bull slots
            </span>
            <button className={`${btn} green`} onClick={() => act(api.upgradeStable)}>{upgradeLabel}</button>
          </div>
        </div>
        {stableBulls.map((b) => (
          <BullCard key={b.id} bull={b} items={me.items}
            onTrain={(stat) => act(() => api.train(b.id, stat))}
            onRename={() => { const n = prompt('Rename ' + b.name, b.name); if (n?.trim()) act(() => api.rename(b.id, n.trim())); }}
            onEquip={() => { setEquipTarget(b.id); setInvOpen(true); }}
            onFollow={followingBulls.length < followSlots ? () => act(() => api.followBull(b.id), `${b.name} is following you`) : undefined}
            onDelete={() => { if (confirm(`Release ${b.name}?`)) act(() => api.deleteBull(b.id)); }}
          />
        ))}
        {followingBulls.length > 0 && (
          <div className="card">
            <div className="bold">Following you ({followingBulls.length}/{followSlots})</div>
            {followingBulls.map((b) => (
              <div key={b.id} className="row-between" style={{ marginTop: 8 }}>
                <span>{b.name}</span>
                <button className={`${btn} sm blue`} onClick={() => act(() => api.depositBullStable(b.id), `${b.name} sent to stable`)}>To stable</button>
              </div>
            ))}
          </div>
        )}
        <div className="card row-between">
          <div>
            <div className="bold">Breeding</div>
            <div className="muted">
              {me.breeding
                ? `Calf in ${fmtCountdown(me.breeding.done - Date.now())}`
                : me.breedSel.length
                  ? `Selected: ${me.breedSel.join('+')}`
                  : 'Select two stable bulls above'}
            </div>
          </div>
          <button className={`${btn} purple`} disabled={!!me.breeding} onClick={() => {
            if (me.breedSel.length !== 2) return toast('Select exactly two bulls');
            act(() => api.breed(me.breedSel[0], me.breedSel[1]), 'Breeding started');
          }}>Breed ({BREED_COST}g)</button>
        </div>
      </div>
    </div>
  );
}

function BullCard({ bull, items, onTrain, onRename, onEquip, onFollow, onDelete }: {
  bull: Bull; items: import('@bullrun/shared').GameItem[];
  onTrain: (s: StatType) => void; onRename: () => void; onEquip: () => void;
  onFollow?: () => void; onDelete?: () => void;
}) {
  const cap = statCap(bull);
  const rarity = bullRarity(bull);
  const maxLv = maxBullLevel(rarity);
  const equipped = items.filter((it) => it.equippedTo === bull.id);
  const setMe = useGameStore((s) => s.setMe);
  const toggleBreed = () => {
    const me = useGameStore.getState().me;
    if (!me) return;
    const sel = [...me.breedSel];
    const i = sel.indexOf(bull.id);
    if (i >= 0) sel.splice(i, 1);
    else { sel.push(bull.id); if (sel.length > 2) sel.shift(); }
    api.settings({ breedSel: sel }).then(setMe).catch(() => {});
  };

  return (
    <div className="card">
      <div className="row-between">
        <div className="row gap">
          <span className="swatch" style={{ background: BULL_RARITY_COLOR[rarity] }} />
          <span className="bold lg">{bull.name}</span>
          <span className="badge" style={{ color: BULL_RARITY_COLOR[rarity] }}>{BULL_RARITY_LABEL[rarity]}</span>
          <span className="badge">Lv {bull.level}/{maxLv}</span>
        </div>
        <button className="small-btn" onClick={onRename}>Rename</button>
      </div>
      <div className="bar-row">
        <div className="bar flex1"><div className="bar-fill energy" style={{ width: `${bull.energy}%` }} /></div>
        <span>{Math.round(bull.energy)}/{BULL_MAX_ENERGY} energy</span>
        <span className="muted">XP {Math.round(bull.xp)}/{bull.level * 100}</span>
      </div>
      {(['speed', 'stamina', 'accel'] as StatType[]).map((stat) => {
        const base = Math.round(bullBaseStat(bull, stat));
        const itemBonus = Math.round(bullItemBonus(bull, stat, items));
        const total = base + itemBonus;
        const trainCost = trainHayCost(bull.level);
        const capped = base >= cap;
        return (
        <div key={stat} className="grid-train">
          <span>
            {stat}{' '}
            <b className="gold stat-num">{base} / {cap}</b>
            {itemBonus > 0 && <span className="blue sm"> (+{itemBonus} gear → {total})</span>}
          </span>
          <button className="small-btn" disabled={capped} onClick={() => onTrain(stat)}>
            Train · {trainCost} hay
          </button>
        </div>
        );
      })}
      <div className="equip-slots">
        {EQUIP_SLOTS.map((slot) => {
          const item = equipped.find((e) => e.slot === slot);
          return (
            <div key={slot} className={`equip-slot${item ? ' filled' : ''}`} title={item?.name ?? `Empty ${SLOT_LABEL[slot]} slot`}>
              <span className="equip-slot-label">{SLOT_LABEL[slot]}</span>
              {item ? (
                <>
                  <ItemIcon slot={item.slot} rarity={item.rarity} size={34} />
                  <span className="equip-slot-name">{item.name}</span>
                  {item.bonus && (
                    <span className="muted sm">+{itemBonusAmt(item.bonus.amt)} {item.bonus.stat}</span>
                  )}
                </>
              ) : (
                <span className="muted sm">empty</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="row gap wrap">
        <button className={`${btn} blue sm`} onClick={onEquip}>Equip items</button>
        <button className={`${btn} sm`} onClick={toggleBreed}>Select to breed</button>
        {onFollow && <button className={`${btn} green sm`} onClick={onFollow}>Follow me</button>}
        {onDelete && <button className={`${btn} sm`} style={{ color: '#e55' }} onClick={onDelete}>Release</button>}
      </div>
    </div>
  );
}

function DenPanel() {
  const me = useGameStore((s) => s.me)!;
  const denPlotId = useGameStore((s) => s.denPlotId);
  const pastures = useGameStore((s) => s.pastures);
  const setMe = useGameStore((s) => s.setMe);
  const setPastures = useGameStore((s) => s.setPastures);
  const setPanel = useGameStore((s) => s.setPanel);
  const toast = useGameStore((s) => s.toastMsg);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (denPlotId == null) return null;
  const plot = pastures.find((p) => p.id === denPlotId);
  const def = PASTURE_PLOTS.find((p) => p.id === denPlotId);
  if (!plot || !def) return null;

  const isOwner = plot.ownerId === me.id;
  const denBulls = isOwner
    ? me.bulls.filter((b) => b.location === 'den' && b.denPlotId === denPlotId)
    : (plot.denBulls ?? []);
  const followingBulls = me.bulls.filter((b) => me.followingBullIds?.includes(b.id));
  const stableBulls = me.bulls.filter((b) => (b.location ?? 'stable') === 'stable');
  const cap = plot.denCapacity ?? denCapacity(plot.level);
  const followSlots = MAX_FOLLOWING_BULLS;
  const spawnCd = plot.nextSpawnAt ? fmtCountdown(plot.nextSpawnAt - Date.now()) : fmtCountdown(PASTURE_SPAWN_MS);
  const upGold = pastureUpgradeGoldCost(plot.level);

  const act = async (fn: () => Promise<MeResponse>, ok?: string) => {
    try { const r = await fn(); setMe(r); if (ok) toast(ok); }
    catch (e) { toast((e as Error).message); }
  };

  const actDen = async (fn: () => Promise<{ me: MeResponse; pastures: typeof pastures }>, ok?: string) => {
    try {
      const r = await fn();
      setMe(r.me);
      setPastures(r.pastures);
      if (ok) toast(ok);
    } catch (e) { toast((e as Error).message); }
  };

  const panelTitle = isOwner ? def.label : `${def.label} · ${plot.ownerName ?? 'Player'}`;

  return (
    <div className={panel}>
      <PanelHeader title={panelTitle} color="#8bc34a" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <div className="card">
          <div className="row-between">
            <span className="bold">Den Level {plot.level}</span>
            <span className="muted">{denBulls.length}/{cap} bulls{isOwner ? ` · next spawn ${spawnCd}` : ''}</span>
          </div>
          {isOwner ? (
            <div className="row-between">
              <span className="muted">Upgrade: {PASTURE_WOOD_UPGRADE_COST} wood + {upGold}g</span>
              <button className={`${btn} green`} onClick={() => actDen(() => api.upgradePasture(denPlotId), 'Den upgraded!')}>Upgrade den</button>
            </div>
          ) : (
            <div className="muted sm">Viewing {plot.ownerName ?? 'another player'}&apos;s bulls</div>
          )}
        </div>

        {denBulls.length === 0 && (
          <div className="card muted">No bulls in this den yet.</div>
        )}

        {denBulls.map((b) => {
          const rarity = isOwner ? bullRarity(b as Bull) : displayBullRarity(b as PastureDisplayBull);
          const viewBull = b as PastureDisplayBull;
          return (
          <div key={b.id} className="card">
            <div className="row-between">
              <div className="row gap">
                <span className="swatch" style={{ background: BULL_RARITY_COLOR[rarity] }} />
                <span className="bold">{b.name}</span>
                <span className="badge" style={{ color: BULL_RARITY_COLOR[rarity] }}>{BULL_RARITY_LABEL[rarity]}</span>
              </div>
              {isOwner ? (
                <div className="row gap">
                  {followingBulls.length < followSlots && (
                    <button className={`${btn} green sm`} onClick={() => act(() => api.followBull(b.id), `${b.name} is following you`)}>Follow me</button>
                  )}
                  <button className={`${btn} sm`} style={{ color: '#e55' }} onClick={() => { if (confirm(`Release ${b.name}?`)) act(() => api.deleteBull(b.id)); }}>Release</button>
                </div>
              ) : (
                <span className="muted sm">Lv {viewBull.level ?? 1}</span>
              )}
            </div>
            {!isOwner && (
              <div className="muted sm" style={{ marginTop: 6 }}>
                SPD {viewBull.speed ?? '—'} · STA {viewBull.stamina ?? '—'} · ACC {viewBull.accel ?? '—'}
              </div>
            )}
          </div>
          );
        })}

        {isOwner && followingBulls.length > 0 && (
          <div className="card">
            <div className="bold">Following you ({followingBulls.length}/{followSlots})</div>
            {followingBulls.map((b) => (
              <div key={b.id} className="row-between" style={{ marginTop: 8 }}>
                <span>{b.name}</span>
                <div className="row gap">
                  {denBulls.length < cap && (
                    <button className={`${btn} sm green`} onClick={() => actDen(() => api.depositBullDen(b.id, denPlotId), `${b.name} sent to den`)}>To den</button>
                  )}
                  <button className={`${btn} sm blue`} onClick={() => act(() => api.depositBullStable(b.id), `${b.name} sent to stable`)}>To stable</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isOwner && stableBulls.length > 0 && denBulls.length < cap && (
          <div className="card">
            <div className="bold">From stable</div>
            {stableBulls.map((b) => (
              <div key={b.id} className="row-between" style={{ marginTop: 8 }}>
                <span>{b.name}</span>
                <button className={`${btn} sm green`} onClick={() => actDen(() => api.depositBullDen(b.id, denPlotId), `${b.name} moved to den`)}>Move to den</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RacePanel() {
  const me = useGameStore((s) => s.me)!;
  const setPanel = useGameStore((s) => s.setPanel);
  const setMe = useGameStore((s) => s.setMe);
  const toast = useGameStore((s) => s.toastMsg);
  const raceLive = useGameStore((s) => s.raceLive);
  const followingBulls = me.bulls.filter((b) => me.followingBullIds?.includes(b.id));
  const cd = me.race ? fmtRaceCountdown(new Date(me.race.startAt).getTime()) : '—';
  const alreadyEntered = me.entered.length > 0;

  return (
    <div className={panel}>
      <PanelHeader title="Race Signup" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <div className="card center">
          <div className="muted">NEXT RACE IN</div>
          <div className="countdown">{raceLive ? 'LIVE' : cd}</div>
          <div className="muted">Entry: {BULL_MAX_ENERGY} energy · Free · Purse 1000g · Player bulls only</div>
        </div>
        {followingBulls.length === 0 ? (
          <div className="card muted">Bring a bull with you first — use &quot;Follow me&quot; in your stable or den.</div>
        ) : (
          followingBulls.map((b) => (
            <div key={b.id} className="card row-between">
              <div>
                <span className="bold">{b.name}</span>
                <div className="muted sm">SPD {eff(b, 'speed', me.items)} · STA {eff(b, 'stamina', me.items)} · ACC {eff(b, 'accel', me.items)} · {Math.round(b.energy)} energy</div>
              </div>
              {me.entered.includes(b.id) ? (
                <span className="entered">Entered ✓</span>
              ) : alreadyEntered ? (
                <span className="muted sm">Already entered another bull</span>
              ) : b.energy < BULL_MAX_ENERGY ? (
                <span className="muted sm">Need {BULL_MAX_ENERGY} energy</span>
              ) : (
                <button className={`${btn} gold`} onClick={() => api.enterRace(b.id, me.position.x, me.position.y).then(setMe).catch((e) => toast(e.message))}>Enter race</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BetPanel() {
  const me = useGameStore((s) => s.me)!;
  const setPanel = useGameStore((s) => s.setPanel);
  const setMe = useGameStore((s) => s.setMe);
  const toast = useGameStore((s) => s.toastMsg);
  const [field, setField] = useState<Array<{ id: number | string; name: string; owner?: string; coat: string; speed: number; stamina: number; accel: number }>>([]);
  const [oddsArr, setOddsArr] = useState<number[]>([]);

  useEffect(() => {
    api.raceOdds().then((r) => {
      setField(r.field as typeof field);
      setOddsArr(r.odds);
    }).catch(() => {});
  }, []);

  return (
    <div className={panel}>
      <PanelHeader title="Betting Booth" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <div className="card row-between">
          <span className="bold">Bet amount</span>
          <div className="row gap">
            <button className="small-btn" onClick={() => api.settings({ betAmount: Math.max(25, me.betAmount - 25) }).then(setMe)}>−</button>
            <span className="gold lg">{me.betAmount}g</span>
            <button className="small-btn" onClick={() => api.settings({ betAmount: Math.min(500, me.betAmount + 25) }).then(setMe)}>+</button>
          </div>
        </div>
        {me.bet && <div className="card green-txt">Active bet: {me.bet.amount}g on {me.bet.name} @ {me.bet.odds.toFixed(1)}×</div>}
        {field.map((e, i) => (
          <div key={String(e.id)} className="card row-between">
            <div>
              <span className="bold">{e.name}</span> <span className="muted sm">{e.owner}</span>
              <div className="muted sm">SPD {e.speed} · STA {e.stamina}</div>
            </div>
            <div className="row gap">
              <span className="gold bold">{(oddsArr[i] ?? 0).toFixed(1)}×</span>
              <button className={`${btn} green`} onClick={() => api.placeBet(String(e.id), e.name, me.betAmount, oddsArr[i], me.position.x, me.position.y).then(setMe).catch((err) => toast(err.message))}>Bet</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CancelCountdown({ until }: { until?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until || until <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [until]);
  if (!until || until <= now) return null;
  const secs = Math.ceil((until - now) / 1000);
  return <span className="muted sm"> · returns in {secs}s</span>;
}

function MarketPanel() {
  const me = useGameStore((s) => s.me)!;
  const walletAddress = useGameStore((s) => s.walletAddress);
  const setPanel = useGameStore((s) => s.setPanel);
  const setMe = useGameStore((s) => s.setMe);
  const toast = useGameStore((s) => s.toastMsg);
  const { signMessage } = useWallet();
  const { phase: buyPhase, message: buyMsg, error: buyErr, buyGoldListing } = useGoldTokenBuy();
  const [bullPrice, setBullPrice] = useState(5);
  const [tokenPrice, setTokenPrice] = useState('10');
  const [itemPrice, setItemPrice] = useState(100);
  const [listLoading, setListLoading] = useState(false);

  const mats: MatType[] = ['hay', 'ore', 'wood'];
  const stableBulls = me.bulls.filter((b) => (b.location ?? 'stable') === 'stable');
  const myBullListing = me.marketListings?.find((l) => l.sellerId === me.id && l.type === 'bull' && l.status === 'open');
  const myGoldListing = me.marketListings?.find((l) => l.sellerId === me.id && l.type === 'gold' && (l.status === 'open' || l.status === 'reserved' || l.status === 'cancelling'));

  useEffect(() => {
    if (myGoldListing?.status !== 'cancelling') return;
    const id = setInterval(() => {
      api.me().then(setMe).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [myGoldListing?.status, myGoldListing?.id, setMe]);

  const myMaterialListings = me.marketListings?.filter((l) => l.sellerId === me.id && l.type === 'material' && l.status === 'open') ?? [];

  const cancelGold = async (listingId: string) => {
    try {
      const res = await api.cancelGoldListing(listingId);
      if (res.status === 'cancelling') {
        toast('Gold listing cancelling — 30s wait before gold returns');
      }
      setMe(await api.me());
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const listingLabel = (l: (typeof me.marketListings)[0]) => {
    if (l.type === 'gold') {
      return `${l.qty?.toLocaleString()} gold — ${l.sellerName}`;
    }
    if (l.type === 'bull' && l.bull) {
      return `${l.bull.name} Lv${l.bull.level ?? 1} — ${l.sellerName}`;
    }
    if (l.type === 'item' && l.item) {
      return `${l.item.name} (${l.item.rarity}) — ${l.sellerName}`;
    }
    return `${l.qty} ${l.mat} — ${l.sellerName}`;
  };

  const listGold = async (goldQty: number) => {
    const price = Number(tokenPrice);
    if (!price || price <= 0) {
      toast('Enter a valid token price');
      return;
    }
    if (!walletAddress || !signMessage) {
      toast('Connect wallet to list gold for tokens');
      return;
    }
    setListLoading(true);
    try {
      const rounded = Math.round(price * 1e6) / 1e6;
      const message = buildGoldListingMessage({ wallet: walletAddress, goldQty, tokenPrice: rounded });
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(sigBytes);
      const res = await api.listGold(goldQty, rounded, signature, message);
      setMe(res.me);
      toast(`Listed ${goldQty}g for ${rounded} tokens`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setListLoading(false);
    }
  };

  const buyGold = async (listingId: string) => {
    const res = await buyGoldListing(listingId);
    if (res.success && res.me) {
      setMe(res.me);
      toast('Gold purchased with tokens!');
    } else if (!res.success) {
      toast(res.error);
    }
  };

  return (
    <div className={panel}>
      <PanelHeader title="Player Market" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <div className="muted sm">LIST BULLS · ONE PER PLAYER · 5% FEE ON SALE</div>
        {myBullListing ? (
          <div className="card">
            <div className="row-between">
              <div>
                <span className="bold">Your listing</span>
                <div className="muted sm">
                  {myBullListing.bull?.name} Lv{myBullListing.bull?.level ?? 1} · {myBullListing.price}g
                </div>
              </div>
              <button
                className={`${btn} sm`}
                onClick={() => api.cancelBullListing(myBullListing.id).then(setMe).catch((e) => toast(e.message))}
              >
                Cancel listing
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="card row-between">
              <span className="muted">Sale price</span>
              <div className="row gap">
                <button className="small-btn" onClick={() => setBullPrice((p) => Math.max(1, p - 1))}>−</button>
                <span className="gold stat-num">{bullPrice}g</span>
                <button className="small-btn" onClick={() => setBullPrice((p) => p + 1)}>+</button>
              </div>
            </div>
            {stableBulls.length === 0 ? (
              <div className="card muted sm">No bulls in stable to list.</div>
            ) : (
              stableBulls.map((b) => {
                const rarity = bullRarity(b);
                return (
                  <div key={b.id} className="card row-between">
                    <div className="row gap">
                      <span className="swatch" style={{ background: BULL_RARITY_COLOR[rarity] }} />
                      <div>
                        <span className="bold">{b.name}</span>
                        <div className="muted sm">
                          Lv{b.level} · SPD {eff(b, 'speed', me.items)} · STA {eff(b, 'stamina', me.items)}
                        </div>
                      </div>
                    </div>
                    <button
                      className={`${btn} green sm`}
                      onClick={() => api.listBull(b.id, bullPrice).then(setMe).catch((e) => toast(e.message))}
                    >
                      List {bullPrice}g
                    </button>
                  </div>
                );
              })
            )}
          </>
        )}

        <div className="muted sm" style={{ marginTop: 12 }}>SELL GOLD FOR TOKENS · 5% FEE PAID BY BUYER</div>
        {!walletAddress ? (
          <div className="card muted sm">Connect your wallet in Profile to sell gold for tokens.</div>
        ) : myGoldListing ? (
          <div className="card">
            <div className="row-between">
              <div>
                <span className="bold">Your gold listing</span>
                <div className="muted sm">
                  {myGoldListing.qty?.toLocaleString()}g · {myGoldListing.tokenPrice} tokens
                  {myGoldListing.status === 'reserved' ? ' · buyer checking out' : ''}
                  {myGoldListing.status === 'cancelling' ? ' · cancelling' : ''}
                  <CancelCountdown until={myGoldListing.cooldownUntil} />
                </div>
                {myGoldListing.status !== 'cancelling' && (
                  <div className="muted sm">Cancel takes 30s — protects buyers mid-purchase</div>
                )}
              </div>
              <button
                className={`${btn} sm`}
                disabled={myGoldListing.status === 'cancelling'}
                onClick={() => cancelGold(myGoldListing.id)}
              >
                {myGoldListing.status === 'cancelling' ? 'Cancelling…' : 'Cancel listing'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="muted">Token price (you receive)</span>
              <input
                className="market-token-input"
                type="number"
                min={0}
                step="0.01"
                value={tokenPrice}
                onChange={(e) => setTokenPrice(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="muted sm" style={{ marginBottom: 8 }}>
              Buyer pays {Number(tokenPrice) > 0 ? buyerPaysTokens(Number(tokenPrice)).toLocaleString() : '—'} tokens (incl. {Math.round(MARKET_FEE * 100)}% fee)
            </div>
            <div className="row gap wrap">
              {MARKET_GOLD_QUANTITIES.map((qty) => (
                <button
                  key={qty}
                  className={`${btn} gold sm`}
                  disabled={me.gold < qty || listLoading}
                  onClick={() => listGold(qty)}
                >
                  List {qty}g
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="muted sm" style={{ marginTop: 12 }}>SELL GEAR & CLOTHING · 5% FEE ON SALE</div>
        {(() => {
          const loose = me.items.filter((it) => !it.equippedTo && !it.equipped);
          if (!loose.length) return <div className="card muted sm">No unequipped items to sell.</div>;
          return (
            <>
              <div className="card row-between">
                <span className="muted">Sale price</span>
                <div className="row gap">
                  <button className="small-btn" onClick={() => setItemPrice((p) => Math.max(1, p - 25))}>−</button>
                  <span className="gold stat-num">{itemPrice}g</span>
                  <button className="small-btn" onClick={() => setItemPrice((p) => p + 25)}>+</button>
                </div>
              </div>
              {loose.map((it) => (
                <div key={it.id} className="card row-between">
                  <div className="row gap">
                    <ItemIcon slot={it.slot} rarity={it.rarity} color={it.color} size={34} />
                    <div>
                      <span style={{ color: it.rarityColor }} className="bold sm">{it.name}</span>
                      <div className="muted sm">{it.kind === 'char' ? 'clothing' : 'bull gear'} · {it.rarity}</div>
                    </div>
                  </div>
                  <button
                    className={`${btn} green sm`}
                    onClick={() => api.listItem(it.id, itemPrice).then(setMe).catch((e) => toast(e.message))}
                  >
                    List {itemPrice}g
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        <div className="muted sm" style={{ marginTop: 12 }}>LIST MATERIALS · GOLD PER 100 UNITS</div>
        {mats.map((m) => (
          <div key={m} className="card">
            <div className="row-between">
              <div className="row gap"><span className="swatch" style={{ background: MAT_SWATCHES[m] }} /><span className="bold">{m}</span> ×{me.mats[m]}</div>
              <div className="row gap">
                <button className="small-btn" onClick={() => api.settings({ listPrice: { ...me.listPrice, [m]: Math.max(1, me.listPrice[m] - 1) } }).then(setMe)}>−</button>
                <span className="gold stat-num">{me.listPrice[m]}g/100</span>
                <button className="small-btn" onClick={() => api.settings({ listPrice: { ...me.listPrice, [m]: me.listPrice[m] + 1 } }).then(setMe)}>+</button>
              </div>
            </div>
            <div className="row gap wrap" style={{ marginTop: 8 }}>
              {MARKET_LIST_QUANTITIES.map((qty) => (
                <button
                  key={qty}
                  className={`${btn} green sm`}
                  disabled={me.mats[m] < qty}
                  onClick={() => api.listMaterial(m, me.listPrice[m], qty).then(setMe).catch((e) => toast(e.message))}
                >
                  List {qty} · {materialListingTotal(me.listPrice[m], qty)}g
                </button>
              ))}
            </div>
          </div>
        ))}
        {myMaterialListings.length > 0 && (
          <>
            <div className="muted sm" style={{ marginTop: 12 }}>YOUR MATERIAL LISTINGS</div>
            {myMaterialListings.map((l) => (
              <div key={l.id} className="card row-between">
                <div>
                  <span className="bold">{l.qty} {l.mat}</span>
                  <div className="muted sm">{l.price}g total</div>
                </div>
                <button
                  className={`${btn} sm`}
                  onClick={() => api.cancelMaterialListing(l.id).then(setMe).catch((e) => toast(e.message))}
                >
                  Cancel listing
                </button>
              </div>
            ))}
          </>
        )}
        {me.marketListings?.length ? (
          <>
            <div className="muted sm">OPEN LISTINGS</div>
            {me.marketListings.map((l) => (
              <div key={l.id} className="card row-between">
                <span>
                  {listingLabel(l)}
                  {l.type === 'gold'
                    ? ` @ ${l.tokenPrice} tokens`
                    : ` @ ${l.price}g`}
                </span>
                {l.sellerId === me.id ? (
                  l.type === 'material' ? (
                    <button
                      className={`${btn} sm`}
                      onClick={() => api.cancelMaterialListing(l.id).then(setMe).catch((e) => toast(e.message))}
                    >
                      Cancel
                    </button>
                  ) : l.type === 'bull' ? (
                    <button
                      className={`${btn} sm`}
                      onClick={() => api.cancelBullListing(l.id).then(setMe).catch((e) => toast(e.message))}
                    >
                      Cancel
                    </button>
                  ) : l.type === 'item' ? (
                    <button
                      className={`${btn} sm`}
                      onClick={() => api.cancelItemListing(l.id).then(setMe).catch((e) => toast(e.message))}
                    >
                      Cancel
                    </button>
                  ) : (
                    <span className="muted sm">Yours</span>
                  )
                ) : l.type === 'gold' ? (
                  <button
                    className={`${btn} gold sm`}
                    disabled={!walletAddress || (buyPhase !== 'idle' && buyPhase !== 'error')}
                    title={!walletAddress ? 'Connect your wallet in Profile' : undefined}
                    onClick={() => buyGold(l.id)}
                  >
                    {buyPhase !== 'idle' && buyPhase !== 'error' ? buyMsg || '…' : `Buy ${buyerPaysTokens(l.tokenPrice ?? 0)} tok`}
                  </button>
                ) : (
                  <button className={`${btn} gold sm`} onClick={() => api.buyListing(l.id).then(setMe).catch((e) => toast(e.message))}>Buy {l.price}g</button>
                )}
              </div>
            ))}
            {buyErr && <div className="error sm">{buyErr}</div>}
          </>
        ) : (
          <div className="muted sm">No open listings yet — be the first to sell.</div>
        )}
      </div>
    </div>
  );
}

function ForgePanel() {
  const me = useGameStore((s) => s.me)!;
  const setPanel = useGameStore((s) => s.setPanel);
  const setMe = useGameStore((s) => s.setMe);
  const forgeResult = useGameStore((s) => s.forgeResult);
  const setForgeResult = useGameStore((s) => s.setForgeResult);
  const toast = useGameStore((s) => s.toastMsg);
  const chances = forgeChances(me.forgeOre);

  return (
    <div className={panel}>
      <PanelHeader title="The Forge" color="#e07840" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <p className="muted">Feed ore into the forge ({FORGE_MIN_ORE}–{FORGE_MAX_ORE.toLocaleString()}). 100 ore = 100% Common · 500 ≈95% · 1,000 ≈88% · 10,000 ≈10%.</p>
        <div className="card">
          <div className="row-between">
            <span>Ore (have {me.mats.ore})</span>
            <div className="row gap">
              <button className="small-btn" onClick={() => api.settings({ forgeOre: clampForgeOre(me.forgeOre - 10) }).then(setMe)}>−</button>
              <span className="orange lg">{me.forgeOre}</span>
              <button className="small-btn" onClick={() => api.settings({ forgeOre: clampForgeOre(me.forgeOre + 10) }).then(setMe)}>+</button>
            </div>
          </div>
          {RARITIES.map((r, i) => (
            <div key={r.k} className="chance-row">
              <span style={{ color: r.c, width: 74 }}>{r.k}</span>
              <div className="bar flex1"><div className="bar-fill" style={{ width: `${chances[i] * 100}%`, background: r.c }} /></div>
              <span className="muted">{(chances[i] * 100).toFixed(chances[i] < 0.1 ? 1 : 0)}%</span>
            </div>
          ))}
          <button className={`${btn} orange`} onClick={() => api.forge(me.forgeOre).then((r) => {
            setMe(r.me);
            setForgeResult(`🔨 Forged: ${r.item.name} (${r.item.rarity})`);
            toast(`Forged ${r.item.rarity}!`);
          }).catch((e) => toast(e.message))}>Forge it 🔨</button>
        </div>
        {forgeResult && <div className="card green-txt">{forgeResult}</div>}
      </div>
    </div>
  );
}

function InventoryPopup() {
  const me = useGameStore((s) => s.me)!;
  const invOpen = useGameStore((s) => s.invOpen);
  const equipTarget = useGameStore((s) => s.equipTarget);
  const setInvOpen = useGameStore((s) => s.setInvOpen);
  const setMe = useGameStore((s) => s.setMe);
  const toast = useGameStore((s) => s.toastMsg);
  if (!invOpen) return null;

  const target = me.bulls.find((b) => b.id === equipTarget) || me.bulls[0];
  const equippedOnTarget = target ? me.items.filter((it) => it.equippedTo === target.id) : [];
  const items = me.items.filter((it) => (it.kind ?? 'bull') !== 'char' && !it.equippedTo);
  const worn = me.items.filter((it) => it.kind === 'char' && it.equipped);
  const wardrobe = me.items.filter((it) => it.kind === 'char' && !it.equipped);

  return (
    <div className="inv-popup">
      <div className="row-between">
        <span className="bold blue">Inventory</span>
        <button className="close-btn" onClick={() => setInvOpen(false)}>✕</button>
      </div>
      <div className="muted sm">Equipping to: <b>{target?.name}</b></div>
      {target && equippedOnTarget.length > 0 && (
        <div className="card">
          <div className="bold sm">Worn by {target.name}</div>
          {equippedOnTarget.map((it) => (
            <div key={it.id} className="row-between" style={{ marginTop: 6 }}>
              <div className="row gap">
                <ItemIcon slot={it.slot} rarity={it.rarity} color={it.color} size={34} />
                <span style={{ color: it.rarityColor }} className="bold sm">{it.name}</span>
                <span className="muted sm">{it.slot}</span>
              </div>
              <button className="small-btn" onClick={() => api.unequip(it.id).then(setMe).catch((e) => toast(e.message))}>Remove</button>
            </div>
          ))}
        </div>
      )}
      {(worn.length > 0 || wardrobe.length > 0) && (
        <div className="card">
          <div className="bold sm">Your outfit</div>
          {worn.map((it) => (
            <div key={it.id} className="row-between" style={{ marginTop: 6 }}>
              <div className="row gap">
                <ItemIcon slot={it.slot} rarity={it.rarity} color={it.color} size={34} />
                <div>
                  <span style={{ color: it.rarityColor }} className="bold sm">{it.name}</span>
                  <div className="muted sm">
                    {it.slot}{it.bonus ? ` · +${it.bonus.amt}% ${CHAR_STAT_LABEL[it.bonus.stat as CharStatType] ?? it.bonus.stat}` : ''}
                  </div>
                </div>
              </div>
              <button className="small-btn" onClick={() => api.unequipChar(it.id).then(setMe).catch((e) => toast(e.message))}>Take off</button>
            </div>
          ))}
          {wardrobe.map((it) => (
            <div key={it.id} className="row-between" style={{ marginTop: 6 }}>
              <div className="row gap">
                <ItemIcon slot={it.slot} rarity={it.rarity} color={it.color} size={34} />
                <div>
                  <span style={{ color: it.rarityColor }} className="bold sm">{it.name}</span>
                  <div className="muted sm">
                    {it.slot}{it.bonus ? ` · +${it.bonus.amt}% ${CHAR_STAT_LABEL[it.bonus.stat as CharStatType] ?? it.bonus.stat}` : ''}
                  </div>
                </div>
              </div>
              <button className={`${btn} green sm`} onClick={() => api.equipChar(it.id).then(setMe).catch((e) => toast(e.message))}>Wear</button>
            </div>
          ))}
        </div>
      )}
      <div className="bold sm">Bag</div>
      {items.length === 0 && <div className="muted center">No loose items — forge some ore!</div>}
      {items.map((it) => (
        <div key={it.id} className="card row-between">
          <div className="row gap">
            <ItemIcon slot={it.slot} rarity={it.rarity} />
            <div>
              <span style={{ color: it.rarityColor }} className="bold">{it.name}</span>
              <div className="muted sm">{it.slot} · {it.rarity}</div>
            </div>
          </div>
          <button className={`${btn} green sm`} onClick={() => target && api.equip(it.id, target.id).then(setMe).catch((e) => toast(e.message))}>Equip</button>
        </div>
      ))}
    </div>
  );
}

function StorePanel() {
  const me = useGameStore((s) => s.me)!;
  const setPanel = useGameStore((s) => s.setPanel);
  const setMe = useGameStore((s) => s.setMe);
  const toast = useGameStore((s) => s.toastMsg);

  return (
    <div className={panel}>
      <PanelHeader title="General Store" color="#7dc24f" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <p className="muted">Clothing for your rancher — walk faster, gather quicker. Wear it from Items.</p>
        {STORE_CATALOG.map((d) => (
          <div key={d.sku} className="card row-between">
            <div className="row gap">
              <ItemIcon slot={d.slot} rarity={d.rarity} color={d.color} />
              <div>
                <span className="bold" style={{ color: RARITIES.find((r) => r.k === d.rarity)?.c }}>{d.name}</span>
                <div className="muted sm">
                  {d.slot} · {d.rarity} · +{d.bonus.amt}% {CHAR_STAT_LABEL[d.bonus.stat]}
                </div>
              </div>
            </div>
            <button
              className={`${btn} gold sm`}
              disabled={me.gold < d.price}
              onClick={() => api.buyStoreItem(d.sku).then((m) => { setMe(m); toast(`Bought ${d.name}!`); BRSfx.coin(); }).catch((e) => toast(e.message))}
            >
              Buy {d.price}g
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const WHEEL_SEGS = [...WHEEL_GOLD_TIERS.map((t) => t.label), 'JACKPOT'];
const WHEEL_SEG_COLORS = ['#c9573f', '#3b6ea5', '#7dc24f', '#e07840', '#f2b23a'];

function drawFortuneWheel(canvas: HTMLCanvasElement, rot: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const size = 280;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2 + 6;
  const R = 118;
  const n = WHEEL_SEGS.length;
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i * Math.PI * 2) / n;
    const a1 = rot + ((i + 1) * Math.PI * 2) / n;
    ctx.fillStyle = WHEEL_SEG_COLORS[i % WHEEL_SEG_COLORS.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a0, a1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(23,16,10,.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const mid = (a0 + a1) / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * R * 0.62, cy + Math.sin(mid) * R * 0.62);
    ctx.rotate(mid + (Math.cos(mid) < 0 ? Math.PI : 0));
    ctx.font = "700 12px 'Pixelify Sans', monospace";
    ctx.fillStyle = '#17100a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(WHEEL_SEGS[i], 0, 0);
    ctx.restore();
  }
  ctx.strokeStyle = '#41291a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f2b23a';
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#41291a';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#efe9dc';
  ctx.beginPath();
  ctx.moveTo(cx - 11, cy - R - 12);
  ctx.lineTo(cx + 11, cy - R - 12);
  ctx.lineTo(cx, cy - R + 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#41291a';
  ctx.stroke();
}

function WheelPopup() {
  const me = useGameStore((s) => s.me)!;
  const walletAddress = useGameStore((s) => s.walletAddress);
  const setPanel = useGameStore((s) => s.setPanel);
  const setMe = useGameStore((s) => s.setMe);
  const toast = useGameStore((s) => s.toastMsg);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(-Math.PI / 2);
  const animRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);

  useEffect(() => {
    if (canvasRef.current) drawFortuneWheel(canvasRef.current, rotRef.current);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const available = me.wheelAvailableAt <= Date.now() && !!walletAddress;

  const spin = async () => {
    if (spinning || !available) return;
    setSpinning(true);
    setResultText(null);
    try {
      const res = await api.spinWheel();
      const n = WHEEL_SEGS.length;
      // land the winning segment center under the top pointer (-PI/2)
      const target = -Math.PI / 2 - ((res.segment + 0.5) * Math.PI * 2) / n;
      const start = rotRef.current;
      const turns = Math.PI * 2 * 5;
      const delta = turns + ((target - start - turns) % (Math.PI * 2));
      const t0 = performance.now();
      const dur = 3600;
      BRSfx.whoosh();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        const ease = 1 - Math.pow(1 - t, 3);
        rotRef.current = start + delta * ease;
        if (canvasRef.current) drawFortuneWheel(canvasRef.current, rotRef.current);
        if (t < 1) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          setSpinning(false);
          setMe(res.me);
          if (res.outcome === 'jackpot') {
            setResultText(`🎰 JACKPOT! ${res.itemName} (${res.itemRarity}) — check your Items!`);
            BRSfx.fanfare();
          } else {
            setResultText(`💰 You won ${res.gold}g!`);
            BRSfx.coin();
          }
        }
      };
      animRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setSpinning(false);
      toast((e as Error).message);
    }
  };

  const nextIn = () => {
    const ms = me.wheelAvailableAt - Date.now();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.ceil((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  };

  return (
    <div className="modal-overlay" onClick={() => setPanel(null)}>
      <div className="modal" style={{ maxWidth: 340, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Daily Fortune Wheel</span>
          <button type="button" className="close-btn" onClick={() => setPanel(null)}>✕</button>
        </div>
        <div style={{ padding: '10px 14px 16px' }}>
          <canvas ref={canvasRef} style={{ width: 280, height: 280 }} />
          <div className="card row-between" style={{ marginBottom: 8, textAlign: 'left' }}>
            <div className="row gap">
              <ItemIcon slot={me.wheelJackpot.slot} rarity={me.wheelJackpot.rarity} color={me.wheelJackpot.color} size={38} />
              <div>
                <div className="muted sm">TODAY'S JACKPOT · wheel exclusive</div>
                <span className="bold sm" style={{ color: me.wheelJackpot.rarityColor }}>
                  {me.wheelJackpot.name} ({me.wheelJackpot.rarity})
                </span>
              </div>
            </div>
          </div>
          <div className="muted sm" style={{ marginBottom: 8 }}>
            One free spin per day · hold {WHEEL_MIN_TOKENS.toLocaleString()} tokens to spin
          </div>
          {resultText && <div className="card green-txt" style={{ marginBottom: 8 }}>{resultText}</div>}
          <button className={`${btn} gold`} disabled={spinning || !available} onClick={() => void spin()}>
            {spinning
              ? 'Spinning…'
              : !walletAddress
                ? 'Connect wallet in Profile to spin'
                : available
                  ? 'SPIN!'
                  : `Come back in ${nextIn()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function HelpModal() {
  const me = useGameStore((s) => s.me)!;
  const setPanel = useGameStore((s) => s.setPanel);
  const setMe = useGameStore((s) => s.setMe);

  const close = () => setPanel(null);

  if (me.helpSeen) {
    return <GameGuide onClose={close} dismissLabel="Close" />;
  }

  return (
    <GameGuide
      onClose={close}
      onDismiss={() => {
        api.settings({ helpSeen: true }).then((m) => {
          setMe(m);
          close();
        }).catch(close);
      }}
      dismissLabel="Got it"
    />
  );
}

function BuyDenModal() {
  const confirm = useGameStore((s) => s.buyDenConfirm);
  const setConfirm = useGameStore((s) => s.setBuyDenConfirm);
  const setMe = useGameStore((s) => s.setMe);
  const setPastures = useGameStore((s) => s.setPastures);
  const toast = useGameStore((s) => s.toastMsg);

  if (!confirm) return null;

  const onBuy = () => {
    const { plotId, label, price } = confirm;
    setConfirm(null);
    api.buyPasture(plotId).then((r) => {
      setMe(r.me);
      setPastures(r.pastures);
      toast(`Bought ${label} for ${price}g!`);
    }).catch((e) => toast(e.message));
  };

  return (
    <div className="modal-overlay" onClick={() => setConfirm(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">Buy den?</div>
        <div className="panel-body">
          <p className="center" style={{ margin: '8px 0 16px' }}>
            Are you sure you want to buy <b className="gold">{confirm.label}</b> for <b className="gold">{confirm.price}g</b> + <b>5 wood</b>?
          </p>
          <div className="row gap wrap" style={{ justifyContent: 'center' }}>
            <button className={`${btn} green`} onClick={onBuy}>Buy den</button>
            <button className={btn} onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GatherBar() {
  const gather = useGameStore((s) => s.gather);
  const pct = useGameStore((s) => s.gatherPct);

  if (!gather) return null;
  return (
    <div className="gather-bar">
      <div className="gather-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function GameUI() {
  const me = useGameStore((s) => s.me);
  const panel = useGameStore((s) => s.panel);
  const toast = useGameStore((s) => s.toast);
  const raceLive = useGameStore((s) => s.raceLive);
  const setPanel = useGameStore((s) => s.setPanel);
  const setInvOpen = useGameStore((s) => s.setInvOpen);
  const invCount = me?.items.filter((i) => !i.equippedTo).length ?? 0;
  const setProfileOpen = useGameStore((s) => s.setProfileOpen);
  const playersOnline = useOnlineCount();

  if (!me) return null;

  const openBuilding = (p: 'stable' | 'race' | 'bet' | 'market' | 'forge' | 'shop' | 'wheel') => {
    if (panel === p) {
      setPanel(null);
      return;
    }
    navigateToBuilding(p);
  };

  const cd = me.race ? fmtRaceCountdown(new Date(me.race.startAt).getTime()) : '—';
  const slots = bullSlots(me.stable.level);

  return (
    <div className="game-hud">
      <div className="hud-tl">
        <div className="hud-chip">
          <GoldIcon />
          <span className="hud-gold-val">{Math.round(me.gold)}</span>
        </div>
        <div className="hud-chip">
          <HayIcon />
          <span className="hud-mat-val">{me.mats.hay}</span>
          <OreIcon />
          <span className="hud-mat-val">{me.mats.ore}</span>
          <WoodIcon />
          <span className="hud-mat-val">{me.mats.wood}</span>
        </div>
        <div className="hud-chip hud-level" title={`${me.xp.toLocaleString()} / ${xpNeedForLevel(me.level).toLocaleString()} XP — gather resources to level up`}>
          <span className="hud-lvl-badge">Lv {me.level}</span>
          <div className="xp-bar">
            <div
              className="xp-fill"
              style={{ width: me.level >= MAX_CHAR_LEVEL ? '100%' : `${Math.min(100, (me.xp / xpNeedForLevel(me.level)) * 100)}%` }}
            />
          </div>
          <span className="hud-xp-text">
            {me.level >= MAX_CHAR_LEVEL ? 'MAX' : `${me.xp.toLocaleString()}/${xpNeedForLevel(me.level).toLocaleString()}`}
          </span>
        </div>
      </div>
      <div className="hud-tc">
        <div className="hud-chip">{raceLive ? '🏁 RACE' : 'NEXT RACE'} <span className="gold bold lg">{raceLive ? 'LIVE' : cd}</span></div>
        {raceLive && (
          <div className="standings">{raceLive.standings.map((s) => (
            <span key={`${s.pos}-${s.name}`} className={`standing-chip${s.finished ? '' : ' standing-chip--racing'}`}>
              {s.finished ? `${s.pos}. ${s.name}` : `… ${s.name}`}
            </span>
          ))}</div>
        )}
      </div>
      <div className="hud-tr">
        <OnlineBadge count={playersOnline} />
        <span className="hud-tr-meta">You · Stable Lv {me.stable.level} · {me.bulls.filter((b) => (b.location ?? 'stable') === 'stable').length}/{slots} stable · {me.followingBullIds?.length ?? 0}/{maxFollowingForLevel(me.level)} following</span>
      </div>

      <GatherBar />

      <ChatPanel />

      <div className="bottom-bar">
        {(['stable', 'race', 'bet', 'market', 'forge'] as const).map((p) => (
          <button key={p} className={`${btn} gold`} onClick={() => openBuilding(p)}>{p[0].toUpperCase() + p.slice(1)}</button>
        ))}
        <button className={`${btn} green`} onClick={() => openBuilding('shop')}>Store</button>
        <button className={`${btn} blue`} onClick={() => setInvOpen(true)}>Items ({invCount})</button>
        <button className={btn} onClick={() => setProfileOpen(true)}>Profile</button>
        <button className={btn} onClick={() => setPanel('help')}>?</button>
      </div>

      {panel === 'stable' && <StablePanel />}
      {panel === 'den' && <DenPanel />}
      {panel === 'race' && <RacePanel />}
      {panel === 'bet' && <BetPanel />}
      {panel === 'market' && <MarketPanel />}
      {panel === 'forge' && <ForgePanel />}
      {panel === 'shop' && <StorePanel />}
      {panel === 'wheel' && <WheelPopup />}
      {panel === 'help' && <HelpModal />}
      <InventoryPopup />
      <ProfilePopup />
      <BuyDenModal />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
