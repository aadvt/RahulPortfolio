/**
 * Recessed city window — north wall.
 *
 * Plaster reveal + stone sill, a dark steel frame set 160 mm back, two glazed
 * panes with a centre mullion, venetian blinds dropped across the top fifth,
 * and a procedurally painted dusk skyline sitting in a light-sealed exterior
 * well so no geometry edge is ever visible past the glass.
 */

import * as THREE from 'three';
import { useMemo } from 'react';
import { WINDOW as W, HALF_D, C } from '../spec';
import { mat, plain, Panel, Slab } from '../kit';
import { cityTexture } from '../textures';

const SLATS = 17;

export default function CityWindow() {
  const h = W.head - W.sill;
  const frame = plain(C.windowFrame, 0.42, 0.55);
  const reveal = mat('plaster', { repeat: [W.width / 2, 1], normalScale: 0.4, tint: '#a8a39e' });
  const sill = mat('travertine', { repeat: [1.2, 0.3], normalScale: 0.6, tint: '#8d8880' });

  const city = useMemo(() => cityTexture(), []);
  const sealed = useMemo(() => new THREE.MeshBasicMaterial({ color: '#05060a', side: THREE.DoubleSide }), []);
  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#8fa8cc',
        transparent: true,
        opacity: 0.11,
        roughness: 0.06,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  const blindTilt = -0.42;
  const blindTop = W.head - 0.055;

  return (
    <group position={[W.centerX, 0, -HALF_D]}>
      {/* ---------- reveal lining ---------- */}
      <Slab size={[0.02, h, W.reveal]} position={[-W.width / 2 + 0.01, W.sill + h / 2, -W.reveal / 2]} material={reveal} />
      <Slab size={[0.02, h, W.reveal]} position={[W.width / 2 - 0.01, W.sill + h / 2, -W.reveal / 2]} material={reveal} />
      <Slab size={[W.width, 0.02, W.reveal]} position={[0, W.head - 0.01, -W.reveal / 2]} material={reveal} />

      {/* stone sill, slightly proud of the wall face */}
      <Panel
        size={[W.width + 0.07, 0.045, W.reveal + 0.05]}
        position={[0, W.sill + 0.0225, -W.reveal / 2 + 0.025]}
        material={sill}
        radius={0.008}
      />

      {/* ---------- steel frame at the back of the reveal ---------- */}
      <group position={[0, 0, -W.reveal]}>
        <Panel size={[W.width, W.frame, 0.06]} position={[0, W.sill + W.frame / 2, 0]} material={frame} radius={0.006} />
        <Panel size={[W.width, W.frame, 0.06]} position={[0, W.head - W.frame / 2, 0]} material={frame} radius={0.006} />
        <Panel
          size={[W.frame, h, 0.06]}
          position={[-W.width / 2 + W.frame / 2, W.sill + h / 2, 0]}
          material={frame}
          radius={0.006}
        />
        <Panel
          size={[W.frame, h, 0.06]}
          position={[W.width / 2 - W.frame / 2, W.sill + h / 2, 0]}
          material={frame}
          radius={0.006}
        />
        {/* centre mullion */}
        <Panel size={[0.038, h, 0.05]} position={[0, W.sill + h / 2, 0.004]} material={frame} radius={0.005} />

        {/* glazing */}
        <mesh position={[0, W.sill + h / 2, -0.018]} material={glass}>
          <planeGeometry args={[W.width - W.frame * 2, h - W.frame * 2]} />
        </mesh>

        {/* ---------- venetian blinds ---------- */}
        <group position={[0, 0, 0.028]}>
          {/* head rail */}
          <Slab
            size={[W.width - W.frame * 2, 0.05, 0.045]}
            position={[0, W.head - W.frame - 0.025, 0]}
            material={plain('#1d2026', 0.5, 0.35)}
          />
          {Array.from({ length: SLATS }, (_, i) => {
            const y = blindTop - 0.055 - (i * W.blindDrop) / SLATS;
            return (
              <mesh
                key={i}
                position={[0, y, 0]}
                rotation={[blindTilt, 0, 0]}
                material={plain(C.blinds, 0.55, 0.3)}
                castShadow={false}
              >
                <boxGeometry args={[W.width - W.frame * 2 - 0.012, 0.0035, 0.032]} />
              </mesh>
            );
          })}
          {/* bottom rail + lift cords */}
          <Slab
            size={[W.width - W.frame * 2 - 0.01, 0.014, 0.036]}
            position={[0, blindTop - 0.055 - W.blindDrop, 0]}
            material={plain('#1a1d23', 0.5, 0.35)}
          />
          {[-0.3, 0.3].map((x) => (
            <mesh key={x} position={[x, blindTop - W.blindDrop / 2 - 0.03, 0.014]} material={plain('#2c3038', 0.8)}>
              <boxGeometry args={[0.004, W.blindDrop, 0.004]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ---------- exterior well + skyline ---------- */}
      {/*
        A closed box hung off the back of the opening. Everything but the face
        that meets the window is opaque black, and the box is only a little
        wider than the reveal — so from outside the room (the hero framing, with
        the near walls cut away) there is nothing of it to see, while from
        inside the skyline still fills the glass at any oblique angle.
      */}
      {/* Dropped half a metre: the texture's horizon sits just above centre,
          and at window height that put the whole sky behind the blinds. */}
      <group position={[0, W.sill + h / 2 - 0.3, -W.reveal - 0.02]}>
        {(() => {
          // The well has to be deep and wide enough that a skyline drawn at a
          // believable scale still subtends the right angle through the glass —
          // a shallow well makes the buildings read as a pixel grid.
          const bw = W.width + 8.4;
          const bh = h + 7.4;
          const bd = 9.0;
          return (
            <>
              <mesh position={[0, 0, -bd]}>
                <planeGeometry args={[bw, bh]} />
                <meshBasicMaterial map={city} toneMapped={false} color={new THREE.Color(1.5, 1.5, 1.5)} />
              </mesh>
              {[
                { p: [0, bh / 2, -bd / 2], r: [Math.PI / 2, 0, 0], s: [bw, bd] },
                { p: [0, -bh / 2, -bd / 2], r: [-Math.PI / 2, 0, 0], s: [bw, bd] },
                { p: [-bw / 2, 0, -bd / 2], r: [0, Math.PI / 2, 0], s: [bd, bh] },
                { p: [bw / 2, 0, -bd / 2], r: [0, -Math.PI / 2, 0], s: [bd, bh] },
                // the face that meets the wall, punched open by the reveal
                { p: [0, bh / 2 - (bh - h) / 4, 0.001], r: [0, 0, 0], s: [bw, (bh - h) / 2] },
                { p: [0, -bh / 2 + (bh - h) / 4, 0.001], r: [0, 0, 0], s: [bw, (bh - h) / 2] },
                { p: [-W.width / 2 - (bw - W.width) / 4, 0, 0.001], r: [0, 0, 0], s: [(bw - W.width) / 2, h] },
                { p: [W.width / 2 + (bw - W.width) / 4, 0, 0.001], r: [0, 0, 0], s: [(bw - W.width) / 2, h] },
              ].map((f, i) => (
                <mesh
                  key={i}
                  position={f.p as [number, number, number]}
                  rotation={f.r as [number, number, number]}
                  material={sealed}
                >
                  <planeGeometry args={f.s as [number, number]} />
                </mesh>
              ))}
            </>
          );
        })()}
      </group>
    </group>
  );
}
