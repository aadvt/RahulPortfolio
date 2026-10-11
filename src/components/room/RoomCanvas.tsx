import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import RoomScene from './RoomScene';
import CameraManager from './CameraManager';

export default function RoomCanvas() {
  return (
    <Canvas
      shadows
      // Configure the camera directly on the Canvas so useThree().camera IS
      // this camera from frame 0 — no makeDefault swap race.
      camera={{ position: [8.5, 8, 13.5], fov: 50, near: 0.1, far: 200 }}
      gl={{
        antialias: true,
        alpha: true,
        stencil: false,
        depth: true,
      }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.35;
        // Surface WebGL context loss (would otherwise blank silently).
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          console.error('[RoomScene] WebGL context lost');
        });
      }}
      style={{
        width: '100%',
        height: '100%',
        background: '#0a0a0a',
      }}
    >
      {/* Camera animation manager (owns position + aim) */}
      <CameraManager />

      {/* Scene content — Suspense guards any async child so it can't throw
          synchronously and unmount the whole canvas. */}
      <Suspense fallback={null}>
        <RoomScene />
      </Suspense>
    </Canvas>
  );
}
