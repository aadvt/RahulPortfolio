'use client';

import * as THREE from 'three';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import StudioScene from './StudioScene';
import CameraRig from './CameraRig';
import Hotspots from './Hotspots';
import FocusLight from './FocusLight';
import { VIEWS } from './views';
import { useStudioUI } from './stops';

/**
 * Mounted inside the same Suspense boundary as the room, so it only starts
 * counting once every lazy piece has resolved. A few frames in, shaders are
 * compiled and the first image is on screen — that is when the loader is
 * allowed to lift (it then starts the intro flight).
 */
function ReadySignal() {
  const frames = useRef(0);
  const smooth = useRef(0);
  const t0 = useRef(performance.now());
  useFrame((_, dt) => {
    if (frames.current < 0) return;
    frames.current += 1;
    // First frames carry shader compiles and shadow-map allocation. Hand over
    // only once the loop has settled (a run of quick frames), or after a cap
    // so a slow device is never held on the leader forever.
    smooth.current = dt < 0.034 ? smooth.current + 1 : 0;
    const waited = performance.now() - t0.current;
    if ((frames.current > 8 && smooth.current >= 5) || waited > 5000) {
      frames.current = -1;
      useStudioUI.getState().setSceneReady();
    }
  });
  return null;
}

/**
 * Stops the render loop while the text index covers the screen — there is
 * nothing to see, and on a laptop the room is the difference between a quiet
 * fan and a loud one. Waits out the index's wipe before pausing, and resumes
 * the moment it starts to close.
 */
function PauseWhenCovered() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const covered = useStudioUI((s) => s.listOpen);
  useEffect(() => {
    if (!covered) {
      setFrameloop('always');
      return;
    }
    const t = window.setTimeout(() => setFrameloop('never'), 900);
    return () => window.clearTimeout(t);
  }, [covered, setFrameloop]);
  return null;
}

/** Phones and tablets: no MSAA, a lower pixel-ratio ceiling. */
const coarse = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

export default function StudioCanvas() {
  const [lite] = useState(coarse);
  const [dpr, setDpr] = useState<number>(lite ? 1.25 : 1.75);

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ position: VIEWS.hero.position, fov: VIEWS.hero.fov, near: 0.05, far: 120 }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
        gl.shadowMap.type = THREE.PCFShadowMap;
        scene.background = new THREE.Color('#050506');
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          console.error('[StudioRoom] WebGL context lost');
        });
      }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    >
      {/* Step resolution down (never below 1) if the frame rate can't hold. */}
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(lite ? 1.5 : 2, d + 0.25))}
        flipflops={3}
        onFallback={() => setDpr(1)}
      />
      <PauseWhenCovered />
      <CameraRig />
      <AdaptiveDpr pixelated={false} />
      <FocusLight />
      <Suspense fallback={null}>
        <StudioScene />
        <Hotspots />
        <ReadySignal />
      </Suspense>
      <EffectComposer multisampling={lite ? 0 : 4} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.82} luminanceSmoothing={0.28} radius={0.65} />
        <Vignette offset={0.26} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}
