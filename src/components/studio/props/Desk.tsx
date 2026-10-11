/**
 * The editing desk against the graffiti wall: walnut top on a black steel
 * frame, a drawer pedestal at the left, the ultrawide and its speakers, an RGB
 * board, the articulated lamp, and the glass-side tower on the floor beneath.
 *
 * The desk is the brightest thing in the room after the cove, so it carries
 * three of the scene's emitters: the panel itself, the tower, and the lamp.
 */

import * as THREE from 'three';
import { useMemo } from 'react';
import { DESK as D, MONITOR as MON, HALF_D, C } from '../spec';
import { mat, plain, glow, Panel, Slab, Cyl, Ball, Halo } from '../kit';
import { M, Mug, Plant } from './common';
import { towerGlowTexture } from '../textures';
import MonitorScreen from '../parts/MonitorScreen';

const W = D.x1 - D.x0;
const CX = (D.x0 + D.x1) / 2;
const ZBACK = -HALF_D + 0.02;
const ZC = ZBACK + D.depth / 2;
const TOP = D.top;

/* ------------------------------------------------------------------ */
/* Desk-top hardware                                                   */
/* ------------------------------------------------------------------ */

/**
 * 34" ultrawide on a black cantilever stand.
 *
 * This is the chassis only: a shallow arc of segments that gives the panel its
 * curved silhouette. The glass in front of it — the part you can click, and the
 * part the video player lands on — is <MonitorScreen>, which has to stay one
 * flat plane because a CSS-3D panel cannot be bent. The arc is kept gentle
 * (MONITOR.radius) so the two never visibly part company.
 */
function Ultrawide({ x, z }: { x: number; z: number }) {
  const { width: w, height: h, segments: segs, radius } = MON;

  return (
    <group position={[x, TOP, z]}>
      {/* base + column */}
      <Panel size={[0.26, 0.016, 0.18]} position={[0, 0.008, 0.02]} material={M.blackMatte} radius={0.006} />
      <Slab size={[0.05, 0.2, 0.04]} position={[0, 0.11, 0]} material={M.blackMatte} />
      <Slab size={[0.11, 0.09, 0.03]} position={[0, 0.235, -0.012]} material={M.blackMatte} />

      <group position={[0, 0.47, 0]}>
        {Array.from({ length: segs }, (_, i) => {
          const t = (i + 0.5) / segs - 0.5;
          const a = (t * w) / radius;
          const sx = Math.sin(a) * radius;
          const sz = radius - Math.cos(a) * radius;
          const sw = w / segs + 0.002;
          return (
            <group key={i} position={[sx, 0, sz]} rotation={[0, -a, 0]}>
              <Slab size={[sw, h, 0.022]} material={M.blackMatte} castShadow />
            </group>
          );
        })}
        {/* chin bar + brand dot */}
        <Slab size={[w, 0.02, 0.026]} position={[0, -h / 2 - 0.005, 0.012]} material={M.blackMatte} />
      </group>

      {/*
        The panel's spill, thrown on the plaster *behind* it. This used to sit
        160 mm in front of the glass, which is invisible from across the room
        but becomes a full-frame additive haze the moment the camera moves in
        to read the screen.
      */}
      <Halo size={[1.7, 1.0]} position={[0, 0.47, -0.17]} color={C.screen} opacity={0.24} />
    </group>
  );
}

/** Nearfield studio monitor — black cabinet, yellow-ringed woofer. */
function Speaker({ x, z, flip = 1 }: { x: number; z: number; flip?: number }) {
  return (
    <group position={[x, TOP, z]} rotation={[0, flip * 0.24, 0]}>
      <Panel size={[0.135, 0.215, 0.155]} position={[0, 0.108, 0]} material={M.blackMatte} radius={0.008} />
      <Cyl
        r={0.042}
        h={0.008}
        position={[0, 0.082, 0.079]}
        rotation={[Math.PI / 2, 0, 0]}
        material={plain('#d8a028', 0.55)}
        segments={18}
      />
      <Cyl
        r={0.03}
        h={0.01}
        position={[0, 0.082, 0.082]}
        rotation={[Math.PI / 2, 0, 0]}
        material={M.rubber}
        segments={18}
      />
      <Cyl
        r={0.016}
        h={0.006}
        position={[0, 0.166, 0.079]}
        rotation={[Math.PI / 2, 0, 0]}
        material={plain('#3a3d44', 0.4, 0.6)}
        segments={14}
      />
      <mesh position={[0, 0.03, 0.079]} material={glow('#ff7a2a', 1.4)}>
        <sphereGeometry args={[0.0055, 8, 6]} />
      </mesh>
    </group>
  );
}

/** Full-size mechanical board with per-key RGB, sat on the desk mat. */
function Keyboard({ x, z }: { x: number; z: number }) {
  const cols = 19;
  const rows = 5;
  const kw = 0.0185;
  const kd = 0.0185;
  const board = 0.052;

  const keyMats = useMemo(
    () => ['#ff3a6e', '#ff8a2a', '#ffd93a', '#4ade8a', '#3aa8ff', '#9a5cff'].map((c) => glow(c, 0.62)),
    []
  );

  return (
    <group position={[x, TOP, z]} rotation={[0, 0.02, 0]}>
      <Panel size={[cols * kw + 0.028, 0.016, rows * kd + 0.026]} position={[0, 0.008, 0]} material={M.blackMatte} radius={0.004} />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const rowW = r === rows - 1 && c > 3 && c < 13 ? 0 : 1; // spacebar gap
          if (!rowW) return null;
          return (
            <mesh
              key={`${r}-${c}`}
              position={[
                -((cols - 1) * kw) / 2 + c * kw,
                0.0205,
                -((rows - 1) * kd) / 2 + r * kd,
              ]}
              material={plain('#1b1b20', 0.7)}
              castShadow={false}
            >
              <boxGeometry args={[kw - 0.003, 0.008, kd - 0.003]} />
            </mesh>
          );
        })
      )}
      {/* spacebar */}
      <mesh position={[-0.008, 0.0205, ((rows - 1) * kd) / 2]} material={plain('#1b1b20', 0.7)}>
        <boxGeometry args={[kw * 8, 0.008, kd - 0.003]} />
      </mesh>
      {/* the underglow leaking out from between the keycaps */}
      {Array.from({ length: rows }, (_, r) => (
        <mesh key={r} position={[0, 0.0165, -((rows - 1) * kd) / 2 + r * kd]} material={keyMats[r % keyMats.length]}>
          <boxGeometry args={[cols * kw - 0.004, 0.002, kd - 0.006]} />
        </mesh>
      ))}
      <Halo size={[0.52, 0.24]} position={[0, 0.026, 0.01]} rotation={[-Math.PI / 2, 0, 0]} color="#b070ff" opacity={0.3} />
      <mesh position={[0, 0.017, -0.058]} material={glow('#7fd6ff', 0.9)}>
        <boxGeometry args={[cols * kw, 0.003, 0.004]} />
      </mesh>
    </group>
  );
}

/** Articulated desk lamp with an exposed warm bulb, clamped at the left end. */
function DeskLamp({ x, z }: { x: number; z: number }) {
  const arm = plain('#1a1a1e', 0.55, 0.35);
  return (
    <group position={[x, TOP, z]} rotation={[0, 0.5, 0]}>
      <Cyl r={0.055} r2={0.06} h={0.016} position={[0, 0.008, 0]} material={arm} segments={16} />
      <Cyl r={0.011} h={0.42} position={[0, 0.22, 0]} material={arm} segments={10} />
      {/* upper arm reaching over the desk */}
      <mesh position={[0.115, 0.42, 0]} rotation={[0, 0, -0.34]} material={arm} castShadow>
        <boxGeometry args={[0.26, 0.016, 0.016]} />
      </mesh>
      {/* head + shade */}
      <group position={[0.235, 0.375, 0]} rotation={[0, 0, -1.05]}>
        <mesh material={arm} castShadow>
          <cylinderGeometry args={[0.055, 0.036, 0.075, 16, 1, true]} />
        </mesh>
        <mesh position={[0, -0.028, 0]} material={glow('#ffc98a', 1.5)}>
          <sphereGeometry args={[0.019, 12, 10]} />
        </mesh>
      </group>
      <pointLight position={[0.29, 0.3, 0.05]} color="#ffbe86" intensity={2.8} distance={3.0} decay={2} />
    </group>
  );
}

/** Glass-side tower on the floor, lit from the inside. */
function Tower() {
  const t = D.tower;
  const glassMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0d0f18',
        roughness: 0.05,
        metalness: 0.1,
        transmission: 0.55,
        thickness: 0.02,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    []
  );
  const guts = useMemo(
    () => new THREE.MeshBasicMaterial({ map: towerGlowTexture(), toneMapped: false, fog: false }),
    []
  );

  return (
    <group position={[t.x, 0, t.z]} rotation={[0, -0.06, 0]}>
      {/* chassis: five opaque faces, glass on the south */}
      <Slab size={[t.w, t.h, 0.012]} position={[0, t.h / 2, -t.d / 2]} material={M.blackMatte} castShadow />
      <Slab size={[0.012, t.h, t.d]} position={[-t.w / 2, t.h / 2, 0]} material={M.blackMatte} castShadow />
      <Slab size={[0.012, t.h, t.d]} position={[t.w / 2, t.h / 2, 0]} material={M.blackMatte} castShadow />
      <Slab size={[t.w, 0.014, t.d]} position={[0, t.h, 0]} material={M.blackMatte} castShadow />
      <Slab size={[t.w, 0.03, t.d]} position={[0, 0.015, 0]} material={M.blackMatte} />
      {/* the lit interior, then the tinted glass over it */}
      <mesh position={[0, t.h / 2, t.d / 2 - 0.03]} material={guts}>
        <planeGeometry args={[t.w - 0.04, t.h - 0.06]} />
      </mesh>
      <mesh position={[0, t.h / 2, t.d / 2]} material={glassMat}>
        <planeGeometry args={[t.w - 0.014, t.h - 0.02]} />
      </mesh>
      <Halo size={[0.52, 0.56]} position={[0, t.h / 2, t.d / 2 + 0.02]} color={C.rgb} opacity={0.3} />
      <pointLight position={[0, t.h / 2, t.d / 2 + 0.1]} color={C.rgb} intensity={0.45} distance={1.0} decay={2} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

export default function Desk() {
  const top = mat('walnut', { repeat: [W / 0.8, D.depth / 0.8], normalScale: 0.8 });
  const edge = mat('walnut', { repeat: [W / 0.8, 0.1], tint: '#c9b6a4', normalScale: 0.6 });
  const drawerFace = mat('walnut', { repeat: [0.8, 0.3], tint: '#a99384', normalScale: 0.7 });
  const legY = TOP - D.thickness;

  const pw = D.pedestal.x1 - D.pedestal.x0;
  const pcx = (D.pedestal.x0 + D.pedestal.x1) / 2;

  return (
    <group>
      {/* ---------- worktop ---------- */}
      <Panel
        size={[W, D.thickness, D.depth]}
        position={[CX, TOP - D.thickness / 2, ZC]}
        material={top}
        radius={0.008}
      />
      <Slab size={[W, 0.004, 0.004]} position={[CX, TOP - 0.002, ZC + D.depth / 2 - 0.002]} material={edge} />

      {/* ---------- black steel frame at the open (east) end ---------- */}
      {[ZC - D.depth / 2 + 0.07, ZC + D.depth / 2 - 0.07].map((z, i) => (
        <Slab key={i} size={[0.035, legY, 0.035]} position={[D.x1 - 0.06, legY / 2, z]} material={M.steel} castShadow />
      ))}
      <Slab size={[0.03, 0.03, D.depth - 0.14]} position={[D.x1 - 0.06, 0.07, ZC]} material={M.steel} />
      <Slab size={[0.03, 0.03, D.depth - 0.14]} position={[D.x1 - 0.06, legY - 0.03, ZC]} material={M.steel} />
      {/* mid support behind the knee space */}
      <Slab size={[0.03, legY, 0.03]} position={[-1.62, legY / 2, ZC - D.depth / 2 + 0.07]} material={M.steel} />
      {/* modesty rail running the length of the back */}
      <Slab size={[W - 0.2, 0.05, 0.02]} position={[CX, legY - 0.09, ZBACK + 0.03]} material={M.steel} />

      {/* ---------- drawer pedestal ---------- */}
      <group position={[pcx, 0, ZC + 0.02]}>
        <Panel size={[pw, legY, D.depth - 0.06]} position={[0, legY / 2, 0]} material={drawerFace} radius={0.008} />
        {Array.from({ length: D.pedestal.drawers }, (_, i) => {
          const dh = (legY - 0.06) / D.pedestal.drawers;
          const y = 0.04 + dh * (i + 0.5);
          return (
            <group key={i}>
              <Panel
                size={[pw - 0.02, dh - 0.012, 0.022]}
                position={[0, y, (D.depth - 0.06) / 2]}
                material={drawerFace}
                radius={0.005}
              />
              <Cyl
                r={0.008}
                h={0.13}
                position={[0, y, (D.depth - 0.06) / 2 + 0.026]}
                rotation={[0, 0, Math.PI / 2]}
                material={M.steel}
                segments={10}
              />
            </group>
          );
        })}
        {/* plinth */}
        <Slab size={[pw - 0.03, 0.04, D.depth - 0.1]} position={[0, 0.02, 0]} material={M.steel} />
      </group>

      {/* ---------- desk mat ---------- */}
      <mesh position={[CX + 0.06, TOP + 0.002, ZC + 0.11]} rotation={[-Math.PI / 2, 0, 0.01]} receiveShadow>
        <planeGeometry args={[0.94, 0.34]} />
        <meshStandardMaterial color="#141418" roughness={0.95} />
      </mesh>

      {/* ---------- hardware ---------- */}
      <Ultrawide x={MON.x} z={MON.z} />
      <MonitorScreen />
      <Speaker x={D.x0 + 0.46} z={ZBACK + 0.2} flip={-1} />
      <Speaker x={D.x1 - 0.34} z={ZBACK + 0.2} flip={1} />
      <Keyboard x={CX - 0.02} z={ZC + 0.13} />
      <DeskLamp x={D.x0 + 0.16} z={ZBACK + 0.2} />
      <Tower />

      {/* mouse */}
      <group position={[CX + 0.42, TOP + 0.004, ZC + 0.1]}>
        <Ball r={0.036} scale={[0.72, 0.5, 1.15]} position={[0, 0.016, 0]} material={M.blackMatte} />
        <mesh position={[0, 0.005, 0]} material={glow('#8a3cff', 0.9)}>
          <boxGeometry args={[0.05, 0.002, 0.075]} />
        </mesh>
      </group>

      {/* DSLR body + lens, parked left of the board */}
      <group position={[D.x0 + 0.38, TOP, ZC + 0.08]} rotation={[0, 0.65, 0]}>
        <Panel size={[0.13, 0.09, 0.055]} position={[0, 0.045, 0]} material={M.blackMatte} radius={0.008} />
        <Panel size={[0.045, 0.03, 0.04]} position={[-0.028, 0.1, 0]} material={M.blackMatte} radius={0.006} />
        <Cyl r={0.036} h={0.075} position={[0, 0.05, 0.062]} rotation={[Math.PI / 2, 0, 0]} material={M.blackMatte} segments={18} />
        <Cyl r={0.031} h={0.006} position={[0, 0.05, 0.1]} rotation={[Math.PI / 2, 0, 0]} material={plain('#10141c', 0.15, 0.6)} segments={18} />
      </group>

      {/* mug, phone, notebook, plant */}
      <Mug position={[D.x0 + 0.66, TOP, ZC + 0.19]} />
      <group position={[D.x1 - 0.24, TOP + 0.006, ZC + 0.1]} rotation={[0, -0.35, 0]}>
        <Panel size={[0.072, 0.008, 0.148]} material={M.blackMatte} radius={0.008} />
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} material={glow('#3f6fd8', 0.7)}>
          <planeGeometry args={[0.062, 0.134]} />
        </mesh>
      </group>
      <group position={[D.x0 + 0.9, TOP + 0.008, ZC + 0.2]} rotation={[0, 0.12, 0]}>
        <Panel size={[0.18, 0.014, 0.24]} material={M.paper} radius={0.004} />
        <Panel size={[0.19, 0.008, 0.25]} position={[0, -0.008, 0]} material={plain('#2a2622', 0.85)} radius={0.004} />
      </group>
      <Plant position={[D.x1 - 0.2, TOP, ZBACK + 0.2]} scale={0.92} seed={0.7} pot={M.terracotta} />

      {/* cable dropping off the back edge to the tower */}
      <Cyl
        r={0.006}
        h={0.5}
        position={[D.x1 - 0.5, 0.26, ZBACK + 0.05]}
        rotation={[0.12, 0, 0.08]}
        material={M.rubber}
        segments={8}
        castShadow={false}
      />
    </group>
  );
}
