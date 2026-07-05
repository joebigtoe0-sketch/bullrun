import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useGameStore } from '../store/gameStore';
import {
  NPC_CATALOG,
  MAT_SWATCHES,
  bullSlots,
  eff,
  coatOf,
  forgeChances,
  statCap,
  stableGoldNeed,
  stableWoodNeed,
  fmtCountdown,
  RARITIES,
} from '@bullrun/shared';
import type { Bull, MatType, MeResponse, StatType } from '@bullrun/shared';

const btn = 'br-btn';
const panel = 'br-panel';

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
            <span className="muted">+{(me.stable.level - 1) * 50}% energy regen</span>
          </div>
          <div className="bar"><div className="bar-fill wood" style={{ width: `${Math.min(100, me.stable.wood / woodNeed * 100)}%` }} /></div>
          <div className="row-between">
            <span className="muted">Wood {me.stable.wood} / {woodNeed} · {slots} bull slots</span>
            <button className={`${btn} green`} onClick={() => act(api.upgradeStable)}>Add 5 wood{me.stable.wood + 5 >= woodNeed ? ` (+${goldNeed}g to level!)` : ''}</button>
          </div>
        </div>
        {me.bulls.map((b) => (
          <BullCard key={b.id} bull={b} items={me.items} entered={me.entered.includes(b.id)}
            onTrain={(stat) => act(() => api.train(b.id, stat))}
            onRest={() => act(() => api.rest(b.id))}
            onRename={() => { const n = prompt('Rename ' + b.name, b.name); if (n?.trim()) act(() => api.rename(b.id, n.trim())); }}
            onEquip={() => { setEquipTarget(b.id); setInvOpen(true); }}
            onEnter={() => act(() => api.enterRace(b.id), `${b.name} entered!`)}
          />
        ))}
        <div className="card row-between">
          <div>
            <div className="bold">Breeding</div>
            <div className="muted">{me.breeding ? 'Calf arriving soon…' : me.breedSel.length ? `Selected: ${me.breedSel.join('+')}` : 'Select two bulls above'}</div>
          </div>
          <button className={`${btn} purple`} onClick={() => {
            if (me.breedSel.length !== 2) return toast('Select exactly two bulls');
            act(() => api.breed(me.breedSel[0], me.breedSel[1]), 'Breeding…');
          }}>Breed (200g)</button>
        </div>
      </div>
    </div>
  );
}

function BullCard({ bull, items, entered, onTrain, onRest, onRename, onEquip, onEnter }: {
  bull: Bull; items: import('@bullrun/shared').GameItem[]; entered: boolean;
  onTrain: (s: StatType) => void; onRest: () => void; onRename: () => void; onEquip: () => void; onEnter: () => void;
}) {
  const cap = statCap(bull);
  const coat = coatOf(bull, items);
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
          <span className="swatch" style={{ background: coat }} />
          <span className="bold lg">{bull.name}</span>
          <span className="badge">Lv {bull.level}</span>
        </div>
        <button className="small-btn" onClick={onRename}>Rename</button>
      </div>
      <div className="bar-row">
        <div className="bar flex1"><div className="bar-fill energy" style={{ width: `${bull.energy}%` }} /></div>
        <span>{Math.round(bull.energy)}</span>
        <span className="muted">XP {Math.round(bull.xp)}/{bull.level * 100}</span>
      </div>
      {(['speed', 'stamina', 'accel'] as StatType[]).map((stat) => (
        <div key={stat} className="grid-train">
          <span>{stat} <b className="gold">{bull[stat]}{eff(bull, stat, items) > bull[stat] ? `+${eff(bull, stat, items) - bull[stat]}` : ''} / {cap}</b></span>
          <button className="small-btn" onClick={() => onTrain(stat)}>Train · 6 hay</button>
        </div>
      ))}
      <div className="muted sm">Equipped: {equipped.length ? equipped.map((e) => e.name).join(', ') : 'nothing'}</div>
      <div className="row gap wrap">
        <button className={`${btn} blue sm`} onClick={onEquip}>Equip items</button>
        <button className={`${btn} sm`} onClick={onRest}>Rest +40⚡ (40g)</button>
        <button className={`${btn} sm`} onClick={toggleBreed}>Select to breed</button>
        {entered ? <span className="entered">Entered ✓</span> : <button className={`${btn} gold sm`} onClick={onEnter}>Enter race</button>}
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
  const cd = me.race ? fmtCountdown(new Date(me.race.startAt).getTime() - Date.now()) : '—';

  return (
    <div className={panel}>
      <PanelHeader title="Race Signup" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <div className="card center">
          <div className="muted">NEXT RACE IN</div>
          <div className="countdown">{raceLive ? 'LIVE' : cd}</div>
          <div className="muted">Entry: 50g + 30⚡ · Purse 300/150/80/40</div>
        </div>
        {me.bulls.map((b) => (
          <div key={b.id} className="card row-between">
            <div>
              <span className="bold">{b.name}</span>
              <div className="muted sm">SPD {eff(b, 'speed', me.items)} · ⚡{Math.round(b.energy)}</div>
            </div>
            {me.entered.includes(b.id) ? <span className="entered">Entered ✓</span> : (
              <button className={`${btn} gold`} onClick={() => api.enterRace(b.id).then(setMe).catch((e) => toast(e.message))}>Enter race</button>
            )}
          </div>
        ))}
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
  const shopBulls = useGameStore((s) => s.shopBulls);
  const toast = useGameStore((s) => s.toastMsg);

  const mats: MatType[] = ['hay', 'ore', 'wood'];

  return (
    <div className={panel}>
      <PanelHeader title="Player Market" onClose={() => setPanel(null)} />
      <div className="panel-body">
        <div className="muted sm">LIST MATERIALS · 5% FEE</div>
        {mats.map((m) => (
          <div key={m} className="card row-between">
            <div className="row gap"><span className="swatch" style={{ background: MAT_SWATCHES[m] }} /><span className="bold">{m}</span> ×{me.mats[m]}</div>
            <div className="row gap">
              <button className="small-btn" onClick={() => api.settings({ listPrice: { ...me.listPrice, [m]: Math.max(1, me.listPrice[m] - 1) } }).then(setMe)}>−</button>
              <span className="gold">{me.listPrice[m]}g</span>
              <button className="small-btn" onClick={() => api.settings({ listPrice: { ...me.listPrice, [m]: me.listPrice[m] + 1 } }).then(setMe)}>+</button>
              <button className={`${btn} green sm`} onClick={() => api.listMaterial(m, me.listPrice[m]).then(setMe).catch((e) => toast(e.message))}>List 10</button>
            </div>
          </div>
        ))}
        {me.marketListings?.map((l) => (
          <div key={l.id} className="card row-between">
            <span>{l.qty} {l.mat} @ {l.price}g — {l.sellerName}</span>
            <button className={`${btn} gold sm`} onClick={() => api.buyListing(l.id).then(setMe).catch((e) => toast(e.message))}>Buy {l.price}g</button>
          </div>
        ))}
        <div className="muted sm">BULLS FOR SALE</div>
        {shopBulls.map((sb, i) => (
          <div key={i} className="card row-between">
            <div><span className="bold">{sb.name}</span> <span className="muted sm">seller: {sb.seller}</span></div>
            <button className={`${btn} gold sm`} onClick={() => api.buyShopBull(sb as unknown as Record<string, unknown>, sb.price).then(setMe).catch((e) => toast(e.message))}>{sb.price}g</button>
          </div>
        ))}
        <div className="muted sm">NPC CATALOG</div>
        {NPC_CATALOG.map((c) => (
          <div key={c.name} className="card row-between">
            <span className="bold">{c.name}</span>
            <button className={`${btn} gold sm`} onClick={() => api.buyNpc(c.mat, c.price).then(setMe).catch((e) => toast(e.message))}>{c.price}g</button>
          </div>
        ))}
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
        <p className="muted">Feed ore into the forge. Min 50 ore — more ore = rarer items.</p>
        <div className="card">
          <div className="row-between">
            <span>Ore (have {me.mats.ore})</span>
            <div className="row gap">
              <button className="small-btn" onClick={() => api.settings({ forgeOre: Math.max(50, me.forgeOre - 10) }).then(setMe)}>−</button>
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

function ResultsModal() {
  const results = useGameStore((s) => s.results);
  const betResult = useGameStore((s) => s.betResult);
  const setPanel = useGameStore((s) => s.setPanel);
  const setResults = useGameStore((s) => s.setResults);
  if (!results) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">Race Results</div>
        <div className="panel-body">
          {results.map((r) => (
            <div key={r.pos} className={`card row-between ${r.mine ? 'mine' : ''}`}>
              <span><b className="gold">{['1st','2nd','3rd','4th','5th','6th'][r.pos-1]}</b> {r.name} <span className="muted sm">{r.owner}</span></span>
              <span className="green-txt">{r.prize ? `+${r.prize}g` : '—'}</span>
            </div>
          ))}
          {betResult && <div className="card green-txt">{betResult}</div>}
          <button className={`${btn} gold`} onClick={() => { setResults(null); setPanel(null); }}>Continue</button>
        </div>
      </div>
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

export function GameUI() {
  const me = useGameStore((s) => s.me);
  const panel = useGameStore((s) => s.panel);
  const toast = useGameStore((s) => s.toast);
  const gather = useGameStore((s) => s.gather);
  const raceLive = useGameStore((s) => s.raceLive);
  const setPanel = useGameStore((s) => s.setPanel);
  const setInvOpen = useGameStore((s) => s.setInvOpen);
  const invCount = me?.items.filter((i) => !i.equippedTo).length ?? 0;

  if (!me) return null;

  const cd = me.race ? fmtCountdown(new Date(me.race.startAt).getTime() - Date.now()) : '—';
  const slots = bullSlots(me.stable.level);

  return (
    <>
      <div className="hud-tl">
        <div className="hud-chip"><span className="gold bold">{Math.round(me.gold)}</span></div>
        <div className="hud-chip">
          <span>{me.mats.hay}</span><span>{me.mats.ore}</span><span>{me.mats.wood}</span>
        </div>
      </div>
      <div className="hud-tc">
        <div className="hud-chip">{raceLive ? '🏁 RACE' : 'NEXT RACE'} <span className="gold bold lg">{raceLive ? 'LIVE' : cd}</span></div>
        {raceLive && (
          <div className="standings">{raceLive.standings.map((s) => <span key={s.pos} className="standing-chip">{s.pos}. {s.name}</span>)}</div>
        )}
      </div>
      <div className="hud-tr">You · Stable Lv {me.stable.level} · {me.bulls.length}/{slots} bulls</div>

      {gather && (
        <div className="gather-bar"><div style={{ width: `${Math.min(100, (Date.now() - gather.start) / gather.dur * 100)}%` }} /></div>
      )}

      <div className="bottom-bar">
        {(['stable', 'race', 'bet', 'market', 'forge'] as const).map((p) => (
          <button key={p} className={`${btn} gold`} onClick={() => setPanel(panel === p ? null : p)}>{p[0].toUpperCase() + p.slice(1)}</button>
        ))}
        <button className={`${btn} blue`} onClick={() => setInvOpen(true)}>Items ({invCount})</button>
        <button className={btn} onClick={() => setPanel('help')}>?</button>
      </div>

      {panel === 'stable' && <StablePanel />}
      {panel === 'race' && <RacePanel />}
      {panel === 'bet' && <BetPanel />}
      {panel === 'market' && <MarketPanel />}
      {panel === 'forge' && <ForgePanel />}
      {panel === 'help' && <HelpModal />}
      <InventoryPopup />
      <ResultsModal />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
