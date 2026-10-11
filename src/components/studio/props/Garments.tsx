/**
 * The clothes on the wardrobe rail.
 *
 * Each garment is a wire hanger, a shoulder yoke and a torso panel that tapers
 * and swings a few degrees off vertical. Sleeves hang slightly forward of the
 * body so the row reads as a stack of separate items rather than one slab of
 * colour — which is what the reference's rail actually looks like once the
 * strip light above it grazes the shoulders.
 */

import { useMemo } from 'react';
import { mat, plain, Panel, Cyl } from '../kit';
import { mulberry32 } from '../noise';

/** The palette read straight off the reference rail, left to right. */
const CLOTH = [
  { tint: '#8b8b7a', w: 0.13, len: 0.66 }, // olive overshirt
  { tint: '#4a4a52', w: 0.12, len: 0.62 }, // black tee
  { tint: '#6e685c', w: 0.14, len: 0.7 }, // canvas jacket
  { tint: '#d84a3c', w: 0.13, len: 0.68 }, // red hoodie
  { tint: '#50525c', w: 0.12, len: 0.6 },
  { tint: '#f0ece2', w: 0.13, len: 0.66 }, // cream crewneck
  { tint: '#8b8f98', w: 0.12, len: 0.64 },
  { tint: '#cfc9bf', w: 0.14, len: 0.72 }, // check flannel
  { tint: '#585c68', w: 0.12, len: 0.6 },
  { tint: '#9c7a5e', w: 0.13, len: 0.67 },
  { tint: '#42454c', w: 0.12, len: 0.63 },
] as const;

const wire = plain('#8b8f96', 0.3, 0.85);

function Garment({
  x,
  railY,
  z,
  tint,
  width,
  length,
  tilt,
  depth,
}: {
  x: number;
  railY: number;
  z: number;
  tint: string;
  width: number;
  length: number;
  tilt: number;
  depth: number;
}) {
  const cloth = mat('denim', { repeat: [1.4, 2.6], tint, normalScale: 1.1 });
  const shoulder = railY - 0.075;

  return (
    <group position={[x, 0, z]} rotation={[0, 0, tilt]}>
      {/* hanger: hook + the two shoulder wires */}
      <mesh position={[0, railY + 0.012, 0]} rotation={[Math.PI / 2, 0, 0]} material={wire} castShadow={false}>
        <torusGeometry args={[0.018, 0.0022, 6, 14, Math.PI * 1.5]} />
      </mesh>
      <mesh position={[0, railY - 0.035, 0]} material={wire} castShadow={false}>
        <boxGeometry args={[0.0035, 0.06, 0.0035]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[(s * width) / 2.6, shoulder + 0.018, 0]}
          rotation={[0, 0, s * 0.42]}
          material={wire}
          castShadow={false}
        >
          <boxGeometry args={[width * 0.86, 0.0035, 0.0035]} />
        </mesh>
      ))}

      {/* shoulder yoke — a shallow wedge the light catches first */}
      <Panel
        size={[width * 1.02, 0.075, depth]}
        position={[0, shoulder - 0.02, 0]}
        material={cloth}
        radius={0.026}
        smoothness={3}
      />
      {/* torso */}
      <Panel
        size={[width, length, depth * 0.9]}
        position={[0, shoulder - 0.04 - length / 2, 0]}
        material={cloth}
        radius={0.02}
        smoothness={3}
      />
      {/* sleeves, hung a touch proud of the body */}
      {[-1, 1].map((s) => (
        <Panel
          key={s}
          size={[width * 0.3, length * 0.72, depth * 0.62]}
          position={[s * (width * 0.5 + 0.004), shoulder - 0.05 - (length * 0.72) / 2, depth * 0.16]}
          rotation={[0, 0, s * 0.05]}
          material={cloth}
          radius={0.018}
          smoothness={3}
        />
      ))}
    </group>
  );
}

export default function Garments({
  count,
  width,
  railY,
  z,
  seed = 1,
}: {
  count: number;
  width: number;
  railY: number;
  z: number;
  seed?: number;
}) {
  const items = useMemo(() => {
    const rnd = mulberry32(seed * 977);
    const n = Math.min(count, CLOTH.length);
    const pitch = width / n;
    return Array.from({ length: n }, (_, i) => {
      const c = CLOTH[i % CLOTH.length];
      return {
        x: -width / 2 + pitch * (i + 0.5) + (rnd() - 0.5) * pitch * 0.18,
        tint: c.tint,
        width: c.w * (0.92 + rnd() * 0.16),
        length: c.len * (0.94 + rnd() * 0.12),
        tilt: (rnd() - 0.5) * 0.075,
        depth: 0.052 + rnd() * 0.026,
      };
    });
  }, [count, width, seed]);

  return (
    <group>
      {items.map((g, i) => (
        <Garment key={i} railY={railY} z={z} {...g} />
      ))}
      {/* a couple of spare hangers pushed to the end of the rail */}
      {[-width / 2 - 0.02, -width / 2 - 0.05].map((x, i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, railY + 0.012, 0]} rotation={[Math.PI / 2, 0, 0]} material={wire} castShadow={false}>
            <torusGeometry args={[0.018, 0.0022, 6, 14, Math.PI * 1.5]} />
          </mesh>
          <Cyl r={0.0022} h={0.05} position={[0, railY - 0.03, 0]} material={wire} segments={6} castShadow={false} />
        </group>
      ))}
    </group>
  );
}
