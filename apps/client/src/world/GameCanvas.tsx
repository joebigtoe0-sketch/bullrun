import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import type { OrthographicCamera as ThreeOrthoCam } from 'three';
import { useGameStore } from '../store/gameStore';
import { WorldScene } from './WorldScene';
import { gridToWorld } from '@bullrun/shared';

function GameCamera() {
  const cam = useGameStore((s) => s.cam);
  const cameraRef = useRef<ThreeOrthoCam>(null);

  useFrame(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const [wx, , wz] = gridToWorld(cam.x, cam.y);
    camera.position.set(wx - 20, 30, wz + 20);
    camera.lookAt(wx, 0, wz);
    camera.updateProjectionMatrix();
  });

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      zoom={28}
      near={0.1}
      far={500}
    />
  );
}

export function GameCanvas() {
  return (
    <Canvas style={{ position: 'absolute', inset: 0 }} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={['#69a949']} />
      <GameCamera />
      <WorldScene />
    </Canvas>
  );
}
