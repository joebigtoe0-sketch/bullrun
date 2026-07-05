import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { TILE_COLORS, WORLD_CX, WORLD_CY, WORLD_RX, WORLD_RY, nodeId, shade } from '@bullrun/shared';
import { useGameStore, worldData } from '../store/gameStore';
import { VoxelBox, Tile, gridPos } from './Voxel';
import { handleWorldClick } from '../game/loop';

function Tree({ x, y, big, dead }: { x: number; y: number; big?: boolean; dead?: boolean }) {
  if (dead) return <VoxelBox x={x - 0.16} y={y - 0.16} w={0.32} h={0.12} d={0.32} top="#8a6a44" left="#5e4527" right="#6f5432" />;
  const s = big ? 1.25 : 1;
  return (
    <group>
      <VoxelBox x={x - 0.14} y={y - 0.14} w={0.28 * s} h={0.2 * s} d={0.28 * s} top="#8a6a44" left="#5e4527" right="#6f5432" />
      <VoxelBox x={x - 0.5 * s} y={y - 0.5 * s} w={1 * s} h={0.26 * s} d={1 * s} elev={0.2 * s} top="#4fae3d" left="#2e7a22" right="#3d942e" />
      <VoxelBox x={x - 0.32 * s} y={y - 0.32 * s} w={0.64 * s} h={0.2 * s} d={0.64 * s} elev={0.46 * s} top="#5cbf48" left="#37852a" right="#47a136" />
    </group>
  );
}

function Rock({ x, y, dead }: { x: number; y: number; dead?: boolean }) {
  if (dead) return <VoxelBox x={x - 0.2} y={y - 0.2} w={0.4} h={0.08} d={0.4} top="#9a9a95" left="#6f6f6a" right="#84847f" />;
  return (
    <group>
      <VoxelBox x={x - 0.4} y={y - 0.3} w={0.8} h={0.24} d={0.6} top="#b0b0aa" left="#7c7c76" right="#94948e" />
      <VoxelBox x={x + 0.05} y={y - 0.5} w={0.45} h={0.16} d={0.45} top="#a5a59f" left="#73736d" right="#8a8a84" />
    </group>
  );
}

function Hay({ x, y, dead }: { x: number; y: number; dead?: boolean }) {
  if (dead) return null;
  return (
    <group>
      <VoxelBox x={x - 0.35} y={y - 0.3} w={0.7} h={0.18} d={0.6} top="#e0c96a" left="#a8913c" right="#c4ad50" />
      <VoxelBox x={x - 0.2} y={y - 0.15} w={0.4} h={0.12} d={0.35} elev={0.18} top="#e8d47e" left="#b09a48" right="#ccb65c" />
    </group>
  );
}

function Building({ o }: { o: { t: string; x: number; y: number; label?: string } }) {
  const { t, x, y, label } = o;
  if (t === 'house') return (
    <group>
      <VoxelBox x={x - 1} y={y - 1} w={2} h={0.52} d={2} top="#d9c49a" left="#8f7a52" right="#b8a271" />
      <VoxelBox x={x - 1.15} y={y - 1.15} w={2.3} h={0.2} d={2.3} elev={0.52} top="#6b4a33" left="#41291a" right="#553a26" />
    </group>
  );
  if (t === 'stable') {
    const lvl = useGameStore.getState().me?.stable.level ?? 1;
    return (
      <group>
        <VoxelBox x={x - 1.2} y={y - 1} w={2.4} h={0.48} d={2} top="#c9a06a" left="#8a6538" right="#a8814d" />
        <VoxelBox x={x - 1.35} y={y - 1.15} w={2.7} h={0.2} d={2.3} elev={0.48} top="#8e3b2e" left="#5e2119" right="#762e23" />
        <Html position={gridPos(x, y, 1.2)} center distanceFactor={12}>
          <div className="world-label gold">{label} · Lv {lvl}</div>
        </Html>
      </group>
    );
  }
  if (t === 'booth') return (
    <group>
      <VoxelBox x={x - 0.8} y={y - 0.6} w={1.6} h={0.36} d={1.2} top="#3b6ea5" left="#22436a" right="#2d5787" />
      <VoxelBox x={x - 0.95} y={y - 0.75} w={1.9} h={0.12} d={1.5} elev={0.36} top="#e8e0cc" left="#b0a88f" right="#ccc4ab" />
      <Html position={gridPos(x, y, 0.8)} center distanceFactor={12}><div className="world-label cyan">{label}</div></Html>
    </group>
  );
  if (t === 'market') return (
    <group>
      <VoxelBox x={x - 0.9} y={y - 0.6} w={1.8} h={0.32} d={1.2} top="#a5522f" left="#6e321a" right="#8a4224" />
      <VoxelBox x={x - 1.05} y={y - 0.75} w={2.1} h={0.12} d={1.5} elev={0.32} top="#e0c96a" left="#a8913c" right="#c4ad50" />
      <Html position={gridPos(x, y, 0.7)} center distanceFactor={12}><div className="world-label gold">{label}</div></Html>
    </group>
  );
  if (t === 'forge') return (
    <group>
      <VoxelBox x={x - 0.9} y={y - 0.7} w={1.8} h={0.4} d={1.4} top="#6a6a66" left="#44443f" right="#57574f" />
      <Html position={gridPos(x, y, 0.9)} center distanceFactor={12}><div className="world-label orange">{label}</div></Html>
    </group>
  );
  if (t === 'sign') return (
    <group>
      <VoxelBox x={x - 0.06} y={y - 0.06} w={0.12} h={0.32} d={0.12} top="#8a6a44" left="#5e4527" right="#6f5432" />
      <Html position={gridPos(x, y, 0.6)} center distanceFactor={12}><div className="world-label gold">{label}</div></Html>
    </group>
  );
  if (t === 'post') return (
    <group>
      <VoxelBox x={x - 0.08} y={y - 0.08} w={0.16} h={0.26} d={0.16} top="#e0c96a" left="#a8913c" right="#c4ad50" />
      <VoxelBox x={x - 0.05} y={y - 0.05} w={0.1} h={0.04} d={0.1} elev={0.26} top="#f2b23a" left="#b57f1d" right="#d0991f" />
    </group>
  );
  return null;
}

function Avatar({ x, y, shirt, label, isMe }: { x: number; y: number; shirt: string; label: string; isMe?: boolean }) {
  const c = shirt;
  return (
    <group position={gridPos(x, y)}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
      <VoxelBox x={x - 0.18} y={y - 0.13} w={0.36} h={0.26} d={0.26} elev={0.06} top={c} left={shade(c, -40)} right={shade(c, -20)} />
      <VoxelBox x={x - 0.14} y={y - 0.11} w={0.28} h={0.18} d={0.22} elev={0.32} top="#e8c49a" left="#b08d64" right="#cca87d" />
      <Html position={[0, 1.1, 0]} center distanceFactor={10}>
        <div className={`world-label ${isMe ? 'gold' : 'white'}`}>{label}</div>
      </Html>
    </group>
  );
}

function BullAvatar({ x, y, coat, label }: { x: number; y: number; coat: string; label?: string }) {
  const c = coat;
  return (
    <group position={gridPos(x, y)}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
      <VoxelBox x={x - 0.45} y={y - 0.22} w={0.9} h={0.22} d={0.44} elev={0.1} top={c} left={shade(c, -35)} right={shade(c, -18)} />
      <VoxelBox x={x + 0.28} y={y - 0.18} w={0.34} h={0.18} d={0.36} elev={0.2} top={c} left={shade(c, -35)} right={shade(c, -18)} />
      {label && (
        <Html position={[0, 0.9, 0]} center distanceFactor={10}>
          <div className="world-label white">{label}</div>
        </Html>
      )}
    </group>
  );
}

function RaceTrack() {
  const pts: number[] = [];
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const bx = WORLD_CX + Math.cos(a) * WORLD_RX * 0.88;
    const by = WORLD_CY + Math.sin(a) * WORLD_RY * 0.88;
    const [x, y, z] = gridPos(bx, by, 0.05);
    pts.push(x, y, z);
  }
  return (
    <line>
      <bufferGeometry attach="geometry">
        <bufferAttribute attach="attributes-position" args={[new Float32Array(pts), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#f5f0e4" linewidth={2} />
    </line>
  );
}

function GroundClick() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, Math.PI / 4]}
      position={[0, 0, 26]}
      onClick={(e) => {
        e.stopPropagation();
        const p = e.point;
        const wx = (p.z / 1 + p.x / 2) / 2;
        const wy = (p.z / 1 - p.x / 2) / 2;
        handleWorldClick(wx, wy);
      }}
    >
      <planeGeometry args={[120, 120]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

export function WorldScene() {
  const me = useGameStore((s) => s.me);
  const others = useGameStore((s) => s.otherPlayers);
  const nodeDead = useGameStore((s) => s.nodeDead);
  const raceAnim = useGameStore((s) => s.raceAnim);
  const cam = useGameStore((s) => s.cam);
  const moveTarget = useGameStore((s) => s.moveTarget);
  const now = Date.now();

  const tiles = useMemo(() => {
    const list: { x: number; y: number; color: string }[] = [];
    for (let x = 0; x < worldData.M; x++)
      for (let y = 0; y < worldData.M; y++)
        list.push({ x, y, color: TILE_COLORS[worldData.tiles[x][y]] });
    return list;
  }, []);

  const raceBulls = useMemo(() => {
    if (!raceAnim) return [];
    const el = now - raceAnim.startT;
    return raceAnim.bulls.map((b) => {
      const prog = Math.min(1, el / b.finishT);
      const a = Math.PI / 2 + prog * Math.PI * 2;
      const er = 0.88 + (b.pos % 3) * 0.1;
      return {
        ...b,
        x: WORLD_CX + Math.cos(a) * WORLD_RX * er,
        y: WORLD_CY + Math.sin(a) * WORLD_RY * er,
      };
    });
  }, [raceAnim, now]);

  const camPos = gridPos(cam.x, cam.y, 0);

  return (
    <group>
      <ambientLight intensity={0.85} />
      <directionalLight position={[10, 20, 10]} intensity={0.6} />
      {tiles.map((t) => <Tile key={`${t.x}-${t.y}`} {...t} />)}
      <RaceTrack />
      {worldData.objs.map((o: import('@bullrun/shared').WorldObject, i: number) => {
        if (o.t === 'tree' || o.t === 'rock' || o.t === 'hay') {
          const id = nodeId(o.x, o.y, o.mat!);
          const dead = !!(nodeDead[id] && nodeDead[id] > now);
          if (o.t === 'tree') return <Tree key={i} x={o.x} y={o.y} big={o.big} dead={dead} />;
          if (o.t === 'rock') return <Rock key={i} x={o.x} y={o.y} dead={dead} />;
          if (o.t === 'hay') return <Hay key={i} x={o.x} y={o.y} dead={dead} />;
        }
        return <Building key={i} o={o} />;
      })}
      {worldData.npcs.map((n: import('@bullrun/shared').NpcWanderer, i: number) => (
        <Avatar key={i} x={n.x} y={n.y} shirt={n.shirt} label={`Lvl ${n.lvl} ${n.name}`} />
      ))}
      {me && <Avatar x={me.position.x} y={me.position.y} shirt="#e8a33d" label="You" isMe />}
      {others.map((p) => (
        <Avatar key={p.id} x={p.x} y={p.y} shirt={p.shirt} label={p.displayName} />
      ))}
      {raceBulls.map((b, i) => (
        <BullAvatar key={i} x={b.x} y={b.y} coat={b.coat} label={b.name} />
      ))}
      {moveTarget && (
        <mesh position={gridPos(moveTarget.x, moveTarget.y, 0.1)} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.35, 24]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
        </mesh>
      )}
      <GroundClick />
      <group position={camPos} />
    </group>
  );
}
