import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { useGameStore } from '../store/gameStore';
import { WorldScene } from './WorldScene';
import { gridToWorld } from '@bullrun/shared';

function GameCamera() {
  const cam = useGameStore((s) => s.cam);
  const [wx, , wz] = gridToWorld(cam.x, cam.y);
  return (
    <OrthographicCamera
      makeDefault
      position={[wx - 20, 30, wz + 20]}
      zoom={28}
      near={0.1}
      far={500}
      onUpdate={(c) => c.lookAt(wx, 0, wz)}
    />
  );
}

export function GameCanvas() {
  return (
    <Canvas style={{ position: 'absolute', inset: 0 }} gl={{ antialias: true }}>
      <color attach="background" args={['#69a949']} />
      <GameCamera />
      <WorldScene />
    </Canvas>
  );
}
