/**
 * Low walnut platform bed with an LED underglow.
 *
 * The plinth is inset from the deck all round, which turns the oversail into a
 * continuous shadow slot — the strip lives in there and washes the floor, and
 * that halo is the single strongest read in the reference's bed corner.
 */

import * as THREE from 'three';
import { useMemo } from 'react';
import { BED as B, C } from '../spec';
import { mat, plain, Panel, Slab, LedBar, useDrapeGeometry } from '../kit';
import { M } from './common';

const W = B.x1 - B.x0; // along X (head to foot)
const D = B.z1 - B.z0; // along Z
const CX = (B.x0 + B.x1) / 2;
const CZ = (B.z0 + B.z1) / 2;
const MATT_Y = B.deck + B.mattress / 2;

/** Sagging duvet: a drape sheet with a rolled hem, pulled short of the head. */
function Duvet() {
  const w = W - 0.72;
  const d = D - 0.1;
  const geo = useDrapeGeometry(w, d, 0.085, 5, 2.4, 34);
  const cloth = mat('denim', { repeat: [5, 4.4], tint: '#4b4c50', normalScale: 0.6 });
  const x = B.x0 + 0.06 + w / 2;

  return (
    <group>
      <mesh
        geometry={geo}
        material={cloth}
        position={[x, B.deck + B.mattress + 0.075, CZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      />
      {/* rolled top hem where the duvet is turned back */}
      <Panel
        size={[0.2, 0.11, d]}
        position={[x + w / 2 - 0.02, B.deck + B.mattress + 0.085, CZ]}
        material={cloth}
        radius={0.036}
        smoothness={3}
      />
      {/* the duvet spilling over the two long sides */}
      {[-1, 1].map((s) => (
        <Panel
          key={s}
          size={[w, 0.24, 0.1]}
          position={[x, B.deck + B.mattress - 0.03, CZ + s * (d / 2 + 0.03)]}
          material={cloth}
          radius={0.03}
          smoothness={3}
        />
      ))}
      {/* foot end tuck */}
      <Panel
        size={[0.1, 0.22, d]}
        position={[B.x0 + 0.05, B.deck + B.mattress - 0.02, CZ]}
        material={cloth}
        radius={0.03}
        smoothness={3}
      />
    </group>
  );
}

/** Two slumped pillows against the head end. */
function Pillows() {
  const cloth = mat('denim', { repeat: [3, 2.6], tint: '#3a3b3f', normalScale: 0.6 });
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[B.x1 - 0.3, B.deck + B.mattress + 0.09, CZ + s * 0.33]} rotation={[0, s * 0.06, -0.3]}>
          <Panel size={[0.44, 0.17, 0.6]} material={cloth} radius={0.075} smoothness={4} />
          {/* a second, softer lobe so the pillow isn't a pill */}
          <Panel
            size={[0.36, 0.14, 0.52]}
            position={[-0.04, 0.055, 0]}
            material={cloth}
            radius={0.062}
            smoothness={4}
          />
        </group>
      ))}
    </group>
  );
}

/** The hoodie thrown across the foot of the bed. */
function Hoodie() {
  const cloth = mat('denim', { repeat: [3, 3], tint: '#2e2d2c', normalScale: 0.7 });
  const body = useDrapeGeometry(0.46, 0.56, 0.045, 4, 5.1, 22);
  const y = B.deck + B.mattress + 0.165;
  const x = B.x0 + 0.52;
  const z = CZ - 0.24;

  return (
    <group position={[x, y, z]} rotation={[0, 0.5, 0]}>
      <mesh geometry={body} material={cloth} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      {/* hood bunched at the top */}
      <Panel size={[0.3, 0.075, 0.16]} position={[0, 0.03, -0.29]} material={cloth} radius={0.038} smoothness={3} />
      {/* sleeves folded across */}
      <Panel size={[0.4, 0.05, 0.11]} position={[0.05, 0.03, 0.02]} rotation={[0, 0.3, 0]} material={cloth} radius={0.026} smoothness={3} />
      <Panel size={[0.36, 0.05, 0.11]} position={[-0.02, 0.03, 0.17]} rotation={[0, -0.42, 0]} material={cloth} radius={0.026} smoothness={3} />
      {/* drawcords + a small chest print */}
      {[-0.05, 0.03].map((dz, i) => (
        <mesh key={i} position={[0.1, 0.05, dz - 0.2]} rotation={[0, 0, 0.2]} material={plain('#c9c4bb', 0.9)} castShadow={false}>
          <boxGeometry args={[0.11, 0.006, 0.006]} />
        </mesh>
      ))}
      <mesh position={[-0.02, 0.058, -0.02]} rotation={[-Math.PI / 2, 0, 0.1]} material={plain('#a33b2c', 0.85)}>
        <planeGeometry args={[0.09, 0.05]} />
      </mesh>
    </group>
  );
}

export default function Bed() {
  const carcass = mat('walnut', { repeat: [W / 0.9, 0.5], normalScale: 0.75 });
  const carcassEnd = mat('walnut', { repeat: [D / 0.9, 0.5], normalScale: 0.75 });
  const plinth = mat('walnut', { repeat: [W / 0.9, 0.3], tint: '#6f5c50', normalScale: 0.7 });
  const mattress = useMemo(() => plain('#2f2e2b', 0.96), []);
  const inset = B.overhang;

  return (
    <group>
      {/* ---------- plinth, inset all round ---------- */}
      <Slab
        size={[W - inset * 2, B.deck - 0.045, D - inset * 2]}
        position={[CX, (B.deck - 0.045) / 2, CZ]}
        material={plinth}
        castShadow
      />

      {/* ---------- deck ---------- */}
      <Panel size={[W, 0.05, D]} position={[CX, B.deck - 0.025, CZ]} material={carcass} radius={0.008} />
      {/* rails, so the deck edge reads as a solid timber frame */}
      <Panel size={[W, 0.075, 0.05]} position={[CX, B.deck - 0.04, B.z0 + 0.025]} material={carcass} radius={0.006} />
      <Panel size={[W, 0.075, 0.05]} position={[CX, B.deck - 0.04, B.z1 - 0.025]} material={carcass} radius={0.006} />
      <Panel size={[0.05, 0.075, D]} position={[B.x0 + 0.025, B.deck - 0.04, CZ]} material={carcassEnd} radius={0.006} />

      {/* ---------- LED slot under the oversail ---------- */}
      {[
        { size: [W - 0.1, 0.014, 0.016] as [number, number, number], pos: [CX, B.deck - 0.075, B.z0 + 0.012] as [number, number, number] },
        { size: [W - 0.1, 0.014, 0.016] as [number, number, number], pos: [CX, B.deck - 0.075, B.z1 - 0.012] as [number, number, number] },
        { size: [0.016, 0.014, D - 0.1] as [number, number, number], pos: [B.x0 + 0.012, B.deck - 0.075, CZ] as [number, number, number] },
      ].map((s, i) => (
        <LedBar key={i} size={s.size} position={s.pos} color={C.warmLED} intensity={2.4} />
      ))}

      {/* ---------- mattress ---------- */}
      <Panel
        size={[W - 0.06, B.mattress, D - 0.06]}
        position={[CX, MATT_Y, CZ]}
        material={mattress}
        radius={0.03}
        smoothness={3}
      />

      <Duvet />
      <Pillows />
      <Hoodie />
    </group>
  );
}
