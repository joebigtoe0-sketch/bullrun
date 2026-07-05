import { gridToWorld, shade } from '@bullrun/shared';

export function gridPos(x: number, y: number, height = 0): [number, number, number] {
  const [wx, , wz] = gridToWorld(x, y);
  return [wx, height, wz];
}

export function VoxelBox({
  x, y, w, d, h, elev = 0, top, left, right,
}: {
  x: number; y: number; w: number; d: number; h: number; elev?: number;
  top: string; left: string; right: string;
}) {
  const [px, , pz] = gridPos(x, y, 0);
  return (
    <mesh position={[px + w / 2 - 0.5, elev + h / 2, pz + d / 2 - 0.5]}>
      <boxGeometry args={[w, h, d]} />
      <meshLambertMaterial color={top} />
    </mesh>
  );
}

export function Tile({ x, y, color }: { x: number; y: number; color: string }) {
  const pos = gridPos(x + 0.5, y + 0.5, 0);
  return (
    <mesh position={pos} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
      <planeGeometry args={[1.42, 1.42]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

export { shade };
