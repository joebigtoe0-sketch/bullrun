import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gridPos, ISO_H } from './Voxel';

export function ProjectedLabel({
  gx,
  gy,
  yOff = 30,
  className = '',
  children,
}: {
  gx: number;
  gy: number;
  yOff?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { camera, size } = useThree();
  const world = useRef(new THREE.Vector3());

  useFrame(() => {
    const el = ref.current;
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

  const root = typeof document !== 'undefined' ? document.querySelector('.game-root') : null;
  if (!root) return null;

  return createPortal(
    <div
      ref={ref}
      className={`world-label ${className}`.trim()}
      style={{ position: 'absolute', pointerEvents: 'none', transform: 'translate(-50%, -100%)', zIndex: 15 }}
    >
      {children}
    </div>,
    root,
  );
}
