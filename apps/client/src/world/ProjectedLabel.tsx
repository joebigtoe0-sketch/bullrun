import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gridPos, ISO_H } from './Voxel';

/** Screen-space label — must return null (DOM lives outside the R3F tree). */
export function ProjectedLabel({
  gx,
  gy,
  yOff = 30,
  className = '',
  text,
}: {
  gx: number;
  gy: number;
  yOff?: number;
  className?: string;
  text: string;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const { camera, size } = useThree();
  const world = useRef(new THREE.Vector3());

  useEffect(() => {
    const root = document.querySelector('.game-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `world-label ${className}`.trim();
    el.style.cssText =
      'position:absolute;pointer-events:none;transform:translate(-50%,-100%);z-index:15;white-space:nowrap';
    el.textContent = text;
    root.appendChild(el);
    elRef.current = el;
    return () => {
      el.remove();
      elRef.current = null;
    };
  }, [className, text]);

  useFrame(() => {
    const el = elRef.current;
    if (!el) return;
    const [wx, , wz] = gridPos(gx, gy, yOff * ISO_H);
    world.current.set(wx, yOff * ISO_H, wz);
    world.current.project(camera);
    if (world.current.z > 1) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.left = `${(world.current.x * 0.5 + 0.5) * size.width}px`;
    el.style.top = `${(-world.current.y * 0.5 + 0.5) * size.height}px`;
  });

  return null;
}
