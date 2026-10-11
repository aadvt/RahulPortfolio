/**
 * The wet pocket carved back into the west wall.
 *
 * One recess holds two things: the curtained door to the corridor at the north
 * end, and the vanity — basin, LED mirror, wall lamp — at the south end, split
 * by a narrow pier that the towel hangs on. Warm limestone lining, tiled floor,
 * a raised plaster surround, a bullnosed threshold step and a single recessed
 * downlight, which is the only shadow caster in the room.
 */

import * as THREE from 'three';
import { useMemo } from 'react';
import { ALCOVE as A, VANITY as V, HALF_W, COVE, C } from '../spec';
import { mat, plain, glow, Panel, Slab, Cyl, Halo, useBullnoseGeometry } from '../kit';
import { M, Plant, Bottle } from '../props/common';
import { fbm } from '../noise';

const BACK = -HALF_W - A.depth; // x of the pocket's back face
const LEN = A.z1 - A.z0;
const CZ = (A.z0 + A.z1) / 2;
const DOOR_W = A.door.z1 - A.door.z0;
const DOOR_CZ = (A.door.z0 + A.door.z1) / 2;
const FLOOR = 0.018; // tiled finish sits a hair above the room slab

/** Pleated curtain panel: a plane folded by a tapering sine, hung from a rod. */
function useCurtainGeometry(width: number, height: number, folds: number, amp: number) {
  return useMemo(() => {
    const g = new THREE.PlaneGeometry(width, height, 96, 36);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const wobble = fbm(6101, 3, 3, 0.5);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const u = x / width + 0.5;
      const t = y / height + 0.5; // 1 at the top, gathered on the rod
      const taper = 0.55 + 0.45 * (1 - t) + 0.12 * wobble(u * 2, 1 - t);
      const phase = Math.PI * 2 * folds * u;
      // Sharper crease on the peaks than in the troughs — real pleats are not sine waves.
      const fold = Math.sign(Math.sin(phase)) * Math.pow(Math.abs(Math.sin(phase)), 0.72);
      pos.setZ(i, fold * amp * taper);
      pos.setX(i, x * (0.985 - 0.02 * Math.abs(fold)));
      pos.setY(i, y + (1 - t) * 0.01 * Math.cos(phase));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [width, height, folds, amp]);
}

/* ------------------------------------------------------------------ */
/* Vanity                                                              */
/* ------------------------------------------------------------------ */

/** Basin, cabinet, LED mirror and the wall lamp over it. */
function Vanity() {
  const body = mat('walnut', { repeat: [0.9, 0.6], tint: '#8a7668', normalScale: 0.7 });
  const face = mat('walnut', { repeat: [0.7, 0.5], tint: '#a08a79', normalScale: 0.7 });
  const x = BACK + V.depth / 2 + 0.01;
  const basinY = V.height;

  return (
    <group position={[0, 0, V.z]}>
      {/* ---------- cabinet ---------- */}
      <group position={[x, 0, 0]}>
        <Panel size={[V.depth, V.height - 0.06, V.width]} position={[0, (V.height - 0.06) / 2 + 0.06 + FLOOR, 0]} material={body} radius={0.008} />
        {/* plinth set back so the cabinet reads as furniture, not a block */}
        <Slab size={[V.depth - 0.05, 0.06, V.width - 0.04]} position={[0.02, 0.03 + FLOOR, 0]} material={plain('#231a14', 0.85)} />
        {/* top drawer + two shaker doors */}
        <Panel size={[0.016, 0.13, V.width - 0.05]} position={[V.depth / 2, V.height - 0.11, 0]} material={face} radius={0.004} />
        {[-1, 1].map((s) => (
          <group key={s} position={[V.depth / 2, V.height * 0.44, (s * V.width) / 4]}>
            <Panel size={[0.016, V.height * 0.55, V.width / 2 - 0.035]} material={face} radius={0.004} />
            <Panel size={[0.006, V.height * 0.42, V.width / 2 - 0.11]} position={[0.01, 0, 0]} material={face} radius={0.003} />
            <Cyl r={0.007} h={0.075} position={[0.026, V.height * 0.26, -s * 0.03]} material={M.steel} segments={10} />
          </group>
        ))}
        <Cyl r={0.007} h={0.09} position={[V.depth / 2 + 0.014, V.height - 0.11, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.steel} segments={10} />

        {/* ---------- counter + basin ---------- */}
        <Panel size={[V.depth + 0.02, 0.03, V.width + 0.02]} position={[0.005, basinY, 0]} material={plain('#2c2723', 0.5)} radius={0.005} />
        <group position={[0.01, basinY + 0.055, 0]}>
          <Panel size={[V.depth * 0.72, 0.1, V.width * 0.72]} material={M.porcelain} radius={0.018} smoothness={3} />
          <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} material={plain('#d8d4cd', 0.25)}>
            <planeGeometry args={[V.width * 0.6, V.depth * 0.56]} />
          </mesh>
          <Cyl r={0.012} h={0.008} position={[0, 0.047, 0]} material={M.chrome} segments={12} />
        </group>
        {/* tap */}
        <group position={[-V.depth * 0.28, basinY + 0.03, 0]}>
          <Cyl r={0.018} h={0.014} position={[0, 0.007, 0]} material={plain('#1e1e20', 0.3, 0.85)} segments={12} />
          <Cyl r={0.011} h={0.15} position={[0, 0.082, 0]} material={plain('#1e1e20', 0.3, 0.85)} segments={12} />
          <mesh position={[0.045, 0.15, 0]} rotation={[0, 0, -Math.PI / 2]} material={plain('#1e1e20', 0.3, 0.85)}>
            <cylinderGeometry args={[0.009, 0.009, 0.1, 12]} />
          </mesh>
          <Cyl r={0.008} h={0.03} position={[0.09, 0.135, 0]} material={plain('#1e1e20', 0.3, 0.85)} segments={10} />
        </group>
        {/* dressing */}
        <Bottle position={[0.02, basinY + 0.03, -V.width * 0.36]} h={0.16} r={0.028} tint="#2a2622" cap="#8d8a84" />
        <Plant position={[0.02, basinY + 0.03, V.width * 0.36]} scale={0.62} seed={4.4} pot={M.concreteGrey} />
      </group>

      {/* ---------- LED mirror ---------- */}
      <group position={[BACK + 0.035, V.mirror.bottom + V.mirror.height / 2, 0]}>
        {/* frame + glass */}
        <Panel size={[0.05, V.mirror.height, V.mirror.width]} material={plain('#1b1b1e', 0.5, 0.3)} radius={0.006} />
        <mesh position={[0.028, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[V.mirror.width - 0.07, V.mirror.height - 0.07]} />
          <meshStandardMaterial color="#2b3038" roughness={0.08} metalness={0.94} envMapIntensity={1.6} />
        </mesh>
        {/* the illuminated border — four bars, mitred */}
        {[
          { s: [0.012, V.mirror.height - 0.055, 0.016] as [number, number, number], p: [0.03, 0, (V.mirror.width - 0.05) / 2] as [number, number, number] },
          { s: [0.012, V.mirror.height - 0.055, 0.016] as [number, number, number], p: [0.03, 0, -(V.mirror.width - 0.05) / 2] as [number, number, number] },
          { s: [0.012, 0.016, V.mirror.width - 0.05] as [number, number, number], p: [0.03, (V.mirror.height - 0.055) / 2, 0] as [number, number, number] },
          { s: [0.012, 0.016, V.mirror.width - 0.05] as [number, number, number], p: [0.03, -(V.mirror.height - 0.055) / 2, 0] as [number, number, number] },
        ].map((b, i) => (
          <mesh key={i} position={b.p} material={glow('#ffd6a8', 2.9)}>
            <boxGeometry args={b.s} />
          </mesh>
        ))}
        <Halo size={[V.mirror.width + 0.4, V.mirror.height + 0.4]} position={[0.06, 0, 0]} rotation={[0, Math.PI / 2, 0]} color="#ffcfa0" opacity={0.16} />
        <pointLight position={[0.3, 0, 0]} color="#ffd0a0" intensity={0.9} distance={2.2} decay={2} />
      </group>

      {/* ---------- gooseneck wall lamp above the mirror ---------- */}
      <group position={[BACK + 0.06, V.mirror.bottom + V.mirror.height + 0.19, 0]}>
        <Cyl r={0.026} h={0.02} position={[-0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={plain('#22201d', 0.55, 0.4)} segments={12} />
        <mesh position={[0.05, -0.01, 0]} rotation={[0, 0, -0.5]} material={plain('#22201d', 0.55, 0.4)} castShadow>
          <boxGeometry args={[0.12, 0.016, 0.016]} />
        </mesh>
        <mesh position={[0.12, -0.05, 0]} material={plain('#22201d', 0.55, 0.4)} castShadow>
          <cylinderGeometry args={[0.075, 0.03, 0.07, 16, 1, true]} />
        </mesh>
        <mesh position={[0.12, -0.086, 0]} material={glow('#ffca8c', 2.4)}>
          <sphereGeometry args={[0.024, 12, 10]} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Pocket                                                              */
/* ------------------------------------------------------------------ */

export default function DoorAlcove() {
  const stone = mat('travertine', { repeat: [LEN / 2, A.height / 2], tint: '#6f6558', normalScale: 0.7 });
  const stoneSide = mat('travertine', { repeat: [A.depth / 2, A.height / 2], tint: '#685d51', normalScale: 0.7 });
  const stoneWarm = mat('travertine', { repeat: [LEN / 2, 0.5], tint: '#8f8069', normalScale: 0.7 });
  const surroundMat = mat('plaster', { repeat: [LEN / 2, A.height / 2], normalScale: 1.2 });
  const tile = mat('tile', { repeat: [A.depth / 0.42, LEN / 0.42], normalScale: 1.0, tint: '#514c46' });
  const dark = plain('#050506', 1);
  const rodMat = plain('#3c3a38', 0.35, 0.85);

  const fabric = useMemo(() => {
    const m = mat('fabric', { repeat: [3, 4] }).clone();
    m.color = new THREE.Color(C.curtain);
    m.side = THREE.DoubleSide;
    m.roughness = 1;
    return m;
  }, []);
  const towelMat = useMemo(() => mat('denim', { repeat: [1, 2], tint: '#d6d0c6', normalScale: 1.2 }), []);

  const stepGeo = useBullnoseGeometry(LEN + A.surround * 2, A.step.out + 0.06, A.step.rise, A.step.round);
  const curtain = useCurtainGeometry(DOOR_W + 0.3, A.door.height - 0.09, 7, 0.055);

  const northSeg = A.door.z0 - A.z0; // back wall north of the door
  const southSeg = A.z1 - A.door.z1; // back wall south of the door (carries the vanity)

  return (
    <group>
      {/* ============ pocket shell ============ */}
      <Slab size={[0.02, A.height, northSeg]} position={[BACK + 0.01, A.height / 2, A.z0 + northSeg / 2]} material={stone} />
      <Slab size={[0.02, A.height, southSeg]} position={[BACK + 0.01, A.height / 2, A.z1 - southSeg / 2]} material={stone} />
      <Slab
        size={[0.02, A.height - A.door.height, DOOR_W]}
        position={[BACK + 0.01, (A.height + A.door.height) / 2, DOOR_CZ]}
        material={stone}
      />
      <Slab size={[A.depth, A.height, 0.02]} position={[BACK + A.depth / 2, A.height / 2, A.z0 + 0.01]} material={stoneSide} />
      <Slab size={[A.depth, A.height, 0.02]} position={[BACK + A.depth / 2, A.height / 2, A.z1 - 0.01]} material={stoneSide} />
      <Slab size={[A.depth, 0.02, LEN]} position={[BACK + A.depth / 2, A.height - 0.01, CZ]} material={stoneWarm} />
      {/* tiled floor */}
      <Slab size={[A.depth, FLOOR, LEN]} position={[BACK + A.depth / 2, FLOOR / 2, CZ]} material={tile} receiveShadow />

      {/* pier splitting the door from the vanity, projecting into the pocket */}
      <Slab
        size={[0.22, A.height, A.pier.z1 - A.pier.z0]}
        position={[BACK + 0.11, A.height / 2, (A.pier.z0 + A.pier.z1) / 2]}
        material={stoneSide}
        castShadow
      />

      {/* exterior cladding of the pocket, seen from above in the hero framing */}
      <Slab
        size={[A.depth + 0.24, 0.4, LEN + 0.48]}
        position={[BACK + A.depth / 2 - 0.12, A.height + 0.2, CZ]}
        material={surroundMat}
      />
      <Slab size={[A.depth + 0.24, A.height, 0.24]} position={[BACK + A.depth / 2 - 0.12, A.height / 2, A.z0 - 0.12]} material={surroundMat} />
      <Slab size={[A.depth + 0.24, A.height, 0.24]} position={[BACK + A.depth / 2 - 0.12, A.height / 2, A.z1 + 0.12]} material={surroundMat} />

      {/* ============ opening lining + surround ============ */}
      <Panel size={[A.lining, A.height, 0.06]} position={[-HALF_W - A.lining / 2, A.height / 2, A.z0 + 0.03]} material={stoneWarm} radius={0.006} />
      <Panel size={[A.lining, A.height, 0.06]} position={[-HALF_W - A.lining / 2, A.height / 2, A.z1 - 0.03]} material={stoneWarm} radius={0.006} />
      <Panel size={[A.lining, 0.06, LEN]} position={[-HALF_W - A.lining / 2, A.height - 0.03, CZ]} material={stoneWarm} radius={0.006} />

      <Slab size={[A.surround, COVE.bottom, 0.16]} position={[-HALF_W + A.surround / 2, COVE.bottom / 2, A.z0 - 0.08]} material={surroundMat} castShadow />
      <Slab size={[A.surround, COVE.bottom, 0.16]} position={[-HALF_W + A.surround / 2, COVE.bottom / 2, A.z1 + 0.08]} material={surroundMat} castShadow />
      <Slab size={[A.surround, 0.16, LEN + 0.32]} position={[-HALF_W + A.surround / 2, A.height + 0.08, CZ]} material={surroundMat} castShadow />

      {/* bullnosed threshold step spilling into the room */}
      <mesh
        geometry={stepGeo}
        position={[-HALF_W - 0.02, 0, CZ - (LEN + A.surround * 2) / 2]}
        material={stoneWarm}
        receiveShadow
        castShadow
      />

      {/* ============ doorway ============ */}
      {/* dark corridor beyond, so the opening reads as depth rather than a hole */}
      <mesh position={[BACK - 0.7, A.door.height / 2, DOOR_CZ]} material={dark}>
        <boxGeometry args={[1.4, A.door.height + 0.6, DOOR_W + 0.5]} />
      </mesh>
      <Slab size={[0.14, A.door.height, 0.03]} position={[BACK - 0.06, A.door.height / 2, A.door.z0 + 0.015]} material={stoneWarm} />
      <Slab size={[0.14, A.door.height, 0.03]} position={[BACK - 0.06, A.door.height / 2, A.door.z1 - 0.015]} material={stoneWarm} />
      <Slab size={[0.14, 0.03, DOOR_W]} position={[BACK - 0.06, A.door.height - 0.015, DOOR_CZ]} material={stoneWarm} />

      {/* curtain rod + finials */}
      <Cyl
        r={0.014}
        h={DOOR_W + 0.34}
        position={[BACK + 0.06, A.door.height - 0.05, DOOR_CZ]}
        rotation={[Math.PI / 2, 0, 0]}
        material={rodMat}
        segments={14}
      />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[BACK + 0.06, A.door.height - 0.05, DOOR_CZ + s * (DOOR_W / 2 + 0.17)]} material={rodMat}>
          <sphereGeometry args={[0.024, 12, 10]} />
        </mesh>
      ))}

      {/* pleated blackout curtain */}
      <mesh
        geometry={curtain}
        material={fabric}
        position={[BACK + 0.06, (A.door.height - 0.09) / 2 + 0.015, DOOR_CZ]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
        receiveShadow
      />

      {/* hand towel on a hook, hung on the pier */}
      <group position={[BACK + 0.235, 1.48, A.pier.z0 + 0.02]}>
        <Cyl r={0.008} h={0.05} rotation={[Math.PI / 2, 0, 0]} material={M.steel} segments={8} />
        <Panel size={[0.028, 0.42, 0.13]} position={[0.01, -0.22, -0.01]} material={towelMat} radius={0.014} smoothness={3} />
        <Panel size={[0.026, 0.2, 0.11]} position={[0.026, -0.14, 0.012]} rotation={[0, 0, 0.06]} material={towelMat} radius={0.012} smoothness={3} />
      </group>

      {/* bath mat on the tiles in front of the vanity */}
      <mesh position={[BACK + A.depth * 0.72, FLOOR + 0.008, V.z + 0.06]} rotation={[-Math.PI / 2, 0, 0.03]} receiveShadow>
        <planeGeometry args={[0.34, 0.5]} />
        <meshStandardMaterial color="#232224" roughness={0.99} />
      </mesh>

      <Vanity />

      {/* ============ downlight over the threshold ============ */}
      <group position={[BACK + 0.26, A.height, A.light.z]}>
        <mesh material={plain('#26241f', 0.55, 0.4)} position={[0, -0.012, 0]}>
          <boxGeometry args={[0.12, 0.028, 0.06]} />
        </mesh>
        <mesh position={[0, -0.028, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.1, 0.045]} />
          <meshBasicMaterial color={new THREE.Color(C.downlight).multiplyScalar(2.6)} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
