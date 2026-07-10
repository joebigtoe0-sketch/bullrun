import { useEffect, useRef, useState } from 'react';

/**
 * Cinematic image backdrop:
 *  - hero image (drop into apps/client/public/ as landing-hero.webp/png/jpg)
 *    with a slow Ken Burns pan/zoom
 *  - drifting translucent cloud layer + rising light motes on a canvas overlay
 *  - readability scrim
 * Falls back to a sky gradient when no image is present.
 */

const HERO_CANDIDATES = ['/landing-hero.webp', '/landing-hero.png', '/landing-hero.jpg'];

let cachedHero: string | null | undefined;

function useHeroImage(): string | null | undefined {
  const [src, setSrc] = useState<string | null | undefined>(cachedHero);

  useEffect(() => {
    if (cachedHero !== undefined) return;
    let alive = true;
    (async () => {
      for (const candidate of HERO_CANDIDATES) {
        const ok = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = candidate;
        });
        if (!alive) return;
        if (ok) {
          cachedHero = candidate;
          setSrc(candidate);
          return;
        }
      }
      cachedHero = null;
      setSrc(null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return src;
}

function OverlayFx({ dim }: { dim: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const motes = Array.from({ length: 26 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.7 + Math.random() * 1.7,
      v: 0.008 + Math.random() * 0.02,
      drift: (Math.random() - 0.5) * 0.01,
      tw: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // rising light motes
      for (const m of motes) {
        m.y -= m.v * dt;
        m.x += m.drift * dt;
        m.tw += dt * 2;
        if (m.y < -0.02) {
          m.y = 1.02;
          m.x = Math.random();
        }
        const a = (0.18 + 0.14 * Math.sin(m.tw)) * (dim ? 0.6 : 1);
        ctx.fillStyle = `rgba(255,240,190,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [dim]);

  return <canvas ref={ref} className="hero-overlay" aria-hidden />;
}

export function HeroBackdrop({ variant = 'landing' }: { variant?: 'landing' | 'loading' }) {
  const hero = useHeroImage();
  const blurred = variant === 'loading';

  return (
    <div className="hero-backdrop" aria-hidden>
      {hero ? (
        <div
          className={`hero-image${blurred ? ' hero-image--blurred' : ''}`}
          style={{ backgroundImage: `url(${hero})` }}
        />
      ) : (
        <div className="hero-fallback" />
      )}
      <OverlayFx dim={blurred} />
      <div className={`hero-scrim${blurred ? ' hero-scrim--loading' : ''}`} />
    </div>
  );
}
