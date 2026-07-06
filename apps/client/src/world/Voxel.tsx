import { useMemo } from 'react';
import * as THREE from 'three';
import { ISO_SCALE_X, ISO_SCALE_Z, gridToWorld, shade } from '@bullrun/shared';

export function gridPos(x: number, y: number, height = 0): [number, number, number] {
  const [wx, , wz] = gridToWorld(x, y);
  return [wx, height, wz];
}

function diamondGeometry(x: number, y: number): THREE.BufferGeometry {
  const [x0, , z0] = gridPos(x, y);
  const [x1, , z1] = gridPos(x + 1, y);
  const [x2, , z2] = gridPos(x + 1, y + 1);
  const [x3, , z3] = gridPos(x, y + 1);
  const y0 = 0.02;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [x0, y0, z0, x1, y0, z1, x2, y0, z2, x0, y0, z0, x2, y0, z2, x3, y0, z3],
      3,
    ),
  );
  geo.computeVertexNormals();
  return geo;
}

export function VoxelBox({
  x, y, w, d, h, elev = 0, top,
}: {
  x: number; y: number; w: number; d: number; h: number; elev?: number;
  top: string; left: string; right: string;
}) {
  const [cx, , cz] = gridPos(x + w / 2, y + d / 2);
  const sx = Math.hypot(w * ISO_SCALE_X, w * ISO_SCALE_Z);
  const sz = Math.hypot(d * ISO_SCALE_X, d * ISO_SCALE_Z);
  return (
    <mesh position={[cx, elev + h / 2, cz]}>
      <boxGeometry args={[sx * 0.92, h, sz * 0.92]} />
      <meshLambertMaterial color={top} />
    </mesh>
  );
}

export function Tile({ x, y, color }: { x: number; y: number; color: string }) {
  const geometry = useMemo(() => diamondGeometry(x, y), [x, y]);
  return (
    <mesh geometry={geometry}>
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

export { shade };
