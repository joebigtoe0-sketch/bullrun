import { useEffect, useRef } from 'react';
import {
  BULL_RARITY_COLOR,
  BULL_RARITY_LABEL,
  BULL_TRAIT_LABEL,
  BULL_TRAIT_DESC,
  TRAIT_POOLS,
  RARITIES,
  STORE_CATALOG,
  WHEEL_JACKPOT_CLOTHING,
  CHAR_STAT_LABEL,
} from '@bullrun/shared';
import type { BullRarity, BullTrait, ItemSlot } from '@bullrun/shared';
import { BRArt } from '../world/canvas/bullrunArt';
import { ItemIcon } from './ItemIcon';

/** Animated live preview of a bull with a given trait. */
function BullPreview({ trait, coat, seed = 7 }: { trait: BullTrait; coat?: string; seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 120;
    const H = 96;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    let raf = 0;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const frame = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H * 0.72);
      BRArt.drawObj(ctx, BRArt.iso, {
        t: 'bull',
        x: 0,
        y: 0,
        coat: coat ?? '#6e4526',
        trait,
        seed,
      }, { t: performance.now() / 1000, nowMs: Date.now() });
      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [trait, coat, seed]);

  return <canvas ref={ref} style={{ width: 120, height: 96 }} aria-hidden />;
}

const GALLERY_RARITIES: BullRarity[] = ['common', 'uncommon', 'rare', 'legendary'];

export function BullGallery() {
  return (
    <div>
      {GALLERY_RARITIES.map((rarity) => {
        const traits: BullTrait[] = rarity === 'common' ? ['normal'] : TRAIT_POOLS[rarity];
        return (
          <div key={rarity} style={{ marginBottom: 14 }}>
            <div className="guide-h3" style={{ color: BULL_RARITY_COLOR[rarity] }}>
              {BULL_RARITY_LABEL[rarity]}
              {rarity !== 'common' && <span className="guide-p" style={{ marginLeft: 8, fontSize: 12 }}>(can also roll plain)</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {traits.map((trait) => (
                <div
                  key={trait}
                  style={{
                    width: 150,
                    background: 'rgba(0,0,0,.18)',
                    border: `2px solid ${BULL_RARITY_COLOR[rarity]}44`,
                    borderRadius: 10,
                    padding: '8px 6px',
                    textAlign: 'center',
                  }}
                >
                  <BullPreview trait={trait} seed={trait === 'unicorn' ? 3 : 7} />
                  <div style={{ color: BULL_RARITY_COLOR[rarity], fontWeight: 800, fontSize: 13 }}>
                    {BULL_TRAIT_LABEL[trait]}
                  </div>
                  <div className="guide-p" style={{ fontSize: 11, margin: '2px 0 0' }}>{BULL_TRAIT_DESC[trait]}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="guide-p" style={{ fontSize: 12 }}>
        Unicorns come in a different pastel color each — no two look alike. Higher rarity bulls also roll better base stats.
      </p>
    </div>
  );
}

const GEAR_SLOTS: ItemSlot[] = ['coat', 'horns', 'hooves', 'tail', 'accessory'];
const GEAR_SLOT_LABEL: Record<ItemSlot, string> = {
  coat: 'Coat',
  horns: 'Horns',
  hooves: 'Hooves',
  tail: 'Tail Wrap',
  accessory: 'Harness',
};

export function GearGallery() {
  return (
    <div>
      <div className="guide-h3">Bull gear (forge)</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {GEAR_SLOTS.map((slot) => (
              <tr key={slot}>
                <td className="guide-p" style={{ paddingRight: 10, fontSize: 12, whiteSpace: 'nowrap' }}>{GEAR_SLOT_LABEL[slot]}</td>
                {RARITIES.map((r) => (
                  <td key={r.k} style={{ textAlign: 'center', padding: 2 }}>
                    <ItemIcon slot={slot} rarity={r.k} size={40} />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td />
              {RARITIES.map((r) => (
                <td key={r.k} style={{ textAlign: 'center', color: r.c, fontSize: 11, fontWeight: 800 }}>{r.k}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="guide-h3" style={{ marginTop: 14 }}>Rancher clothing (general store)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {STORE_CATALOG.map((d) => (
          <div key={d.sku} style={{ width: 128, background: 'rgba(0,0,0,.18)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
            <ItemIcon slot={d.slot} rarity={d.rarity} color={d.color} size={44} />
            <div style={{ color: RARITIES.find((r) => r.k === d.rarity)?.c, fontWeight: 800, fontSize: 12 }}>{d.name}</div>
            <div className="guide-p" style={{ fontSize: 11, margin: '2px 0 0' }}>
              +{d.bonus.amt}% {CHAR_STAT_LABEL[d.bonus.stat]} · {d.price}g
            </div>
          </div>
        ))}
      </div>

      <div className="guide-h3" style={{ marginTop: 14 }}>Wheel-exclusive clothing (jackpots)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {WHEEL_JACKPOT_CLOTHING.map((d) => (
          <div key={d.sku} style={{ width: 128, background: 'rgba(0,0,0,.18)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
            <ItemIcon slot={d.slot} rarity={d.rarity} color={d.color} size={44} />
            <div style={{ color: RARITIES.find((r) => r.k === d.rarity)?.c, fontWeight: 800, fontSize: 12 }}>{d.name}</div>
            <div className="guide-p" style={{ fontSize: 11, margin: '2px 0 0' }}>
              +{d.bonus.amt}% {CHAR_STAT_LABEL[d.bonus.stat]}
            </div>
          </div>
        ))}
      </div>
      <p className="guide-p" style={{ fontSize: 12, marginTop: 8 }}>
        Wheel jackpots also include <strong className="guide-strong">Champion</strong> bull gear with stat rolls beyond
        the forge&apos;s best.
      </p>
    </div>
  );
}
