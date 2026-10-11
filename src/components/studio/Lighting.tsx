/**
 * Lighting rig.
 *
 * The reference room has no ceiling fixtures at all — every photon comes from
 * the perimeter LED cove, the warm strips inside the joinery and under the bed,
 * the monitor, one downlight in the alcove, and the city outside. This rig
 * mirrors that exactly, using area lights so the wall washes keep the soft
 * linear falloff of a real LED tape.
 *
 * Props carry their own small point lights (lanterns, neon, the desk lamp).
 * What lives here is only the geometry-scale lighting: the emitters big enough
 * to change the shape of the room.
 */

import * as THREE from 'three';
import { useLayoutEffect, useRef } from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  ROOM,
  HALF_W,
  HALF_D,
  COVE,
  SHELF as SH,
  WARDROBE as WD,
  LAUNDRY as L,
  BED as B,
  WINDOW as W,
  ALCOVE as A,
  DESK as D,
  C,
} from './spec';

RectAreaLightUniformsLib.init();

/** Tuning knobs — every emitter's output in one place. */
const I = {
  // The cove is a grazing light, not a room light: it has to read as a violet
  // band on the ceiling and a reflection on the floor, and die off within a
  // metre of the strip. Too much here and the whole room turns purple.
  cove: 3.4,
  shelf: 9,
  wardrobe: 13,
  laundry: 3.4,
  bed: 2.6,
  monitor: 3.2,
  deskLamp: 5.5,
  window: 5,
  alcoveSpot: 24,
  alcoveBounce: 1.3,
  // Point-light intensities are in candela (three's physical units), so
  // these read high next to the rect-area numbers above. A 2 m throw needs
  // roughly intensity / d^2 to land near 1.0 for concrete to read as concrete.
  fill: 13,
  ambient: 0.5,
  hemi: 0.5,
};

type V3 = [number, number, number];

function AreaLight({
  position,
  target,
  width,
  height,
  color,
  intensity,
}: {
  position: V3;
  target: V3;
  width: number;
  height: number;
  color: string;
  intensity: number;
}) {
  const ref = useRef<THREE.RectAreaLight>(null);
  useLayoutEffect(() => {
    ref.current?.lookAt(target[0], target[1], target[2]);
  }, [target]);
  return (
    <rectAreaLight
      ref={ref}
      position={position}
      width={width}
      height={height}
      color={color}
      intensity={intensity}
    />
  );
}

export default function Lighting() {
  const spot = useRef<THREE.SpotLight>(null);
  const spotTarget = useRef<THREE.Object3D>(null);
  useLayoutEffect(() => {
    if (spot.current && spotTarget.current) spot.current.target = spotTarget.current;
  }, []);

  const back = -HALF_W - A.depth;
  const coveOut = COVE.setback + 0.02;

  const shelfCx = (SH.x0 + SH.x1) / 2;
  const wdCx = (WD.x0 + WD.x1) / 2;
  const laundryCx = (L.x0 + L.x1) / 2;
  const bedCx = (B.x0 + B.x1) / 2;
  const bedCz = (B.z0 + B.z1) / 2;
  const deskCx = (D.x0 + D.x1) / 2;

  return (
    <>
      {/* Ambience is neutral warm grey — the plaster's own colour. Tinting it
          violet was what flooded every wall with purple. */}
      <ambientLight intensity={I.ambient} color="#7a7068" />
      <hemisphereLight args={['#7a7370', '#2a2320', I.hemi]} />

      {/* Two soft fills standing in for interreflection off the floor and
          ceiling. Without them the concrete slab goes to black between the
          light pools and the room stops reading as a lit interior — the
          reference's floor is clearly legible everywhere. */}
      <pointLight position={[-0.6, 2.2, 0.4]} intensity={I.fill} distance={11} decay={2} color="#f6e0cb" />
      <pointLight position={[1.5, 2.2, -0.4]} intensity={I.fill * 0.55} distance={9} decay={2} color="#e8dcd0" />

      {/* ---------- perimeter LED cove: one emitter per wall, angled up ---------- */}
      <AreaLight
        position={[0, COVE.stripY, -HALF_D - coveOut]}
        target={[0, ROOM.height + 0.55, -HALF_D + 0.16]}
        width={ROOM.width}
        height={0.09}
        color={C.neonLight}
        intensity={I.cove}
      />
      <AreaLight
        position={[0, COVE.stripY, HALF_D + coveOut]}
        target={[0, ROOM.height + 0.55, HALF_D - 0.16]}
        width={ROOM.width}
        height={0.09}
        color={C.neonLight}
        intensity={I.cove}
      />
      <AreaLight
        position={[-HALF_W - coveOut, COVE.stripY, 0]}
        target={[-HALF_W + 0.16, ROOM.height + 0.55, 0]}
        width={ROOM.depth}
        height={0.09}
        color={C.neonLight}
        intensity={I.cove}
      />
      <AreaLight
        position={[HALF_W + coveOut, COVE.stripY, 0]}
        target={[HALF_W - 0.16, ROOM.height + 0.55, 0]}
        width={ROOM.depth}
        height={0.09}
        color={C.neonLight}
        intensity={I.cove}
      />

      {/* ---------- warm strips inside the display shelf ---------- */}
      {SH.litBays.map((b) => {
        const yTop = SH.shelves[b + 1] ?? SH.height - SH.frame;
        const z = -HALF_D + SH.depth - 0.08;
        return (
          <AreaLight
            key={b}
            position={[shelfCx, yTop - 0.08, z]}
            target={[shelfCx, yTop - 0.5, -HALF_D + 0.05]}
            width={SH.x1 - SH.x0 - 0.12}
            height={0.05}
            color={C.warmLED}
            intensity={I.shelf}
          />
        );
      })}

      {/* ---------- wardrobe rail wash ---------- */}
      <AreaLight
        position={[wdCx, WD.topShelf - 0.07, -HALF_D + WD.depth - 0.1]}
        target={[wdCx, WD.railY - 0.5, -HALF_D + 0.1]}
        width={WD.x1 - WD.x0 - 0.14}
        height={0.05}
        color={C.warmLED}
        intensity={I.wardrobe}
      />

      {/* ---------- laundry tower shelves ---------- */}
      <AreaLight
        position={[laundryCx, 1.5, -HALF_D + L.depth - 0.09]}
        target={[laundryCx, 1.0, -HALF_D + 0.1]}
        width={L.x1 - L.x0 - 0.16}
        height={0.05}
        color={C.warmLED}
        intensity={I.laundry}
      />

      {/* ---------- bed underglow: a long, low wash across the floor ---------- */}
      <AreaLight
        position={[bedCx, B.deck - 0.09, B.z1 + 0.02]}
        target={[bedCx, -0.5, B.z1 + 0.9]}
        width={B.x1 - B.x0}
        height={0.05}
        color={C.warmLED}
        intensity={I.bed}
      />
      <AreaLight
        position={[B.x0 - 0.02, B.deck - 0.09, bedCz]}
        target={[B.x0 - 0.8, -0.5, bedCz]}
        width={0.05}
        height={B.z1 - B.z0}
        color={C.warmLED}
        intensity={I.bed}
      />

      {/* ---------- the ultrawide, throwing cool light back at the wall ---------- */}
      <AreaLight
        position={[deskCx + 0.02, D.top + 0.47, -HALF_D + 0.24]}
        target={[deskCx + 0.02, D.top + 0.3, HALF_D]}
        width={1.0}
        height={0.42}
        color={C.screen}
        intensity={I.monitor}
      />

      {/* ---------- desk lamp wash across the graffiti ---------- */}
      {/* The tag only exists because the lamp throws light up the wall behind
          the desk. Without this the whole west third of the north wall goes to
          black and the room loses its title card. */}
      <AreaLight
        position={[D.x0 + 0.5, 1.5, -HALF_D + 0.16]}
        target={[D.x0 + 0.9, 2.5, -HALF_D + 0.02]}
        width={1.5}
        height={0.9}
        color="#ffbe86"
        intensity={I.deskLamp}
      />

      {/* ---------- city light through the glass ---------- */}
      <AreaLight
        position={[W.centerX, (W.sill + W.head) / 2, -HALF_D - W.reveal + 0.02]}
        target={[W.centerX - 0.3, 0.9, -HALF_D + 2.2]}
        width={W.width}
        height={W.head - W.sill}
        color={C.cityGlow}
        intensity={I.window}
      />

      {/* ---------- alcove downlight (the only shadow caster) ---------- */}
      <spotLight
        ref={spot}
        position={[back + 0.26, A.height - 0.04, A.light.z]}
        angle={0.62}
        penumbra={0.62}
        decay={2}
        distance={7}
        intensity={I.alcoveSpot}
        color={C.downlight}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0012}
        shadow-normalBias={0.02}
        shadow-camera-near={0.15}
        shadow-camera-far={6}
      />
      <object3D ref={spotTarget} position={[back + 0.44, 0, A.light.z + 0.12]} />
      <pointLight
        position={[back + 0.35, 1.1, A.light.z + 0.1]}
        intensity={I.alcoveBounce}
        distance={3.2}
        decay={2}
        color="#ffb98a"
      />

      {/* ---------- specular environment (generated locally, no assets) ---------- */}
      {/* Kept close to neutral — a violet environment tints every specular in
          the room and was doubling up on the cove wash. */}
      <Environment resolution={64} frames={1} background={false}>
        <Lightformer intensity={0.55} color="#b9b2ae" position={[0, 3.4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 6, 1]} />
        <Lightformer intensity={0.5} color={C.neon} position={[0, 2.95, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 1.2, 1]} />
        <Lightformer intensity={1.1} color={C.warmLED} position={[0.6, 1.6, -2.4]} rotation={[0, Math.PI, 0]} scale={[3, 2, 1]} />
        <Lightformer intensity={0.7} color={C.cityGlow} position={[2.3, 1.4, -3.2]} scale={[3, 3, 1]} />
      </Environment>
    </>
  );
}
