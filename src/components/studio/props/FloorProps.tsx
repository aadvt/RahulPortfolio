/**
 * What sits on the floor: the rug, the duffel dumped by the west wall, the
 * skateboard leaning on the plaster, and the pair of high-tops by the bed.
 */

import * as THREE from 'three';
import { useMemo } from 'react';
import { RUG, DUFFEL, SKATE, SNEAKERS, HALF_W } from '../spec';
import { mat, plain, Panel, Slab, Cyl, useDrapeGeometry } from '../kit';
import { M } from './common';
import { deckTexture, rugSurface, tiled } from '../textures';

/* ------------------------------------------------------------------ */
/* Rug                                                                 */
/* ------------------------------------------------------------------ */

/**
 * The rug takes the pile's normal and roughness maps but *not* its albedo: the
 * baked albedo is a mid grey, and on a big unshadowed floor plane that reads
 * several stops lighter than the concrete around it — the exact opposite of the
 * reference's near-black rug. Driving the colour directly keeps the weave.
 */
function useRugMaterials() {
  return useMemo(() => {
    const s = tiled(rugSurface(), RUG.w / 0.34, RUG.d / 0.34);
    const make = (color: string, normalScale: number) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        normalMap: s.normalMap,
        roughnessMap: s.roughnessMap,
        roughness: 1,
        metalness: 0,
        // Zero, not "low": any environment term at all puts a sheen on a
        // two-and-a-half metre flat plane that the reflective concrete beside
        // it does not have, and the rug pops out as a lighter cut-out.
        envMapIntensity: 0.05,
      });
      m.normalScale.set(normalScale, normalScale);
      return m;
    };
    return { pile: make('#1d1c1b', 2.0), border: make('#33302c', 1.1) };
  }, []);
}

export function Rug() {
  // Deliberately a plane, not a slab: a box here picks up the fill light on its
  // top face and separates from the concrete even harder.
  const { pile, border } = useRugMaterials();

  return (
    <group position={[RUG.x, 0, RUG.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]} material={pile} receiveShadow>
        <planeGeometry args={[RUG.w, RUG.d]} />
      </mesh>
      {/* the pile's thickness, so the rug has an edge to catch a highlight */}
      {[-1, 1].map((s) => (
        <Slab key={s} size={[RUG.w, 0.008, 0.024]} position={[0, 0.004, s * (RUG.d / 2 - 0.012)]} material={border} />
      ))}
      {[-1, 1].map((s) => (
        <Slab key={`x${s}`} size={[0.024, 0.008, RUG.d]} position={[s * (RUG.w / 2 - 0.012), 0.004, 0]} material={border} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Duffel bag                                                          */
/* ------------------------------------------------------------------ */

/** Slumped canvas holdall: a squashed capsule, webbing handles, patch pockets. */
export function Duffel() {
  const canvas = mat('denim', { repeat: [2.4, 1.4], tint: '#8f8a6a', normalScale: 1.4 });
  const webbing = plain('#2c2b24', 0.94);

  return (
    <group position={[DUFFEL.x, 0, DUFFEL.z]} rotation={[0, DUFFEL.rot, 0]}>
      {/* body */}
      <mesh position={[0, 0.155, 0]} scale={[1, 0.78, 0.92]} material={canvas} castShadow receiveShadow>
        <capsuleGeometry args={[0.16, 0.36, 6, 20]} />
      </mesh>
      {/* end caps read as the stiffened panels of a real holdall */}
      {[-1, 1].map((s) => (
        <Cyl
          key={s}
          r={0.145}
          h={0.02}
          position={[s * 0.27, 0.155, 0]}
          rotation={[0, 0, Math.PI / 2]}
          material={canvas}
          segments={20}
        />
      ))}
      {/* zip line + pull */}
      <Slab size={[0.5, 0.012, 0.02]} position={[0, 0.29, 0]} material={plain('#7d7c72', 0.5, 0.5)} />
      <Slab size={[0.03, 0.018, 0.012]} position={[0.13, 0.295, 0]} material={M.steel} />
      {/* webbing handles */}
      {[-0.09, 0.09].map((z, i) => (
        <group key={i}>
          <mesh position={[0, 0.3, z]} rotation={[0, 0, 0]} material={webbing} castShadow={false}>
            <torusGeometry args={[0.1, 0.011, 6, 18, Math.PI]} />
          </mesh>
          <Slab size={[0.42, 0.02, 0.024]} position={[0, 0.18, z * 1.55]} material={webbing} />
        </group>
      ))}
      {/* shoulder strap flopped over the top */}
      <mesh position={[-0.06, 0.29, -0.05]} rotation={[0.3, 0.6, 0]} material={webbing} castShadow={false}>
        <boxGeometry args={[0.42, 0.012, 0.035]} />
      </mesh>
      {/* patches */}
      <mesh position={[0.02, 0.19, 0.15]} rotation={[0.06, 0, -0.08]} material={plain('#9c3324', 0.85)}>
        <planeGeometry args={[0.075, 0.045]} />
      </mesh>
      <mesh position={[-0.16, 0.16, 0.145]} rotation={[0.06, 0, 0.1]} material={plain('#c8c2b4', 0.88)}>
        <planeGeometry args={[0.05, 0.036]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Skateboard                                                          */
/* ------------------------------------------------------------------ */

/** Deck leaning tail-down on the west wall, graphic side out. */
export function Skateboard() {
  const len = 0.79;
  const w = 0.205;
  const graphic = useMemo(() => {
    const t = deckTexture();
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.05 });
  }, []);
  const ply = mat('walnut', { repeat: [0.4, 1.6], tint: '#c0a58c', normalScale: 0.6 });
  const truck = plain('#8c9096', 0.34, 0.85);
  const wheel = plain('#e2ddd2', 0.55);

  return (
    <group position={[-HALF_W + 0.145, 0, SKATE.z]} rotation={[0, Math.PI / 2, -SKATE.lean]}>
      <group position={[0, len / 2 + 0.01, 0]}>
        {/* deck: griptape side to the wall, graphic facing the room */}
        <Panel size={[w, len, 0.014]} material={ply} radius={0.05} smoothness={4} castShadow />
        <mesh position={[0, 0, -0.009]} rotation={[0, Math.PI, 0]} material={graphic}>
          <planeGeometry args={[w - 0.008, len - 0.02]} />
        </mesh>
        {/* kicked nose + tail */}
        {[-1, 1].map((s) => (
          <Panel
            key={s}
            size={[w * 0.84, 0.1, 0.013]}
            position={[0, s * (len / 2 - 0.02), s * 0.012]}
            rotation={[s * 0.34, 0, 0]}
            material={ply}
            radius={0.04}
            smoothness={3}
          />
        ))}
        {/* trucks + wheels on the wall side */}
        {[-1, 1].map((s) => (
          <group key={s} position={[0, s * (len / 2 - 0.15), -0.03]}>
            <Slab size={[0.055, 0.05, 0.03]} material={truck} />
            <Cyl r={0.012} h={0.13} rotation={[0, 0, Math.PI / 2]} position={[0, 0, -0.02]} material={truck} segments={10} />
            {[-1, 1].map((t) => (
              <Cyl
                key={t}
                r={0.027}
                h={0.022}
                position={[t * 0.062, 0, -0.02]}
                rotation={[0, 0, Math.PI / 2]}
                material={wheel}
                segments={16}
              />
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* High-tops                                                           */
/* ------------------------------------------------------------------ */

/**
 * One AJ1-silhouette shoe: white midsole, black toe/heel panels, a red quarter
 * and collar, a swoosh, and the tongue standing slightly proud.
 */
function Sneaker({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const white = plain('#e9e5dd', 0.52);
  const black = plain('#1a1a1d', 0.6);
  const red = plain('#8e2b26', 0.6);
  const lace = plain('#d8d3c9', 0.9);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* outsole + midsole */}
      <Panel size={[0.105, 0.026, 0.28]} position={[0, 0.013, 0]} material={M.rubber} radius={0.013} smoothness={3} />
      <Panel size={[0.108, 0.042, 0.278]} position={[0, 0.045, 0]} material={white} radius={0.016} smoothness={3} />
      {/* toe box */}
      <Panel size={[0.098, 0.062, 0.12]} position={[0, 0.088, 0.075]} material={black} radius={0.028} smoothness={4} />
      {/* quarter panel */}
      <Panel size={[0.094, 0.075, 0.13]} position={[0, 0.098, -0.035]} material={red} radius={0.026} smoothness={4} />
      {/* heel counter */}
      <Panel size={[0.09, 0.09, 0.07]} position={[0, 0.115, -0.098]} material={black} radius={0.026} smoothness={4} />
      {/* collar, standing above the heel */}
      <Panel size={[0.084, 0.075, 0.085]} position={[0, 0.165, -0.075]} material={black} radius={0.03} smoothness={4} />
      <mesh position={[0, 0.198, -0.06]} rotation={[0.35, 0, 0]} material={white}>
        <torusGeometry args={[0.036, 0.009, 8, 16]} />
      </mesh>
      {/* tongue + laces */}
      <Panel size={[0.062, 0.05, 0.09]} position={[0, 0.145, 0.015]} rotation={[0.28, 0, 0]} material={white} radius={0.018} smoothness={3} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.132 + i * 0.019, 0.045 - i * 0.02]} rotation={[0.24, 0, 0]} material={lace} castShadow={false}>
          <boxGeometry args={[0.07, 0.006, 0.008]} />
        </mesh>
      ))}
      {/* swoosh */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.05, 0.098, 0.005]} rotation={[0, 0, -0.18]} material={white} castShadow={false}>
          <boxGeometry args={[0.004, 0.022, 0.14]} />
        </mesh>
      ))}
    </group>
  );
}

export function Sneakers() {
  return (
    <group>
      <Sneaker position={[SNEAKERS.x, 0, SNEAKERS.z]} rotation={-0.42} />
      <Sneaker position={[SNEAKERS.x + 0.2, 0, SNEAKERS.z + 0.07]} rotation={-0.16} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Bathroom threshold mat                                              */
/* ------------------------------------------------------------------ */

/** Coir mat outside the pocket, catching the threshold step's shadow. */
export function DoorMat({ z }: { z: number }) {
  const geo = useDrapeGeometry(0.42, 0.62, 0.004, 3, 1.7, 8);
  return (
    <mesh
      geometry={geo}
      position={[-HALF_W + 0.42, 0.006, z]}
      rotation={[-Math.PI / 2, 0, 0.02]}
      material={plain('#211f1e', 0.99)}
      receiveShadow
    />
  );
}

/* ------------------------------------------------------------------ */
/* Grouped export                                                      */
/* ------------------------------------------------------------------ */

export default function FloorProps() {
  return (
    <group>
      <Rug />
      <Duffel />
      <Skateboard />
      <Sneakers />
      <DoorMat z={-1.42} />
      {/* a stray coil of cable by the tower, because rooms are never tidy */}
      <mesh position={[-0.72, 0.03, -1.42]} rotation={[Math.PI / 2, 0, 0.3]} material={M.rubber}>
        <torusGeometry args={[0.075, 0.011, 6, 20]} />
      </mesh>
    </group>
  );
}
