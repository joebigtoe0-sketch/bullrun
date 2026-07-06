import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useGameStore } from '../store/gameStore';
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
  stableGoldNeed,
  stableWoodNeed,
  energyPerMinute,
  fmtCountdown,
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
  TRAIN_HAY_COST,
  REST_COST,
  REST_ENERGY,
  BREED_COST,
} from '@bullrun/shared';
import type { Bull, BullRarity, MatType, MeResponse, StatType } from '@bullrun/shared';
import { navigateToBuilding } from '../game/loop';
import { GoldIcon, HayIcon, OreIcon, WoodIcon } from './HudIcons';

const btn = 'br-btn';
const panel = 'br-panel';

function bullRarity(bull: Bull): BullRarity {
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
            <span className="muted">{energyPerMinute(me.stable.level).toFixed(1)}⚡/min regen</span>
          </div>
          <div className="bar"><div className="bar-fill wood" style={{ width: `${Math.min(100, me.stable.wood / woodNeed * 100)}%` }} /></div>
          <div className="row-between">
            <span className="muted">Wood {me.stable.wood} / {woodNeed} · {stableBulls.length}/{slots} bull slots</span>
            <button className={`${btn} green`} onClick={() => act(api.upgradeStable)}>Add 10 wood{me.stable.wood + 10 >= woodNeed ? ` (+${goldNeed}g to level!)` : ''}</button>
          </div>
        </div>
        {stableBulls.map((b) => (
          <BullCard key={b.id} bull={b} items={me.items}
            onTrain={(stat) => act(() => api.train(b.id, stat))}
            onRest={() => act(() => api.rest(b.id))}
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

function BullCard({ bull, items, onTrain, onRest, onRename, onEquip, onFollow, onDelete }: {
  bull: Bull; items: import('@bullrun/shared').GameItem[];
  onTrain: (s: StatType) => void; onRest: () => void; onRename: () => void; onEquip: () => void;
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
        <span>{Math.round(bull.energy)}/{BULL_MAX_ENERGY}</span>
        <span className="muted">XP {Math.round(bull.xp)}/{bull.level * 100}</span>
      </div>
      {(['speed', 'stamina', 'accel'] as StatType[]).map((stat) => {
        const base = Math.round(bull[stat]);
        const total = Math.round(eff(bull, stat, items));
        const bonus = total - base;
        return (
        <div key={stat} className="grid-train">
          <span>{stat} <b className="gold stat-num">{base}{bonus > 0 ? `+${bonus}` : ''} / {cap}</b></span>
          <button className="small-btn" onClick={() => onTrain(stat)}>Train · {TRAIN_HAY_COST} hay</button>
        </div>
        );
      })}
      <div className="muted sm">Equipped: {equipped.length ? equipped.map((e) => e.name).join(', ') : 'nothing'}</div>
      <div className="row gap wrap">
        <button className={`${btn} blue sm`} onClick={onEquip}>Equip items</button>
        <button className={`${btn} sm`} onClick={onRest}>Rest +{REST_ENERGY}⚡ ({REST_COST}g)</button>
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

  const denBulls = me.bulls.filter((b) => b.location === 'den' && b.denPlotId === denPlotId);
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

  return (
    <div className={panel}>
      <PanelHeader title={def.label} color="#8bc34a" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <div className="card">
          <div className="row-between">
            <span className="bold">Den Level {plot.level}</span>
            <span className="muted">{denBulls.length}/{cap} bulls · next spawn {spawnCd}</span>
          </div>
          <div className="row-between">
            <span className="muted">Upgrade: {PASTURE_WOOD_UPGRADE_COST} wood + {upGold}g</span>
            <button className={`${btn} green`} onClick={() => actDen(() => api.upgradePasture(denPlotId), 'Den upgraded!')}>Upgrade den</button>
          </div>
        </div>

        {denBulls.map((b) => {
          const rarity = bullRarity(b);
          return (
          <div key={b.id} className="card">
            <div className="row-between">
              <div className="row gap">
                <span className="swatch" style={{ background: BULL_RARITY_COLOR[rarity] }} />
                <span className="bold">{b.name}</span>
                <span className="badge" style={{ color: BULL_RARITY_COLOR[rarity] }}>{BULL_RARITY_LABEL[rarity]}</span>
              </div>
              <div className="row gap">
                {followingBulls.length < followSlots && (
                  <button className={`${btn} green sm`} onClick={() => act(() => api.followBull(b.id), `${b.name} is following you`)}>Follow me</button>
                )}
                <button className={`${btn} sm`} style={{ color: '#e55' }} onClick={() => { if (confirm(`Release ${b.name}?`)) act(() => api.deleteBull(b.id)); }}>Release</button>
              </div>
            </div>
          </div>
          );
        })}

        {followingBulls.length > 0 && (
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

        {stableBulls.length > 0 && denBulls.length < cap && (
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
  const cd = me.race ? fmtCountdown(new Date(me.race.startAt).getTime() - Date.now()) : '—';
  const alreadyEntered = me.entered.length > 0;

  return (
    <div className={panel}>
      <PanelHeader title="Race Signup" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <div className="card center">
          <div className="muted">NEXT RACE IN</div>
          <div className="countdown">{raceLive ? 'LIVE' : cd}</div>
          <div className="muted">Entry: {BULL_MAX_ENERGY}⚡ · Free · Purse 1000g · One bull per player</div>
        </div>
        {followingBulls.length === 0 ? (
          <div className="card muted">Bring a bull with you first — use &quot;Follow me&quot; in your stable or den.</div>
        ) : (
          followingBulls.map((b) => (
            <div key={b.id} className="card row-between">
              <div>
                <span className="bold">{b.name}</span>
                <div className="muted sm">SPD {eff(b, 'speed', me.items)} · STA {eff(b, 'stamina', me.items)} · ACC {eff(b, 'accel', me.items)} · ⚡{Math.round(b.energy)}</div>
              </div>
              {me.entered.includes(b.id) ? (
                <span className="entered">Entered ✓</span>
              ) : alreadyEntered ? (
                <span className="muted sm">Already entered another bull</span>
              ) : b.energy < BULL_MAX_ENERGY ? (
                <span className="muted sm">Need {BULL_MAX_ENERGY}⚡</span>
              ) : (
                <button className={`${btn} gold`} onClick={() => api.enterRace(b.id).then(setMe).catch((e) => toast(e.message))}>Enter race</button>
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
              <button className={`${btn} green`} onClick={() => api.placeBet(String(e.id), e.name, me.betAmount, oddsArr[i]).then(setMe).catch((err) => toast(err.message))}>Bet</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketPanel() {
  const me = useGameStore((s) => s.me)!;
  const setPanel = useGameStore((s) => s.setPanel);
  const setMe = useGameStore((s) => s.setMe);
  const toast = useGameStore((s) => s.toastMsg);

  const mats: MatType[] = ['hay', 'ore', 'wood'];

  return (
    <div className={panel}>
      <PanelHeader title="Player Market" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <div className="muted sm">LIST MATERIALS · 5% FEE · CHOOSE QUANTITY</div>
        {mats.map((m) => (
          <div key={m} className="card">
            <div className="row-between">
              <div className="row gap"><span className="swatch" style={{ background: MAT_SWATCHES[m] }} /><span className="bold">{m}</span> ×{me.mats[m]}</div>
              <div className="row gap">
                <button className="small-btn" onClick={() => api.settings({ listPrice: { ...me.listPrice, [m]: Math.max(1, me.listPrice[m] - 1) } }).then(setMe)}>−</button>
                <span className="gold stat-num">{me.listPrice[m]}g/u</span>
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
                  List {qty}
                </button>
              ))}
            </div>
          </div>
        ))}
        {me.marketListings?.length ? (
          <>
            <div className="muted sm">OPEN LISTINGS</div>
            {me.marketListings.map((l) => (
              <div key={l.id} className="card row-between">
                <span>{l.qty} {l.mat} @ {l.price}g — {l.sellerName}</span>
                <button className={`${btn} gold sm`} onClick={() => api.buyListing(l.id).then(setMe).catch((e) => toast(e.message))}>Buy {l.price}g</button>
              </div>
            ))}
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
        <p className="muted">Feed ore into the forge. Min {FORGE_MIN_ORE} ore — 100 ore = guaranteed Common. More ore = rarer items.</p>
        <div className="card">
          <div className="row-between">
            <span>Ore (have {me.mats.ore})</span>
            <div className="row gap">
              <button className="small-btn" onClick={() => api.settings({ forgeOre: Math.max(FORGE_MIN_ORE, me.forgeOre - 10) }).then(setMe)}>−</button>
              <span className="orange lg">{me.forgeOre}</span>
              <button className="small-btn" onClick={() => api.settings({ forgeOre: me.forgeOre + 10 }).then(setMe)}>+</button>
            </div>
          </div>
          {RARITIES.map((r, i) => (
            <div key={r.k} className="chance-row">
              <span style={{ color: r.c, width: 74 }}>{r.k}</span>
              <div className="bar flex1"><div className="bar-fill" style={{ width: `${chances[i] * 100}%`, background: r.c }} /></div>
              <span className="muted">{(chances[i] * 100).toFixed(0)}%</span>
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
  const items = me.items.filter((it) => !it.equippedTo);

  return (
    <div className="inv-popup">
      <div className="row-between">
        <span className="bold blue">Inventory</span>
        <button className="close-btn" onClick={() => setInvOpen(false)}>✕</button>
      </div>
      <div className="muted sm">Equipping to: {target?.name}</div>
      {items.length === 0 && <div className="muted center">No items — forge some ore!</div>}
      {items.map((it) => (
        <div key={it.id} className="card row-between">
          <div>
            <span className="swatch" style={{ background: it.color }} />
            <span style={{ color: it.rarityColor }} className="bold">{it.name}</span>
            <div className="muted sm">{it.slot} · {it.rarity}</div>
          </div>
          <button className={`${btn} green sm`} onClick={() => target && api.equip(it.id, target.id).then(setMe).catch((e) => toast(e.message))}>Equip</button>
        </div>
      ))}
    </div>
  );
}

function WelcomeBanner() {
  const setMe = useGameStore((s) => s.setMe);
  const toast = useGameStore((s) => s.toastMsg);

  return (
    <div className="welcome-banner">
      <p><b className="gold">Welcome!</b> Click ground to walk · WASD pans camera · Bottom buttons open Stable, Race, Market &amp; Forge</p>
      <button
        className={`${btn} gold`}
        onClick={() => api.settings({ helpSeen: true }).then(setMe).catch((e) => toast(e.message))}
      >
        Got it
      </button>
    </div>
  );
}

function HelpModal() {
  const setPanel = useGameStore((s) => s.setPanel);
  const setMe = useGameStore((s) => s.setMe);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">🐂 Bull Run</div>
        <div className="panel-body">
          <p><b className="gold">Move</b> — click ground to walk, click objects to interact</p>
          <p><b className="gold">Camera</b> — WASD/arrows to pan</p>
          <p><b className="gold">Race</b> — global races every 2 min, enter bulls and bet</p>
          <p><b className="gold">MMO</b> — see other players live in the shared world</p>
          <button className={`${btn} gold`} onClick={() => api.settings({ helpSeen: true }).then((m) => { setMe(m); setPanel(null); })}>Play</button>
        </div>
      </div>
    </div>
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
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!gather) return;
    let raf = 0;
    const frame = () => {
      setTick((t) => t + 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [gather]);

  if (!gather) return null;
  const pct = Math.min(100, ((Date.now() - gather.start) / gather.dur) * 100);
  return (
    <div className="gather-bar">
      <div style={{ width: `${pct}%` }} />
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

  if (!me) return null;

  const openBuilding = (p: 'stable' | 'race' | 'bet' | 'market' | 'forge') => {
    if (panel === p) {
      setPanel(null);
      return;
    }
    navigateToBuilding(p);
  };

  const cd = me.race ? fmtCountdown(new Date(me.race.startAt).getTime() - Date.now()) : '—';
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
      </div>
      <div className="hud-tc">
        <div className="hud-chip">{raceLive ? '🏁 RACE' : 'NEXT RACE'} <span className="gold bold lg">{raceLive ? 'LIVE' : cd}</span></div>
        {raceLive && (
          <div className="standings">{raceLive.standings.map((s) => <span key={s.pos} className="standing-chip">{s.pos}. {s.name}</span>)}</div>
        )}
      </div>
      <div className="hud-tr">You · Stable Lv {me.stable.level} · {me.bulls.filter((b) => (b.location ?? 'stable') === 'stable').length}/{slots} stable · {me.followingBullIds?.length ?? 0}/{MAX_FOLLOWING_BULLS} following</div>

      <GatherBar />

      <div className="bottom-bar">
        {(['stable', 'race', 'bet', 'market', 'forge'] as const).map((p) => (
          <button key={p} className={`${btn} gold`} onClick={() => openBuilding(p)}>{p[0].toUpperCase() + p.slice(1)}</button>
        ))}
        <button className={`${btn} blue`} onClick={() => setInvOpen(true)}>Items ({invCount})</button>
        <button className={btn} onClick={() => setPanel('help')}>?</button>
      </div>

      {panel === 'stable' && <StablePanel />}
      {panel === 'den' && <DenPanel />}
      {panel === 'race' && <RacePanel />}
      {panel === 'bet' && <BetPanel />}
      {panel === 'market' && <MarketPanel />}
      {panel === 'forge' && <ForgePanel />}
      {panel === 'help' && <HelpModal />}
      {!me.helpSeen && panel !== 'help' && <WelcomeBanner />}
      <InventoryPopup />
      <BuyDenModal />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
