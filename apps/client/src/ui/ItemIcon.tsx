import { useEffect, useRef } from 'react';
import { BRArt } from '../world/canvas/bullrunArt';

/** Canvas icon for an equippable item, drawn with the shared BRArt item art. */
export function ItemIcon({ slot, rarity, color, size = 44 }: { slot: string; rarity: string; color?: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    // item art spans roughly ±22px around iso(0,0), from ~-20px up to ~+9px down
    const scale = size / 52;
    ctx.translate(size / 2, size * 0.68);
    ctx.scale(scale, scale);
    BRArt.drawItem(ctx, BRArt.iso, slot, rarity, color);
    ctx.restore();
  }, [slot, rarity, color, size]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size, flex: '0 0 auto', imageRendering: 'auto' }}
      aria-hidden
    />
  );
}
