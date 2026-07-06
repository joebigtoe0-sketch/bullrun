import { useMemo } from 'react';
import * as THREE from 'three';
import { gridToWorld, shade } from '@bullrun/shared';

/** Prototype cube heights are in screen pixels — scale to world Y */
export const ISO_H = 0.02;

export function gridPos(x: number, y: number, height = 0): [number, number, number] {
  const [wx, , wz] = gridToWorld(x, y);
  return [wx, height, wz];
}

function corner(x: number, y: number, yElev: number): THREE.Vector3 {
  const [wx, , wz] = gridPos(x, y);
  return new THREE.Vector3(wx, yElev, wz);
}

function Quad({ a, b, c, d, color }: {
  a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; d: THREE.Vector3; color: string;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z],
        3,
      ),
    );
    geo.computeVertexNormals();
    return geo;
  }, [a, b, c, d]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Isometric voxel cube — matches prototype cube() with top / left / right faces */
export function IsoCube({
  x, y, w, d, h, elev = 0, top, left, right,
}: {
  x: number; y: number; w: number; d: number; h: number; elev?: number;
  top: string; left: string; right: string;
}) {
  const e = elev * ISO_H;
  const hh = e + h * ISO_H;
  const c1 = corner(x, y, e);
  const c2 = corner(x + w, y, e);
  const c3 = corner(x + w, y + d, e);
  const c4 = corner(x, y + d, e);
  const c1t = corner(x, y, hh);
  const c2t = corner(x + w, y, hh);
  const c3t = corner(x + w, y + d, hh);
  const c4t = corner(x, y + d, hh);

  return (
    <group>
      <Quad a={c2t} b={c3t} c={c3} d={c2} color={right} />
      <Quad a={c4t} b={c3t} c={c3} d={c4} color={left} />
      <Quad a={c1t} b={c2t} c={c3t} d={c4t} color={top} />
    </group>
  );
}

function diamondGeometry(x: number, y: number): THREE.BufferGeometry {
  const [x0, , z0] = gridPos(x, y);
  const [x1, , z1] = gridPos(x + 1, y);
  const [x2, , z2] = gridPos(x + 1, y + 1);
  const [x3, , z3] = gridPos(x, y + 1);
  const y0 = 0.01;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [x0, y0, z0, x1, y0, z1, x2, y0, z2, x0, y0, z0, x2, y0, z2, x3, y0, z3],
      3,
    ),
  );
  return geo;
}

export function Tile({ x, y, color }: { x: number; y: number; color: string }) {
  const geometry = useMemo(() => diamondGeometry(x, y), [x, y]);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

export { shade };
