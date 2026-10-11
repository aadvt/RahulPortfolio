/**
 * The north-east corner: the stacked laundry tower the bed head tucks beside,
 * the narrow utility bay, the neon bolt on the pier next to it, and the
 * nightstand against the east wall.
 *
 * The tower faces south for the same reason all the other joinery does — the
 * hero camera only ever sees south- and east-facing surfaces.
 */

import * as THREE from 'three';
import { useMemo } from 'react';
import { LAUNDRY as L, NIGHTSTAND as N, BOLT, HALF_W, HALF_D, C } from '../spec';
import { mat, plain, glow, Panel, Slab, Cyl, Halo, useNeonGeometry } from '../kit';
import { M, ShelfLED, Lantern, Basket, TowelStack, Bottle, StorageBox, Plant } from './common';

const walnut = (u: number, v: number) => mat('walnut', { repeat: [u, v], normalScale: 0.7 });
const stone = (u: number, v: number) => mat('travertine', { repeat: [u, v], tint: '#9c9184', normalScale: 0.9 });

/* ------------------------------------------------------------------ */
/* Front-loader                                                        */
/* ------------------------------------------------------------------ */

/**
 * One machine, facing south. The face is set back inside a brushed bezel and
 * the door is a deep-set glass dish, which is what makes the pair read as
 * appliances rather than as stacked boxes.
 */
function Machine({ x, y, size }: { x: number; y: number; size: number }) {
  const face = -HALF_D + L.depth - 0.03; // z of the front panel
  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#10151c',
        roughness: 0.06,
        metalness: 0.1,
        transmission: 0.4,
        thickness: 0.03,
        transparent: true,
        opacity: 0.72,
      }),
    []
  );

  return (
    <group position={[x, y + size / 2, face]}>
      {/* body */}
      <Panel size={[size, size, L.depth - 0.06]} position={[0, 0, -(L.depth - 0.06) / 2 + 0.005]} material={M.brushed} radius={0.01} />
      {/* recessed front panel */}
      <Panel size={[size - 0.03, size - 0.03, 0.02]} position={[0, 0, 0.004]} material={plain('#9ea2a7', 0.4, 0.8)} radius={0.008} />
      {/* control strip */}
      <Slab size={[size - 0.07, 0.07, 0.014]} position={[0, size / 2 - 0.058, 0.014]} material={plain('#5c6067', 0.35, 0.85)} />
      <mesh position={[size * 0.24, size / 2 - 0.058, 0.023]} material={glow('#7fd6ff', 0.85)}>
        <planeGeometry args={[0.07, 0.024]} />
      </mesh>
      <Cyl
        r={0.022}
        h={0.016}
        position={[-size * 0.3, size / 2 - 0.058, 0.023]}
        rotation={[Math.PI / 2, 0, 0]}
        material={plain('#3d4146', 0.4, 0.7)}
        segments={16}
      />
      {/* door: bezel ring, dished glass, hinge */}
      <Cyl
        r={size * 0.34}
        h={0.03}
        position={[0, -0.02, 0.018]}
        rotation={[Math.PI / 2, 0, 0]}
        material={plain('#c6cad0', 0.3, 0.85)}
        segments={30}
      />
      <Cyl
        r={size * 0.29}
        h={0.05}
        position={[0, -0.02, -0.004]}
        rotation={[Math.PI / 2, 0, 0]}
        material={plain('#23272e', 0.45, 0.5)}
        segments={30}
      />
      <mesh position={[0, -0.02, 0.026]} material={glass}>
        <circleGeometry args={[size * 0.28, 30]} />
      </mesh>
      <Slab size={[0.022, 0.09, 0.02]} position={[size * 0.34, -0.02, 0.03]} material={plain('#b0b4ba', 0.3, 0.85)} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Laundry tower                                                       */
/* ------------------------------------------------------------------ */

export function LaundryTower() {
  const w = L.x1 - L.x0;
  const d = L.depth;
  const f = L.frame;
  const inner = w - f * 2;
  const cx = (L.x0 + L.x1) / 2;
  const top = L.height;
  const zBack = -HALF_D;
  const zc = zBack + d / 2;

  const carcass = walnut(1.1, 2.6);
  const board = walnut(1.1, 0.4);
  const back = stone(1.0, 2.2);

  // the machine bay runs from the west end; the utility bay takes the rest
  const machineW = inner * L.split;
  const utilW = inner - machineW;
  const machineCx = L.x0 + f + machineW / 2;
  const utilCx = L.x1 - f - utilW / 2;
  const dividerX = L.x0 + f + machineW;

  const m = L.machine.size;
  const lowerY = L.machineBase;
  const upperY = lowerY + m + L.machine.gap;
  // stack top sits just under the full-width shelf

  return (
    <group>
      {/* back panel against the wall */}
      <Slab size={[inner, top - L.plinth, 0.018]} position={[cx, (top + L.plinth) / 2, zBack + 0.02]} material={back} />

      {/* carcass: two sides, top, base, divider */}
      <Panel size={[f, top, d]} position={[L.x0 + f / 2, top / 2, zc]} material={carcass} />
      <Panel size={[f, top, d]} position={[L.x1 - f / 2, top / 2, zc]} material={carcass} />
      <Panel size={[w, f, d]} position={[cx, top - f / 2, zc]} material={board} />
      <Panel size={[inner, f, d - 0.02]} position={[cx, L.plinth + f / 2, zc]} material={board} />
      <Slab size={[w - 0.02, L.plinth, d - 0.05]} position={[cx, L.plinth / 2, zc - 0.025]} material={walnut(1, 0.2)} />
      <Panel size={[f * 0.8, top - L.plinth - f, d - 0.02]} position={[dividerX, (top + L.plinth + f) / 2, zc]} material={carcass} />

      {/* full-width top shelf with a proud nosing */}
      <Panel size={[inner, 0.04, d - 0.02]} position={[cx, L.topShelf, zc]} material={board} />
      <Panel size={[inner, 0.05, 0.016]} position={[cx, L.topShelf, zBack + d - 0.022]} material={board} radius={0.004} />

      {/* ---------- machines ---------- */}
      <Machine x={machineCx} y={lowerY} size={m} />
      <Machine x={machineCx} y={upperY} size={m} />
      {/* strip under the top shelf, washing down over the machine fronts */}
      <ShelfLED length={machineW - 0.07} position={[machineCx, L.topShelf - 0.05, zBack + d - 0.07]} intensity={1.8} />

      {/* ---------- utility bay ---------- */}
      {[
        { y: 0.66, kind: 'towels' as const },
        { y: 1.12, kind: 'lantern' as const },
        { y: 1.56, kind: 'boxes' as const },
      ].map(({ y, kind }) => (
        <group key={y}>
          <Panel size={[utilW, 0.032, d - 0.04]} position={[utilCx, y, zc]} material={board} />
          <ShelfLED length={utilW - 0.04} position={[utilCx, y + 0.4, zBack + d - 0.07]} intensity={1.5} />
          {kind === 'towels' && <TowelStack position={[utilCx, y + 0.016, zc]} w={utilW * 0.78} d={d * 0.6} count={3} />}
          {kind === 'lantern' && <Lantern position={[utilCx, y + 0.016, zc]} scale={0.86} />}
          {kind === 'boxes' && (
            <StorageBox size={[utilW * 0.76, 0.16, d * 0.55]} position={[utilCx, y + 0.096, zc]} tint="#3a3c41" />
          )}
        </group>
      ))}
      {/* laundry basket on the floor of the bay */}
      <Basket size={[utilW * 0.8, 0.34, d * 0.58]} position={[utilCx, L.plinth + 0.04, zc]} tint="#7c7568" />
      {/* hamper under the machines, where the reference keeps its wash pile */}
      <Basket size={[machineW * 0.62, 0.36, d * 0.56]} position={[machineCx, L.plinth + 0.04, zc]} tint="#6f6a5f" />

      {/* ---------- top shelf dressing ---------- */}
      <Bottle position={[L.x0 + 0.22, L.topShelf + 0.02, zc - 0.06]} h={0.26} r={0.052} tint="#2456b8" />
      <Bottle position={[L.x0 + 0.38, L.topShelf + 0.02, zc + 0.08]} h={0.2} r={0.04} tint="#3a74d8" />
      <Bottle position={[L.x0 + 0.52, L.topShelf + 0.02, zc - 0.04]} h={0.22} r={0.043} tint="#1f49a0" cap="#c8c4bc" />
      <Basket size={[0.3, 0.19, d * 0.6]} position={[L.x1 - 0.26, L.topShelf + 0.02, zc]} tint="#9a9184" />
      <ShelfLED length={inner - 0.07} position={[cx, top - f - 0.05, zBack + d - 0.07]} intensity={1.6} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Nightstand                                                          */
/* ------------------------------------------------------------------ */

export function Nightstand() {
  const body = walnut(0.8, 0.5);
  const face = mat('walnut', { repeat: [0.8, 0.3], tint: '#a99384', normalScale: 0.7 });

  return (
    <group position={[N.x, 0, N.z]}>
      <Panel size={[N.w, N.h - 0.07, N.d]} position={[0, (N.h - 0.07) / 2 + 0.07, 0]} material={body} radius={0.008} />
      {/* two drawer faces + steel pulls, facing west toward the room */}
      {[0, 1].map((i) => (
        <group key={i} position={[-N.w / 2, 0.19 + i * 0.21, 0]}>
          <Panel size={[0.018, 0.17, N.d - 0.05]} material={face} radius={0.005} />
          <Cyl r={0.007} h={0.1} rotation={[Math.PI / 2, 0, 0]} position={[-0.02, 0, 0]} material={M.steel} segments={10} />
        </group>
      ))}
      {/* splayed legs */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh
          key={i}
          position={[sx * (N.w / 2 - 0.05), 0.035, sz * (N.d / 2 - 0.05)]}
          rotation={[sz * 0.09, 0, -sx * 0.09]}
          material={M.steel}
          castShadow
        >
          <boxGeometry args={[0.028, 0.075, 0.028]} />
        </mesh>
      ))}
      {/* top surface + what's on it */}
      <Panel size={[N.w + 0.03, 0.028, N.d + 0.03]} position={[0, N.h, 0]} material={body} radius={0.006} />
      <Lantern position={[0.02, N.h + 0.014, -0.04]} scale={1.05} />
      <Plant position={[-0.16, N.h + 0.014, 0.1]} scale={0.72} seed={3.3} />
      <Plant position={[0.18, N.h + 0.014, 0.14]} scale={0.62} seed={5.1} pot={M.terracotta} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Neon bolt                                                           */
/* ------------------------------------------------------------------ */

const BOLT_PATH: [number, number][] = [
  [0.055, 0.26],
  [-0.085, 0.025],
  [0.02, 0.025],
  [-0.06, -0.26],
  [0.09, -0.045],
  [-0.012, -0.045],
];

export function NeonBolt() {
  const s = BOLT.height / 0.52;
  const geo = useNeonGeometry(BOLT_PATH, 0.012, true);
  const tube = useMemo(() => glow(C.neon, 3.6), []);

  return (
    <group position={[BOLT.x, BOLT.y, -HALF_D + 0.03]} scale={s}>
      <mesh geometry={geo} material={tube} />
      <Halo size={[0.62, 0.86]} position={[0, 0, 0.01]} color={C.neon} opacity={0.55} />
      <pointLight position={[0, 0, 0.3]} color={C.neon} intensity={1.2} distance={2.6} decay={2} />
    </group>
  );
}
