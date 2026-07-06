import type { ReactNode } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';

interface WorldLabelProps {
  position: [number, number, number];
  children: ReactNode;
  className?: string;
}

export function WorldLabel({ position, children, className = '' }: WorldLabelProps) {
  const camera = useThree((s) => s.camera);
  const distanceFactor =
    camera.type === 'OrthographicCamera'
      ? (camera as OrthographicCamera).zoom * 100
      : 12;

  return (
    <Html
      position={position}
      center
      distanceFactor={distanceFactor}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div className={`world-label ${className}`.trim()}>{children}</div>
    </Html>
  );
}
