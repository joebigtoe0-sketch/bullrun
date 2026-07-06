import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import type { OrthographicCamera as ThreeOrthoCam } from 'three';
import { useGameStore } from '../store/gameStore';
import { WorldScene } from './WorldScene';
import { gridToWorld } from '@bullrun/shared';

const ISO_CAM_DIST = 24;
const ISO_CAM_HEIGHT = 28;
const ISO_ZOOM = 24;

function GameCamera() {
  const cam = useGameStore((s) => s.cam);
  const cameraRef = useRef<ThreeOrthoCam>(null);

  useFrame(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const [wx, , wz] = gridToWorld(cam.x, cam.y);
    camera.position.set(wx - ISO_CAM_DIST, ISO_CAM_HEIGHT, wz + ISO_CAM_DIST);
    camera.lookAt(wx, 0, wz);
    camera.zoom = ISO_ZOOM;
    camera.updateProjectionMatrix();
  });

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      zoom={ISO_ZOOM}
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
