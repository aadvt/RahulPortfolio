'use client';

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { ShowcaseAsset } from '@/data/showcaseAssets';
import ShowcaseModel from './ShowcaseModel';
import LookDevRig, { type LightMode } from './LookDevRig';
import { framingFor } from './assetGroupCache';

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

const FOV = 35;
const AZIMUTH = radians(38);
const ELEVATION = radians(20);
/** Breathing room left around the model's bounding sphere. */
const FRAME_MARGIN = 1.12;

interface Props {
  asset: ShowcaseAsset;
  lightMode: LightMode;
  wireframe?: boolean;
  autoRotate?: boolean;
  /** Cards run cheap; the detail viewer runs at full quality. */
  quality?: 'card' | 'detail';
  /** Set 'never' to park background canvases while the detail view is open. */
  frameloop?: 'always' | 'never';
}

export default function AssetCanvas({
  asset,
  lightMode,
  wireframe = false,
  autoRotate = true,
  quality = 'card',
  frameloop = 'always',
}: Props) {
  const detail = quality === 'detail';

  // Frame from the model's own normalized bounds rather than per-asset guesses,
  // so the camera stays correct if a spec is regenerated with new proportions.
  const { camera, targetY } = useMemo(() => {
    const framing = framingFor(asset);
    const centerY = framing.height / 2;
    const radius =
      (framing.boundingRadius / Math.sin(radians(FOV) / 2)) * FRAME_MARGIN * asset.zoom;
    return {
      targetY: centerY,
      camera: {
        position: [
          radius * Math.cos(ELEVATION) * Math.sin(AZIMUTH),
          centerY + radius * Math.sin(ELEVATION),
          radius * Math.cos(ELEVATION) * Math.cos(AZIMUTH),
        ] as [number, number, number],
        fov: FOV,
        near: 0.1,
        far: 100,
      },
    };
  }, [asset]);

  return (
    <Canvas
      shadows={detail}
      frameloop={frameloop}
      dpr={detail ? [1, 2] : [1, 1.5]}
      camera={camera}
      gl={{ antialias: true, alpha: true, stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.35;
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          console.error(`[showcase] WebGL context lost on ${asset.id}`);
        });
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <LookDevRig asset={asset} mode={lightMode} shadows={detail} />
        <ShowcaseModel asset={asset} wireframe={wireframe} />
        {detail && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[40, 40]} />
            <shadowMaterial opacity={0.4} />
          </mesh>
        )}
      </Suspense>

      <OrbitControls
        makeDefault
        target={[0, targetY, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={detail ? 0.9 : 1.6}
        enableZoom={detail}
        enablePan={false}
        minDistance={2}
        maxDistance={16}
        // Keep the camera above the ground plane so models never float.
        maxPolarAngle={Math.PI / 2 - 0.02}
        dampingFactor={0.08}
        enableDamping
      />
    </Canvas>
  );
}
