/**
 * Everything hung on the plaster: the spray tag over the desk, the boxing-glove
 * plaque, the blue waveform sign above the pocket, and the poster + floating
 * shelf on the south stretch of the west wall.
 */

import * as THREE from 'three';
import { useMemo } from 'react';
import { TAG, SIGN, POSTER, WALL_SHELF, HALF_W, HALF_D, C } from '../spec';
import { mat, plain, glow, Panel, Slab, Cyl, Halo, useNeonGeometry } from '../kit';
import { M, Lantern, Plant } from './common';
import { tagTexture, posterTexture } from '../textures';

/* ------------------------------------------------------------------ */
/* Spray tag                                                           */
/* ------------------------------------------------------------------ */

/**
 * Painted straight onto the wall. A polygon-offset decal plane 4 mm proud of
 * the plaster keeps it from z-fighting while still taking the wall's light.
 */
export function GraffitiTag() {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      map: tagTexture(),
      transparent: true,
      roughness: 0.96,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      envMapIntensity: 0.05,
    });
    return m;
  }, []);

  return (
    <mesh position={[TAG.x, TAG.y, -HALF_D + 0.006]} material={material}>
      <planeGeometry args={[TAG.width, TAG.height]} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Boxing-glove plaque                                                 */
/* ------------------------------------------------------------------ */

/** Small framed shadow box east of the monitor — a pair of gloves on a peg. */
export function Plaque({ x, y }: { x: number; y: number }) {
  const frame = mat('walnut', { repeat: [0.5, 0.5], tint: '#9c8574', normalScale: 0.7 });
  const glove = plain('#231a16', 0.72);

  return (
    <group position={[x, y, -HALF_D + 0.012]}>
      <Panel size={[0.24, 0.26, 0.03]} material={frame} radius={0.006} />
      <mesh position={[0, 0, 0.017]} material={plain('#171519', 0.9)}>
        <planeGeometry args={[0.2, 0.22]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.045, -0.02, 0.03]} rotation={[0, 0, s * 0.22]}>
          <mesh material={glove} castShadow={false}>
            <sphereGeometry args={[0.037, 12, 10]} />
          </mesh>
          <mesh position={[0, 0.042, 0]} material={glove} castShadow={false}>
            <cylinderGeometry args={[0.022, 0.027, 0.05, 12]} />
          </mesh>
          <mesh position={[0, 0.062, 0]} material={plain('#8d6a3a', 0.8)} castShadow={false}>
            <cylinderGeometry args={[0.021, 0.021, 0.012, 12]} />
          </mesh>
        </group>
      ))}
      <Cyl r={0.005} h={0.05} position={[0, 0.085, 0.03]} rotation={[Math.PI / 2, 0, 0]} material={M.steel} segments={8} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Blue waveform sign                                                  */
/* ------------------------------------------------------------------ */

/** An ECG-ish trace inside a lightbox frame — the room's one cool light source. */
const WAVE: [number, number][] = [
  [-0.24, 0],
  [-0.17, 0],
  [-0.13, 0.05],
  [-0.09, -0.06],
  [-0.05, 0.09],
  [-0.005, -0.075],
  [0.035, 0.055],
  [0.075, -0.04],
  [0.115, 0.07],
  [0.16, -0.02],
  [0.2, 0],
  [0.24, 0],
];

const BORDER: [number, number][] = [
  [-0.27, -0.13],
  [0.27, -0.13],
  [0.27, 0.13],
  [-0.27, 0.13],
];

export function WaveSign() {
  const wave = useNeonGeometry(WAVE, 0.0085, false);
  const border = useNeonGeometry(BORDER, 0.008, true);
  const tube = useMemo(() => glow(C.neonBlue, 3.4), []);
  const s = SIGN.width / 0.62;

  return (
    <group position={[-HALF_W + 0.045, SIGN.y, SIGN.z]} rotation={[0, Math.PI / 2, 0]} scale={s}>
      {/* dark backing panel */}
      <Panel size={[0.62, 0.34, 0.03]} position={[0, 0, -0.02]} material={plain('#0e0e12', 0.7)} radius={0.006} />
      <mesh geometry={border} material={tube} />
      <mesh geometry={wave} material={tube} />
      <Halo size={[1.0, 0.72]} position={[0, 0, 0.01]} color={C.neonBlue} opacity={0.5} />
      <pointLight position={[0, 0, 0.3]} color={C.neonBlue} intensity={1.4} distance={3} decay={2} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Poster + floating shelf                                             */
/* ------------------------------------------------------------------ */

export function Poster() {
  const art = useMemo(
    () => new THREE.MeshStandardMaterial({ map: posterTexture(), roughness: 0.62, metalness: 0.04 }),
    []
  );
  return (
    <group position={[-HALF_W + 0.012, POSTER.y, POSTER.z]} rotation={[0, Math.PI / 2, 0]}>
      <Panel size={[POSTER.width + 0.022, POSTER.height + 0.022, 0.02]} material={plain('#141317', 0.6)} radius={0.004} />
      <mesh position={[0, 0, 0.012]} material={art}>
        <planeGeometry args={[POSTER.width, POSTER.height]} />
      </mesh>
    </group>
  );
}

/** Bracketed walnut shelf carrying a plant and one of the caged lanterns. */
export function WallShelf() {
  const board = mat('walnut', { repeat: [0.5, 0.3], normalScale: 0.75 });
  const x = -HALF_W + WALL_SHELF.depth / 2 + 0.006;

  return (
    <group position={[x, WALL_SHELF.y, WALL_SHELF.z]}>
      <Panel size={[WALL_SHELF.depth, 0.026, WALL_SHELF.width]} material={board} radius={0.005} castShadow />
      {[-1, 1].map((s) => (
        <group key={s} position={[-0.01, -0.05, s * (WALL_SHELF.width / 2 - 0.05)]}>
          <Slab size={[WALL_SHELF.depth * 0.7, 0.012, 0.014]} position={[0.02, 0.038, 0]} material={M.steel} />
          <Slab size={[0.012, 0.075, 0.014]} position={[-WALL_SHELF.depth * 0.32, 0.006, 0]} material={M.steel} />
          <mesh position={[-0.02, 0.006, 0]} rotation={[0, 0, -0.72]} material={M.steel} castShadow={false}>
            <boxGeometry args={[0.09, 0.008, 0.01]} />
          </mesh>
        </group>
      ))}
      <Lantern position={[0.01, 0.014, 0.11]} scale={0.86} />
      <Plant position={[0.005, 0.014, -0.11]} scale={0.8} seed={6.2} />
    </group>
  );
}
