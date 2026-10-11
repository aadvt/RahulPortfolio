'use client';

/**
 * Light as the focus cue.
 *
 * The room has no ceiling fixtures — every photon comes from strips, screens and
 * the city — so the most natural way to say "look here" is the one a set
 * electrician would use: bring the room down and put a soft key on the subject.
 *
 * Two parts, both eased every frame:
 *  - the renderer's exposure drops ~25% whenever a stop is focused. Emitters
 *    (neon, LED tape, the monitor) are not tone-mapped, so they hold their
 *    brightness and the room reads as "lights dimmed", not "image darkened";
 *  - a shadowless spot, parked near the camera's stop position, swings onto the
 *    stop's anchor with a cone sized to the object.
 *
 * The spot is always mounted (intensity 0 on the overview). Adding or removing
 * a light changes every material's shader, and recompiling the whole room on
 * every click would hitch the flight.
 */

import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { VIEWS } from './views';
import { STOPS, useStop, type StopId } from './stops';

const BASE_EXPOSURE = 1.15;
const FOCUS_EXPOSURE = 0.86;

/** Half-size of the subject (m) and how hard to key it. */
const KEY: Record<StopId, { radius: number; intensity: number }> = {
  home: { radius: 1, intensity: 0 },
  work: { radius: 0.75, intensity: 0 }, // the screen lights itself
  about: { radius: 0.16, intensity: 3.2 },
  archive: { radius: 1.05, intensity: 16 },
  rack: { radius: 1.3, intensity: 15 },
  contact: { radius: 1.05, intensity: 8 },
};

export default function FocusLight() {
  const stop = useStop();
  const { gl } = useThree();
  const spot = useRef<THREE.SpotLight>(null);
  const aim = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (spot.current) spot.current.target = aim;
  }, [aim]);

  // Per-stop placement, precomputed: the key sits a little above and to the
  // side of the stop's camera so it models the object instead of flattening it.
  const rigs = useMemo(() => {
    const out = {} as Record<StopId, { pos: THREE.Vector3; target: THREE.Vector3; angle: number }>;
    for (const s of STOPS) {
      const v = VIEWS[s.view];
      const target = new THREE.Vector3(...s.anchor);
      const cam = new THREE.Vector3(...v.position);
      const toCam = cam.clone().sub(target);
      const side = new THREE.Vector3().crossVectors(toCam, new THREE.Vector3(0, 1, 0)).normalize();
      const pos = target
        .clone()
        .add(toCam.multiplyScalar(0.8))
        .add(side.multiplyScalar(0.35))
        .add(new THREE.Vector3(0, 0.45, 0));
      const d = pos.distanceTo(target);
      const angle = Math.min(Math.atan(KEY[s.id].radius / d) * 1.25, 1.1);
      out[s.id] = { pos, target, angle };
    }
    return out;
  }, []);

  const level = useRef(0);

  useFrame((_, dt) => {
    const l = spot.current;
    if (!l) return;
    const rig = rigs[stop.id];
    const key = KEY[stop.id];
    const k = 1 - Math.exp(-dt * 3.2);

    // Light position and aim glide with the camera rather than snapping.
    l.position.lerp(rig.pos, k);
    aim.position.lerp(rig.target, k);
    aim.updateMatrixWorld();
    l.angle += (rig.angle - l.angle) * k;
    l.intensity += (key.intensity - l.intensity) * k;

    const focused = stop.id !== 'home' ? 1 : 0;
    level.current += (focused - level.current) * k;
    gl.toneMappingExposure = BASE_EXPOSURE + (FOCUS_EXPOSURE - BASE_EXPOSURE) * level.current;
  });

  return (
    <>
      <spotLight
        ref={spot}
        position={[0, 2.6, 1.5]}
        intensity={0}
        angle={0.4}
        penumbra={0.85}
        decay={2}
        distance={7}
        color="#fff0de"
      />
      <primitive object={aim} />
    </>
  );
}
