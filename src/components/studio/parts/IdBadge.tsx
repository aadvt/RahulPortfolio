'use client';

/**
 * The studio ID slung over the chair back.
 *
 * Unlike the monitor there is no "on" state to manage: the card is always
 * printed, and clicking it simply flies the camera close enough to read it.
 * Everything the card says is baked into `badgeTexture()`, so the about page
 * is a texture rather than a DOM panel — which keeps it in the room's light,
 * its grade and its depth buffer.
 */

import * as THREE from 'three';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { BADGE as B, C } from '../spec';
import { plain, glow, Panel, Slab } from '../kit';
import { badgeTexture } from '../textures';
import { useStudioView } from '../views';
import { useStudioUI } from '../stops';

export default function IdBadge() {
  const view = useStudioView((s) => s.view);
  const setView = useStudioView((s) => s.setView);
  const [direct, setDirect] = useState(false);
  // The chair-back hit volume (Hotspots) catches the pointer before the card
  // does from most angles, so its hover counts as the card's.
  const viaVolume = useStudioUI((s) => s.hover === 'about');
  const hover = direct || viaVolume;
  const setHover = setDirect;

  const card = useMemo(() => {
    const t = badgeTexture();
    t.anisotropy = 16;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.62, metalness: 0.02 });
  }, []);
  const stock = plain('#ded9cf', 0.6);
  const edge = glow(C.neonBlue, 1.8);

  const active = view === 'badge';

  useEffect(() => {
    if (!hover || active) return;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hover, active]);

  const open = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      setView('badge');
    },
    [setView]
  );

  return (
    <group position={[B.x, B.y, B.z]}>
      <group rotation={[0, B.yaw, 0]}>
        <group rotation={[B.tilt, 0, B.roll]}>
          {/* card stock — carries the edge and the back */}
          <Panel size={[B.width, B.height, B.thickness]} material={stock} radius={0.004} smoothness={3} />

          {/* the printed face, and the click target */}
          <mesh
            position={[0, 0, B.thickness / 2 + 0.0006]}
            material={card}
            onClick={open}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(true);
            }}
            onPointerOut={() => setHover(false)}
          >
            <planeGeometry args={[B.width, B.height]} />
          </mesh>

          {/* hover hairline, matching the monitor's tell */}
          {hover && !active && (
            <group position={[0, 0, B.thickness / 2 - 0.0004]}>
              {[1, -1].map((s) => (
                <Slab
                  key={s}
                  size={[B.width + 0.006, 0.003, 0.008]}
                  position={[0, s * (B.height / 2 + 0.0015), 0]}
                  material={edge}
                />
              ))}
              {[1, -1].map((s) => (
                <Slab
                  key={`x${s}`}
                  size={[0.003, B.height + 0.006, 0.008]}
                  position={[s * (B.width / 2 + 0.0015), 0, 0]}
                  material={edge}
                />
              ))}
            </group>
          )}
        </group>
      </group>
    </group>
  );
}
