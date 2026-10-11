/**
 * Micro-props and the shared material vocabulary every dressed surface uses.
 *
 * The reference room repeats a very small kit — walnut, black steel, brushed
 * appliance metal, one warm caged lantern, one type of trailing plant, one
 * family of storage boxes. Defining them once here is what keeps thirty
 * separate props looking like they were bought from the same shop.
 */

import * as THREE from 'three';
import { mat, plain, glow, Panel, Slab, Cyl, Ball, LedBar } from '../kit';
import { C } from '../spec';

/* ------------------------------------------------------------------ */
/* Shared materials                                                    */
/* ------------------------------------------------------------------ */

export const M = {
  walnut: (u = 1, v = 1) => mat('walnut', { repeat: [u, v], normalScale: 0.75 }),
  walnutDark: (u = 1, v = 1) => mat('walnut', { repeat: [u, v], tint: '#8a7b71', normalScale: 0.75 }),
  walnutWarm: (u = 1, v = 1) => mat('walnut', { repeat: [u, v], tint: '#d8b48c', normalScale: 0.7 }),
  stone: (u = 1, v = 1) => mat('travertine', { repeat: [u, v], normalScale: 1.1 }),
  plaster: (u = 1, v = 1) => mat('plaster', { repeat: [u, v], normalScale: 1.2 }),
  tile: (u = 1, v = 1) => mat('tile', { repeat: [u, v], normalScale: 1.1 }),
  cloth: (u = 1, v = 1, tint = '#ffffff') => mat('denim', { repeat: [u, v], tint, normalScale: 1 }),

  steel: plain(C.steel, 0.44, 0.72),
  blackMatte: plain('#131317', 0.78, 0.15),
  rubber: plain('#0d0d10', 0.94, 0),
  chrome: plain('#c8ccd2', 0.22, 0.95),
  brushed: plain(C.appliance, 0.34, 0.82),
  darkGlass: plain('#0a0b10', 0.12, 0.4),
  porcelain: plain('#eae7e2', 0.18, 0.02),
  brass: plain('#c39a52', 0.3, 0.85),
  leather: plain('#241c17', 0.7, 0.08),
  canvasOlive: plain('#3a3a2c', 0.92, 0),
  paper: plain('#b9b2a6', 0.9, 0),
  leaf: plain('#3f5c34', 0.86, 0),
  leafDark: plain('#2c4226', 0.88, 0),
  terracotta: plain('#6a4436', 0.85, 0),
  concreteGrey: plain('#4c4b4a', 0.85, 0),
} as const;

/* ------------------------------------------------------------------ */
/* Plants                                                              */
/* ------------------------------------------------------------------ */

/**
 * Potted succulent/aloe. Blades are thin tapered boxes fanned around the pot —
 * cheap, and at these sizes it reads better than any billboard would.
 */
export function Plant({
  position,
  scale = 1,
  blades = 11,
  pot = M.concreteGrey,
  seed = 0,
}: {
  position: [number, number, number];
  scale?: number;
  blades?: number;
  pot?: THREE.Material;
  seed?: number;
}) {
  const r = 0.05;
  return (
    <group position={position} scale={scale}>
      <Cyl r={r} r2={r * 0.84} h={0.085} position={[0, 0.0425, 0]} material={pot} segments={14} />
      <Cyl r={r * 1.04} h={0.012} position={[0, 0.085, 0]} material={pot} segments={14} />
      <Cyl r={r * 0.9} h={0.01} position={[0, 0.088, 0]} material={plain('#241d16', 0.98)} segments={12} />
      {Array.from({ length: blades }, (_, i) => {
        const a = (i / blades) * Math.PI * 2 + seed;
        const tilt = 0.34 + ((i * 7919 + seed * 131) % 11) / 34;
        const len = 0.11 + ((i * 5273) % 9) / 90;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh
              position={[Math.sin(tilt) * len * 0.5, 0.09 + Math.cos(tilt) * len * 0.5, 0]}
              rotation={[0, 0, -tilt]}
              material={i % 3 === 0 ? M.leafDark : M.leaf}
              castShadow
            >
              <boxGeometry args={[0.016, len, 0.005]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Long trailing vine — hangs off the top of the display shelf in the reference. */
export function Vine({
  position,
  length = 0.5,
  leaves = 16,
  seed = 3,
}: {
  position: [number, number, number];
  length?: number;
  leaves?: number;
  seed?: number;
}) {
  return (
    <group position={position}>
      {Array.from({ length: leaves }, (_, i) => {
        const t = i / leaves;
        const y = -t * length;
        const sway = Math.sin(t * 7 + seed) * 0.035 + t * 0.02;
        const z = Math.cos(t * 5 + seed) * 0.02;
        return (
          <mesh
            key={i}
            position={[sway, y, z]}
            rotation={[0.4 * Math.sin(i * 2.1 + seed), i * 1.9 + seed, 0.5 * Math.cos(i + seed)]}
            material={i % 4 === 0 ? M.leafDark : M.leaf}
            castShadow={false}
          >
            <boxGeometry args={[0.038, 0.004, 0.026]} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Lantern                                                             */
/* ------------------------------------------------------------------ */

/**
 * The caged filament lantern that shows up three times in the reference: on the
 * wall shelf, on the nightstand and in the laundry tower's utility bay.
 */
export function Lantern({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const cage = plain('#2a2723', 0.45, 0.65);
  return (
    <group position={position} scale={scale}>
      {/* base + top cap */}
      <Cyl r={0.052} r2={0.058} h={0.022} position={[0, 0.011, 0]} material={cage} segments={12} />
      <Cyl r={0.05} r2={0.038} h={0.028} position={[0, 0.176, 0]} material={cage} segments={12} />
      {/* glass chimney */}
      <mesh position={[0, 0.095, 0]} castShadow={false}>
        <cylinderGeometry args={[0.043, 0.047, 0.14, 14, 1, true]} />
        <meshPhysicalMaterial
          color="#ffd7a8"
          transparent
          opacity={0.2}
          roughness={0.12}
          transmission={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* cage uprights */}
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.047, 0.095, Math.sin(a) * 0.047]}
            material={cage}
            castShadow={false}
          >
            <boxGeometry args={[0.006, 0.14, 0.006]} />
          </mesh>
        );
      })}
      {/* filament */}
      <mesh position={[0, 0.088, 0]} material={glow(C.lantern, 3.4)}>
        <capsuleGeometry args={[0.016, 0.05, 4, 10]} />
      </mesh>
      <mesh position={[0, 0.088, 0]} material={glow('#ffcf94', 0.85)}>
        <sphereGeometry args={[0.042, 12, 10]} />
      </mesh>
      <pointLight position={[0, 0.1, 0]} color={C.lantern} intensity={0.9} distance={2.8} decay={2} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Storage                                                            */
/* ------------------------------------------------------------------ */

/** Fabric storage bin with a punched label plate — used all over the joinery. */
export function StorageBox({
  size,
  position,
  rotation,
  tint = '#3a3b3e',
  label = true,
}: {
  size: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  tint?: string;
  label?: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
      <Panel size={size} material={mat('denim', { repeat: [2, 1], tint })} radius={0.012} />
      {label && (
        <mesh position={[0, 0, size[2] / 2 + 0.002]} material={M.brushed}>
          <boxGeometry args={[Math.min(0.09, size[0] * 0.4), 0.032, 0.004]} />
        </mesh>
      )}
    </group>
  );
}

/** Cardboard sneaker box — the orange/white stack on the wardrobe's top shelf. */
export function ShoeBox({
  size,
  position,
  rotation,
  body = '#c8562a',
  lid = '#d9d5cf',
}: {
  size: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  body?: string;
  lid?: string;
}) {
  return (
    <group position={position} rotation={rotation}>
      <Panel size={size} material={plain(body, 0.9)} radius={0.008} />
      <Panel
        size={[size[0] + 0.008, size[1] * 0.3, size[2] + 0.008]}
        position={[0, size[1] * 0.38, 0]}
        material={plain(lid, 0.88)}
        radius={0.008}
      />
    </group>
  );
}

/** Wicker/woven basket — laundry tower top shelf and the floor bin. */
export function Basket({
  size,
  position,
  tint = '#8d8271',
}: {
  size: [number, number, number];
  position: [number, number, number];
  tint?: string;
}) {
  const weave = mat('denim', { repeat: [6, 4], tint });
  const [w, h, d] = size;
  return (
    <group position={position}>
      <Slab size={[w, 0.012, d]} position={[0, 0.006, 0]} material={weave} />
      <Slab size={[w, h, 0.012]} position={[0, h / 2, -d / 2]} material={weave} />
      <Slab size={[w, h, 0.012]} position={[0, h / 2, d / 2]} material={weave} />
      <Slab size={[0.012, h, d]} position={[-w / 2, h / 2, 0]} material={weave} />
      <Slab size={[0.012, h, d]} position={[w / 2, h / 2, 0]} material={weave} />
      <Panel size={[w + 0.014, 0.016, d + 0.014]} position={[0, h, 0]} material={plain('#4a4238', 0.8)} radius={0.005} />
    </group>
  );
}

/** Neat stack of folded towels. */
export function TowelStack({
  position,
  w = 0.24,
  d = 0.2,
  count = 3,
  tint = '#cfc9c0',
}: {
  position: [number, number, number];
  w?: number;
  d?: number;
  count?: number;
  tint?: string;
}) {
  return (
    <group position={position}>
      {Array.from({ length: count }, (_, i) => (
        <Panel
          key={i}
          size={[w - i * 0.006, 0.05, d - i * 0.005]}
          position={[0, 0.026 + i * 0.052, 0]}
          material={mat('denim', { repeat: [1, 1], tint })}
          radius={0.018}
          smoothness={3}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Lighting furniture                                                  */
/* ------------------------------------------------------------------ */

/** Under-shelf LED channel: the aluminium extrusion plus the tape inside it. */
export function ShelfLED({
  length,
  position,
  rotation,
  color = C.warmLED,
  intensity = 2.2,
  axis = 'x',
}: {
  length: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  intensity?: number;
  axis?: 'x' | 'z';
}) {
  const housing: [number, number, number] = axis === 'x' ? [length, 0.02, 0.024] : [0.024, 0.02, length];
  const tape: [number, number, number] = axis === 'x' ? [length - 0.03, 0.01, 0.013] : [0.013, 0.01, length - 0.03];
  return (
    <group position={position} rotation={rotation}>
      <Slab size={housing} material={plain('#3a3a40', 0.5, 0.6)} />
      <LedBar size={tape} position={[0, -0.008, 0]} color={color} intensity={intensity} />
    </group>
  );
}

/** Small ceramic mug — desk dressing. */
export function Mug({ position, tint = '#1e1e22' }: { position: [number, number, number]; tint?: string }) {
  const m = plain(tint, 0.5, 0.05);
  return (
    <group position={position}>
      <Cyl r={0.037} r2={0.032} h={0.09} position={[0, 0.045, 0]} material={m} segments={16} />
      <mesh position={[0, 0.086, 0]} material={plain('#2b1c12', 0.35)}>
        <cylinderGeometry args={[0.032, 0.032, 0.004, 16]} />
      </mesh>
      <mesh position={[0.042, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={m}>
        <torusGeometry args={[0.02, 0.005, 8, 14, Math.PI * 1.2]} />
      </mesh>
    </group>
  );
}

/** Squat glass bottle — soap on the vanity, detergent in the laundry bay. */
export function Bottle({
  position,
  h = 0.2,
  r = 0.042,
  tint = '#2c62c8',
  cap = '#d8d5cf',
}: {
  position: [number, number, number];
  h?: number;
  r?: number;
  tint?: string;
  cap?: string;
}) {
  const body = plain(tint, 0.24, 0.1, { transparent: true, opacity: 0.92 });
  return (
    <group position={position}>
      <Cyl r={r} h={h * 0.78} position={[0, h * 0.39, 0]} material={body} segments={14} />
      <Cyl r={r * 0.85} r2={r * 0.42} h={h * 0.14} position={[0, h * 0.85, 0]} material={body} segments={14} />
      <Cyl r={r * 0.44} h={h * 0.12} position={[0, h * 0.96, 0]} material={plain(cap, 0.55)} segments={12} />
      <Ball r={r * 0.9} position={[0, h * 0.42, r * 0.92]} scale={[1, 1.5, 0.12]} material={plain('#e8e4dc', 0.6)} />
    </group>
  );
}
