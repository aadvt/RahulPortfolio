/**
 * Mesh-back task chair, with the tan lanyard and ID badge slung over its
 * backrest exactly as in the reference — that badge is the one warm accent in
 * an otherwise entirely black object, so it earns its polygons.
 */

import * as THREE from 'three';
import { useMemo } from 'react';
import { CHAIR } from '../spec';
import { plain, Panel, Slab, Cyl } from '../kit';
import { M } from './common';

const SEAT_Y = 0.47;

/** Perforated mesh — an alpha-punched grid so the back reads as fabric weave. */
function useMeshMaterial() {
  return useMemo(() => {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#fff';
    for (let y = 0; y < S; y += 8)
      for (let x = 0; x < S; x += 8) ctx.fillRect(x + 1, y + 1, 5.5, 5.5);
    const alpha = new THREE.CanvasTexture(c);
    alpha.wrapS = alpha.wrapT = THREE.RepeatWrapping;
    alpha.repeat.set(26, 26);
    return new THREE.MeshStandardMaterial({
      color: '#1a1a1e',
      roughness: 0.9,
      alphaMap: alpha,
      transparent: true,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
    });
  }, []);
}

export default function Chair() {
  const mesh = useMeshMaterial();
  const frame = plain('#131316', 0.55, 0.3);

  // Slightly curved backrest: a lathe of a shallow arc, cut to a panel width.
  const backGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.42, 0.44, 0.56, 20, 6, true, Math.PI * 0.72, Math.PI * 0.56);
    return g;
  }, []);

  return (
    <group position={[CHAIR.x, 0, CHAIR.z]} rotation={[0, CHAIR.rot, 0]}>
      {/* ---------- base ---------- */}
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[0, 0.055, 0.16]} rotation={[0.055, 0, 0]} material={frame} castShadow>
              <boxGeometry args={[0.045, 0.03, 0.33]} />
            </mesh>
            <Cyl
              r={0.032}
              h={0.026}
              position={[0, 0.032, 0.315]}
              rotation={[Math.PI / 2, 0, 0]}
              material={M.rubber}
              segments={14}
            />
          </group>
        );
      })}
      <Cyl r={0.055} h={0.05} position={[0, 0.075, 0]} material={frame} segments={16} />
      <Cyl r={0.03} h={0.28} position={[0, 0.22, 0]} material={M.chrome} segments={14} />
      <Cyl r={0.042} h={0.09} position={[0, 0.4, 0]} material={frame} segments={14} />

      {/* ---------- seat ---------- */}
      <Panel size={[0.47, 0.06, 0.45]} position={[0, SEAT_Y, 0.02]} material={plain('#17171b', 0.88)} radius={0.024} smoothness={3} />
      <Panel size={[0.44, 0.03, 0.42]} position={[0, SEAT_Y + 0.038, 0.02]} material={plain('#202024', 0.92)} radius={0.02} smoothness={3} />
      {/* tilt mechanism + paddle */}
      <Slab size={[0.14, 0.05, 0.2]} position={[0, SEAT_Y - 0.05, 0]} material={frame} />
      <Cyl r={0.008} h={0.16} position={[0.16, SEAT_Y - 0.05, 0.06]} rotation={[0, 0, Math.PI / 2]} material={frame} segments={8} />

      {/* ---------- back frame + mesh ---------- */}
      <group position={[0, 0, -0.22]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.245, 0.76, 0.03]} rotation={[0.11, 0, s * 0.04]} material={frame} castShadow>
            <boxGeometry args={[0.032, 0.62, 0.038]} />
          </mesh>
        ))}
        <mesh position={[0, 1.05, -0.006]} rotation={[0.11, 0, 0]} material={frame} castShadow>
          <boxGeometry args={[0.52, 0.05, 0.045]} />
        </mesh>
        <mesh position={[0, 0.5, 0.055]} rotation={[0.11, 0, 0]} material={frame}>
          <boxGeometry args={[0.5, 0.05, 0.05]} />
        </mesh>
        {/* the mesh panel itself */}
        <mesh geometry={backGeo} position={[0, 0.77, 0.42]} rotation={[0.11, 0, 0]} material={mesh} />
        {/* lumbar pad */}
        <mesh position={[0, 0.6, 0.045]} rotation={[0.11, 0, 0]} material={plain('#1c1c20', 0.9)} castShadow>
          <boxGeometry args={[0.34, 0.09, 0.03]} />
        </mesh>
      </group>

      {/* ---------- armrests ---------- */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.27, 0, -0.02]}>
          <mesh position={[0, SEAT_Y + 0.11, -0.06]} rotation={[0, 0, -s * 0.08]} material={frame} castShadow>
            <boxGeometry args={[0.028, 0.2, 0.05]} />
          </mesh>
          <Panel size={[0.06, 0.024, 0.24]} position={[0, SEAT_Y + 0.215, -0.02]} material={plain('#1e1e22', 0.85)} radius={0.01} />
        </group>
      ))}

      {/*
        Lanyard + clip. The card itself hangs off the bottom of this but is
        rendered by <IdBadge> at world coordinates (spec.BADGE), because it is
        clickable and the camera that reads it needs those numbers.
      */}
      <group position={[0.02, 0, -0.19]}>
        {/* the two strap runs, front and back of the top rail */}
        <mesh position={[-0.03, 0.86, 0.05]} rotation={[0.11, 0, 0.06]} material={plain('#a2622c', 0.9)} castShadow={false}>
          <boxGeometry args={[0.018, 0.4, 0.004]} />
        </mesh>
        <mesh position={[0.04, 0.86, 0.05]} rotation={[0.11, 0, -0.05]} material={plain('#a2622c', 0.9)} castShadow={false}>
          <boxGeometry args={[0.018, 0.4, 0.004]} />
        </mesh>
        <mesh position={[0.005, 0.655, 0.072]} material={plain('#3a3a3e', 0.6, 0.4)}>
          <boxGeometry args={[0.03, 0.022, 0.006]} />
        </mesh>
      </group>
    </group>
  );
}
