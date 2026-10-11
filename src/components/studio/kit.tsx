/**
 * Shared material + geometry kit.
 *
 * Materials are cached at module scope and shared between meshes, so tiling the
 * same plaster across a dozen wall segments costs one material and one upload.
 */

import * as THREE from 'three';
import { useMemo, type ReactNode } from 'react';
import { RoundedBox } from '@react-three/drei';
import {
  plasterSurface,
  walnutSurface,
  travertineSurface,
  floorSurface,
  fabricSurface,
  tileSurface,
  rugSurface,
  denimSurface,
  tiled,
} from './textures';

const SURFACES = {
  plaster: plasterSurface,
  walnut: walnutSurface,
  travertine: travertineSurface,
  floor: floorSurface,
  fabric: fabricSurface,
  tile: tileSurface,
  rug: rugSurface,
  denim: denimSurface,
} as const;

export type SurfaceKind = keyof typeof SURFACES;

export type MatOpts = {
  /** Texture repeats. Pass world-size / tile-size for correct scale. */
  repeat?: [number, number];
  /** Multiplies the baked albedo — use to darken/warm a surface. */
  tint?: string;
  /** Scales the baked roughness map (1 = as baked). */
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  side?: THREE.Side;
  envMapIntensity?: number;
};

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** Textured PBR material, memoised on its options. */
export function mat(kind: SurfaceKind, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = `${kind}|${JSON.stringify(o)}`;
  const hit = matCache.get(key);
  if (hit) return hit;

  const [ru, rv] = o.repeat ?? [1, 1];
  const s = tiled(SURFACES[kind](), ru, rv);
  const m = new THREE.MeshStandardMaterial({
    map: s.map,
    normalMap: s.normalMap,
    roughnessMap: s.roughnessMap,
    color: o.tint ?? '#ffffff',
    roughness: o.roughness ?? 1,
    metalness: o.metalness ?? 0,
    side: o.side ?? THREE.FrontSide,
    envMapIntensity: o.envMapIntensity ?? 0.18,
  });
  const ns = o.normalScale ?? 1;
  m.normalScale.set(ns, ns);
  matCache.set(key, m);
  return m;
}

const plainCache = new Map<string, THREE.MeshStandardMaterial>();

/** Untextured PBR material (metal fittings, glass frames, painted steel). */
export function plain(
  color: string,
  roughness = 0.6,
  metalness = 0,
  extra: Partial<THREE.MeshStandardMaterialParameters> = {}
): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}|${JSON.stringify(extra)}`;
  const hit = plainCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.25, ...extra });
  plainCache.set(key, m);
  return m;
}

const glowCache = new Map<string, THREE.MeshBasicMaterial>();

/**
 * Light-source material. Colour components are pushed above 1.0 with tone
 * mapping off, so the bloom pass picks the emitter up as a real highlight.
 */
export function glow(color: string, intensity = 2.4): THREE.MeshBasicMaterial {
  const key = `${color}|${intensity}`;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const c = new THREE.Color(color);
  c.multiplyScalar(intensity);
  const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false, fog: false });
  glowCache.set(key, m);
  return m;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

type Vec3 = [number, number, number];

/**
 * Beveled box. Real furniture and joinery never has a knife edge — a sub-mm
 * bevel is what stops procedural rooms from reading as programmer-art.
 */
export function Panel({
  size,
  position,
  rotation,
  material,
  radius,
  smoothness = 2,
  castShadow = true,
  receiveShadow = true,
}: {
  size: Vec3;
  position?: Vec3;
  rotation?: Vec3;
  material: THREE.Material;
  radius?: number;
  smoothness?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const min = Math.min(size[0], size[1], size[2]);
  const r = Math.min(radius ?? 0.012, min * 0.34);
  return (
    <RoundedBox
      args={size}
      radius={r}
      smoothness={smoothness}
      creaseAngle={0.6}
      position={position}
      rotation={rotation}
      material={material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

/** Sharp-edged box — right for cast concrete walls, wrong for joinery. */
export function Slab({
  size,
  position,
  rotation,
  material,
  castShadow = false,
  receiveShadow = true,
}: {
  size: Vec3;
  position?: Vec3;
  rotation?: Vec3;
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      material={material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={size} />
    </mesh>
  );
}

/** A glowing bar plus its physical housing — the LED strips throughout. */
export function LedBar({
  size,
  position,
  rotation,
  color,
  intensity = 2.4,
}: {
  size: Vec3;
  position: Vec3;
  rotation?: Vec3;
  color: string;
  intensity?: number;
}) {
  return <mesh position={position} rotation={rotation} material={glow(color, intensity)}>
    <boxGeometry args={size} />
  </mesh>;
}

/** Convenience wrapper so parts can group children with a transform. */
export function At({
  position,
  rotation,
  scale,
  children,
}: {
  position?: Vec3;
  rotation?: Vec3;
  scale?: number | Vec3;
  children: ReactNode;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {children}
    </group>
  );
}

/** Cylinder/rod/tube — legs, rails, rods, bottles, lamp stems. */
export function Cyl({
  r,
  r2,
  h,
  position,
  rotation,
  material,
  segments = 16,
  castShadow = true,
  open = false,
}: {
  r: number;
  r2?: number;
  h: number;
  position?: Vec3;
  rotation?: Vec3;
  material: THREE.Material;
  segments?: number;
  castShadow?: boolean;
  open?: boolean;
}) {
  return (
    <mesh position={position} rotation={rotation} material={material} castShadow={castShadow} receiveShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, segments, 1, open]} />
    </mesh>
  );
}

/** Sphere/ball — basketball, finials, knobs, foliage clusters. */
export function Ball({
  r,
  position,
  scale,
  material,
  segments = 18,
  castShadow = true,
}: {
  r: number;
  position?: Vec3;
  scale?: Vec3;
  material: THREE.Material;
  segments?: number;
  castShadow?: boolean;
}) {
  return (
    <mesh position={position} scale={scale} material={material} castShadow={castShadow} receiveShadow>
      <sphereGeometry args={[r, segments, Math.max(8, Math.round(segments * 0.75))]} />
    </mesh>
  );
}

/**
 * Neon glyph: a small tube swept along a 2D polyline, plus a flat halo card
 * behind it. Bloom does the rest.
 */
export function useNeonGeometry(points: [number, number][], radius = 0.012, closed = false) {
  return useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      closed,
      'catmullrom',
      0.02 // near-linear: neon is bent tube, not a spline
    );
    return new THREE.TubeGeometry(curve, Math.max(24, points.length * 8), radius, 8, closed);
  }, [points, radius, closed]);
}

/** Soft additive halo used behind every emitter that sits on a wall. */
export function Halo({
  size,
  position,
  rotation,
  color,
  opacity = 0.5,
}: {
  size: [number, number];
  position: Vec3;
  rotation?: Vec3;
  color: string;
  opacity?: number;
}) {
  const material = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    return new THREE.MeshBasicMaterial({
      map: tex,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
  }, [color, opacity]);
  return (
    <mesh position={position} rotation={rotation} material={material} renderOrder={2}>
      <planeGeometry args={size} />
    </mesh>
  );
}

/**
 * Draped cloth: a plane sagging under gravity with soft folds. Used for the
 * duvet, the hoodie thrown on the bed, hanging garments and towels.
 */
export function useDrapeGeometry(
  width: number,
  length: number,
  sag: number,
  folds: number,
  seed = 1,
  segs = 40
) {
  return useMemo(() => {
    const g = new THREE.PlaneGeometry(width, length, segs, segs);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const u = x / width + 0.5;
      const v = y / length + 0.5;
      const edge = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      const ripple =
        Math.sin(u * Math.PI * folds + seed) * 0.5 + Math.sin(v * Math.PI * (folds * 0.6) + seed * 2.3) * 0.5;
      pos.setZ(i, edge * sag + ripple * sag * 0.22 * edge);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [width, length, sag, folds, seed, segs]);
}

/**
 * Extruded profile with a rounded leading edge — used for the alcove threshold
 * step, which is bullnosed in the reference.
 */
export function useBullnoseGeometry(length: number, depth: number, rise: number, round: number) {
  return useMemo(() => {
    const shape = new THREE.Shape();
    const r = Math.min(round, depth * 0.9, rise * 0.9);
    shape.moveTo(0, 0);
    shape.lineTo(depth - r, 0);
    shape.quadraticCurveTo(depth, 0, depth, r * 0.6);
    shape.lineTo(depth, rise - r * 0.4);
    shape.quadraticCurveTo(depth, rise, depth - r * 0.5, rise);
    shape.lineTo(0, rise);
    shape.closePath();
    // Profile lies in XY (X = tread depth, Y = rise) and extrudes along +Z,
    // so the caller gets length along Z with no extra rotation.
    const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 8 });
    geo.computeVertexNormals();
    return geo;
  }, [length, depth, rise, round]);
}
