import { useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  TILE_COLORS,
  WORLD_CX,
  WORLD_CY,
  WORLD_RX,
  WORLD_RY,
  fmtCountdown,
  nodeId,
  shade,
  trackClamp,
  worldToGrid,
} from '@bullrun/shared';
import { useGameStore, worldData } from '../store/gameStore';
import { IsoCube, Tile, gridPos, ISO_H } from './Voxel';
import { ProjectedLabel } from './ProjectedLabel';
import { handleWorldClick } from '../game/loop';

function Shadow({ x, y, rx, rz }: { x: number; y: number; rx: number; rz: number }) {
  const [gx, , gz] = gridPos(x, y, 0.02);
  return (
    <mesh position={[gx, 0.02, gz]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, rz, 1]}>
      <circleGeometry args={[rx, 16]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.18} />
    </mesh>
  );
}

function Tree({ x, y, big, dead }: { x: number; y: number; big?: boolean; dead?: boolean }) {
  if (dead) return <IsoCube x={x - 0.16} y={y - 0.16} w={0.32} d={0.32} h={6} top="#8a6a44" left="#5e4527" right="#6f5432" />;
  const s = big ? 1.25 : 1;
  return (
    <group>
      <IsoCube x={x - 0.14} y={y - 0.14} w={0.28 * s} d={0.28 * s} h={10 * s} top="#8a6a44" left="#5e4527" right="#6f5432" />
      <IsoCube x={x - 0.5 * s} y={y - 0.5 * s} w={1 * s} d={1 * s} h={13 * s} elev={10 * s} top="#4fae3d" left="#2e7a22" right="#3d942e" />
      <IsoCube x={x - 0.32 * s} y={y - 0.32 * s} w={0.64 * s} d={0.64 * s} h={10 * s} elev={23 * s} top="#5cbf48" left="#37852a" right="#47a136" />
    </group>
  );
}

function Rock({ x, y, dead }: { x: number; y: number; dead?: boolean }) {
  if (dead) return <IsoCube x={x - 0.2} y={y - 0.2} w={0.4} d={0.4} h={4} top="#9a9a95" left="#6f6f6a" right="#84847f" />;
  return (
    <group>
      <IsoCube x={x - 0.4} y={y - 0.3} w={0.8} d={0.6} h={12} top="#b0b0aa" left="#7c7c76" right="#94948e" />
      <IsoCube x={x + 0.05} y={y - 0.5} w={0.45} d={0.45} h={8} top="#a5a59f" left="#73736d" right="#8a8a84" />
    </group>
  );
}

function Hay({ x, y, dead }: { x: number; y: number; dead?: boolean }) {
  if (dead) return null;
  return (
    <group>
      <IsoCube x={x - 0.35} y={y - 0.3} w={0.7} d={0.6} h={9} top="#e0c96a" left="#a8913c" right="#c4ad50" />
      <IsoCube x={x - 0.2} y={y - 0.15} w={0.4} d={0.35} h={6} elev={9} top="#e8d47e" left="#b09a48" right="#ccb65c" />
    </group>
  );
}

function ForgeFire({ x, y }: { x: number; y: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const [gx, , gz] = gridPos(x + 0.45, y - 0.15, 20 * ISO_H);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.MeshBasicMaterial;
    m.opacity = 0.5 + 0.3 * Math.sin(clock.elapsedTime * 4);
  });
  return (
    <mesh ref={ref} position={[gx, 20 * ISO_H + 0.14, gz]}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshBasicMaterial color="#f08c3c" transparent opacity={0.7} />
    </mesh>
  );
}

function Building({ o }: { o: { t: string; x: number; y: number; label?: string } }) {
  const { t, x, y, label } = o;
  const stableLvl = useGameStore((s) => s.me?.stable.level ?? 1);

  if (t === 'house') {
    return (
      <group>
        <IsoCube x={x - 1} y={y - 1} w={2} d={2} h={26} top="#d9c49a" left="#8f7a52" right="#b8a271" />
        <IsoCube x={x - 1.15} y={y - 1.15} w={2.3} d={2.3} h={10} elev={26} top="#6b4a33" left="#41291a" right="#553a26" />
        <IsoCube x={x - 0.06} y={y + 0.85} w={0.24} d={0.12} h={20} top="#41291a" left="#2a1a10" right="#352015" />
        <IsoCube x={x + 0.85} y={y - 0.05} w={0.2} d={0.1} h={9} top="#a8d8e8" left="#7aa8b8" right="#8cb8c8" />
      </group>
    );
  }
  if (t === 'stable') {
    return (
      <group>
        <IsoCube x={x - 1.2} y={y - 1} w={2.4} d={2} h={24} top="#c9a06a" left="#8a6538" right="#a8814d" />
        <IsoCube x={x - 1.35} y={y - 1.15} w={2.7} d={2.3} h={10} elev={24} top="#8e3b2e" left="#5e2119" right="#762e23" />
        <IsoCube x={x - 0.18} y={y + 0.85} w={0.36} d={0.12} h={22} top="#41291a" left="#2a1a10" right="#352015" />
        {label && (
          <ProjectedLabel gx={x} gy={y} yOff={46} className="gold">
            {label} · Lv {stableLvl}
          </ProjectedLabel>
        )}
      </group>
    );
  }
  if (t === 'booth') {
    return (
      <group>
        <IsoCube x={x - 0.8} y={y - 0.6} w={1.6} d={1.2} h={18} top="#3b6ea5" left="#22436a" right="#2d5787" />
        <IsoCube x={x - 0.95} y={y - 0.75} w={1.9} d={1.5} h={6} elev={18} top="#e8e0cc" left="#b0a88f" right="#ccc4ab" />
        {label && <ProjectedLabel gx={x} gy={y} yOff={36} className="cyan">{label}</ProjectedLabel>}
      </group>
    );
  }
  if (t === 'market') {
    return (
      <group>
        <IsoCube x={x - 0.9} y={y - 0.6} w={1.8} d={1.2} h={16} top="#a5522f" left="#6e321a" right="#8a4224" />
        <IsoCube x={x - 1.05} y={y - 0.75} w={2.1} d={1.5} h={6} elev={16} top="#e0c96a" left="#a8913c" right="#c4ad50" />
        {label && <ProjectedLabel gx={x} gy={y} yOff={34} className="gold">{label}</ProjectedLabel>}
      </group>
    );
  }
  if (t === 'forge') {
    return (
      <group>
        <IsoCube x={x - 0.9} y={y - 0.7} w={1.8} d={1.4} h={20} top="#6a6a66" left="#44443f" right="#57574f" />
        <IsoCube x={x + 0.25} y={y - 0.35} w={0.4} d={0.4} h={10} elev={20} top="#4a4a45" left="#2e2e2a" right="#3c3c37" />
        <ForgeFire x={x} y={y} />
        {label && <ProjectedLabel gx={x} gy={y} yOff={40} className="orange">{label}</ProjectedLabel>}
      </group>
    );
  }
  if (t === 'sign') {
    return (
      <group>
        <IsoCube x={x - 0.06} y={y - 0.06} w={0.12} d={0.12} h={16} top="#8a6a44" left="#5e4527" right="#6f5432" />
        {label && <ProjectedLabel gx={x} gy={y} yOff={20} className="gold">{label}</ProjectedLabel>}
      </group>
    );
  }
  if (t === 'post') {
    return (
      <group>
        <IsoCube x={x - 0.08} y={y - 0.08} w={0.16} d={0.16} h={13} top="#e0c96a" left="#a8913c" right="#c4ad50" />
        <IsoCube x={x - 0.05} y={y - 0.05} w={0.1} d={0.1} h={2} elev={13} top="#f2b23a" left="#b57f1d" right="#d0991f" />
      </group>
    );
  }
  return null;
}

function Avatar({ x, y, shirt, label, isMe }: { x: number; y: number; shirt: string; label: string; isMe?: boolean }) {
  const c = shirt;
  return (
    <group>
      <Shadow x={x} y={y} rx={0.35} rz={0.5} />
      <IsoCube x={x - 0.18} y={y - 0.13} w={0.36} d={0.26} h={13} elev={3} top={c} left={shade(c, -40)} right={shade(c, -20)} />
      <IsoCube x={x - 0.14} y={y - 0.11} w={0.28} d={0.22} h={9} elev={16} top="#e8c49a" left="#b08d64" right="#cca87d" />
      <IsoCube x={x - 0.14} y={y - 0.11} w={0.28} d={0.22} h={3} elev={25} top="#3a2a1a" left="#241608" right="#2f2012" />
      <ProjectedLabel gx={x} gy={y} yOff={40} className={isMe ? 'gold' : 'white'}>{label}</ProjectedLabel>
    </group>
  );
}

function BullAvatar({ x, y, coat, label }: { x: number; y: number; coat: string; label?: string }) {
  const c = coat;
  return (
    <group>
      <Shadow x={x} y={y} rx={0.45} rz={0.55} />
      <IsoCube x={x - 0.45} y={y - 0.22} w={0.9} d={0.44} h={11} elev={5} top={c} left={shade(c, -35)} right={shade(c, -18)} />
      <IsoCube x={x + 0.28} y={y - 0.18} w={0.34} d={0.36} h={9} elev={10} top={c} left={shade(c, -35)} right={shade(c, -18)} />
      <IsoCube x={x + 0.3} y={y - 0.3} w={0.1} d={0.1} h={5} elev={19} top="#e8e4da" left="#b0ac9f" right="#ccc8bb" />
      <IsoCube x={x + 0.3} y={y + 0.22} w={0.1} d={0.1} h={5} elev={19} top="#e8e4da" left="#b0ac9f" right="#ccc8bb" />
      <IsoCube x={x - 0.38} y={y - 0.16} w={0.14} d={0.12} h={5} top={shade(c, -25)} left={shade(c, -50)} right={shade(c, -35)} />
      <IsoCube x={x + 0.24} y={y - 0.16} w={0.14} d={0.12} h={5} top={shade(c, -25)} left={shade(c, -50)} right={shade(c, -35)} />
      {label && <ProjectedLabel gx={x} gy={y} yOff={34} className="white">{label}</ProjectedLabel>}
    </group>
  );
}

function RaceRing({ er, color }: { er: number; color: string }) {
  const line = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const bx = WORLD_CX + Math.cos(a) * WORLD_RX * er;
      const by = WORLD_CY + Math.sin(a) * WORLD_RY * er;
      const [px, py, pz] = gridPos(bx, by, 0.04);
      pts.push(px, py, pz);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  }, [er, color]);

  return <primitive object={line} />;
}

function FinishLine() {
  const line = useMemo(() => {
    const p1 = gridPos(WORLD_CX, WORLD_CY + WORLD_RY * 0.82, 0.05);
    const p2 = gridPos(WORLD_CX, WORLD_CY + WORLD_RY * 1.18, 0.05);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...p1, ...p2]), 3));
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffffff', linewidth: 2 }));
  }, []);
  return <primitive object={line} />;
}

function InfieldBoard() {
  const me = useGameStore((s) => s.me);
  const raceLive = useGameStore((s) => s.raceLive);
  const text = raceLive ? 'RACING!' : me?.race ? `NEXT RACE ${fmtCountdown(new Date(me.race.startAt).getTime() - Date.now())}` : 'NEXT RACE';
  return (
    <group>
      <IsoCube x={WORLD_CX - 0.08} y={WORLD_CY - 0.08} w={0.16} d={0.16} h={20} top="#8a6a44" left="#5e4527" right="#6f5432" />
      <ProjectedLabel gx={WORLD_CX} gy={WORLD_CY} yOff={44} className={raceLive ? 'green' : 'gold'}>
        {text}
      </ProjectedLabel>
    </group>
  );
}

function MoveMarker({ x, y }: { x: number; y: number }) {
  const [gx, , gz] = gridPos(x, y, 0.06);
  return (
    <mesh position={[gx, 0.06, gz]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.12, 0.2, 24]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.75} />
    </mesh>
  );
}

function GroundClick() {
  const [cx, , cz] = gridPos(WORLD_CX, WORLD_CY);
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[cx, 0, cz]}
      onClick={(e) => {
        e.stopPropagation();
        const { x, y } = worldToGrid(e.point.x, e.point.z);
        handleWorldClick(x, y);
      }}
    >
      <planeGeometry args={[220, 220]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

function useNpcWanderers() {
  const [npcs, setNpcs] = useState(() =>
    worldData.npcs.map((n) => ({ ...n, wait: n.wait ?? 0 })),
  );

  useFrame((_, dt) => {
    setNpcs((prev) => {
      let changed = false;
      const next = prev.map((n) => {
        const copy = { ...n };
        if (copy.wait > 0) {
          copy.wait -= dt;
          changed = true;
          return copy;
        }
        const d = Math.hypot(copy.tx - copy.x, copy.ty - copy.y);
        if (d < 0.2) {
          copy.tx = 4 + Math.random() * (worldData.M - 8);
          copy.ty = 4 + Math.random() * (worldData.M - 10);
          copy.wait = 1 + Math.random() * 4;
          changed = true;
          return copy;
        }
        copy.x += ((copy.tx - copy.x) / d) * 1.6 * dt;
        copy.y += ((copy.ty - copy.y) / d) * 1.6 * dt;
        if (trackClamp(copy, WORLD_CX, WORLD_CY, WORLD_RX, WORLD_RY)) {
          copy.tx = copy.x;
          copy.ty = copy.y;
          copy.wait = 0.5;
        }
        changed = true;
        return copy;
      });
      return changed ? next : prev;
    });
  });

  return npcs;
}

type SceneEntity = { d: number; key: string; node: ReactNode };

export function WorldScene() {
  const me = useGameStore((s) => s.me);
  const others = useGameStore((s) => s.otherPlayers);
  const nodeDead = useGameStore((s) => s.nodeDead);
  const raceAnim = useGameStore((s) => s.raceAnim);
  const moveTarget = useGameStore((s) => s.moveTarget);
  const npcs = useNpcWanderers();

  const tiles = useMemo(() => {
    const list: { x: number; y: number; color: string }[] = [];
    for (let x = 0; x < worldData.M; x++)
      for (let y = 0; y < worldData.M; y++)
        list.push({ x, y, color: TILE_COLORS[worldData.tiles[x][y]] });
    return list;
  }, []);

  const raceBulls = useMemo(() => {
    if (!raceAnim) return [];
    const el = Date.now() - raceAnim.startT;
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
  }, [raceAnim]);

  const sortedEntities = useMemo(() => {
    const now = Date.now();
    const list: SceneEntity[] = [];

    for (let i = 0; i < worldData.objs.length; i++) {
      const o = worldData.objs[i];
      const d = o.x + o.y;
      if (o.t === 'tree' || o.t === 'rock' || o.t === 'hay') {
        const id = nodeId(o.x, o.y, o.mat!);
        const dead = !!(nodeDead[id] && nodeDead[id] > now);
        let node: React.ReactNode = null;
        if (o.t === 'tree') node = <Tree x={o.x} y={o.y} big={o.big} dead={dead} />;
        if (o.t === 'rock') node = <Rock x={o.x} y={o.y} dead={dead} />;
        if (o.t === 'hay') node = <Hay x={o.x} y={o.y} dead={dead} />;
        if (node) list.push({ d, key: `obj-${i}`, node });
      } else {
        list.push({ d, key: `bld-${i}`, node: <Building o={o} /> });
      }
    }

    worldData.npcs.forEach((_, i) => {
      const n = npcs[i];
      if (!n) return;
      list.push({
        d: n.x + n.y,
        key: `npc-${i}`,
        node: <Avatar x={n.x} y={n.y} shirt={n.shirt} label={`Lvl ${n.lvl} ${n.name}`} />,
      });
    });

    if (me) {
      list.push({
        d: me.position.x + me.position.y,
        key: 'player',
        node: <Avatar x={me.position.x} y={me.position.y} shirt="#e8a33d" label="You" isMe />,
      });
    }

    others.forEach((p) => {
      list.push({
        d: p.x + p.y,
        key: `oth-${p.id}`,
        node: <Avatar x={p.x} y={p.y} shirt={p.shirt} label={p.displayName} />,
      });
    });

    raceBulls.forEach((b, i) => {
      list.push({
        d: b.x + b.y,
        key: `rb-${i}`,
        node: <BullAvatar x={b.x} y={b.y} coat={b.coat} label={b.name} />,
      });
    });

    list.sort((a, b) => a.d - b.d);
    return list;
  }, [me, others, nodeDead, raceBulls, npcs]);

  return (
    <group>
      <ambientLight intensity={1} />
      {tiles.map((t) => <Tile key={`${t.x}-${t.y}`} {...t} />)}
      <RaceRing er={0.82} color="#f5f0e4" />
      <RaceRing er={1.18} color="#f5f0e4" />
      <FinishLine />
      <InfieldBoard />
      {sortedEntities.map((e) => (
        <group key={e.key}>{e.node}</group>
      ))}
      {moveTarget && <MoveMarker x={moveTarget.x} y={moveTarget.y} />}
      <GroundClick />
    </group>
  );
}
