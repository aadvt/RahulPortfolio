import { useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useRoomStore } from '@/store/useRoomStore';
import { PALETTE } from '../palette';

const CLOTHES = [
  { x: -1, color: PALETTE.clothGrey },
  { x: -0.5, color: PALETTE.clothRed },
  { x: 0, color: '#3a3a42' },
  { x: 0.5, color: PALETTE.clothPlaid },
  { x: 1, color: '#4a4a52' },
];

/**
 * Open wardrobe (interactive 'CLOSET' target) — back wall, right of the desk.
 * Hanging clothes, shoeboxes, basketball, turntable and records.
 */
export default function Closet() {
  const groupRef = useRef<THREE.Group>(null);
  const { setActiveTarget, setHoveredTarget, hoveredTarget } = useRoomStore();
  const isHovered = hoveredTarget === 'CLOSET';
  const glow = isHovered ? 0.35 : 0;

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredTarget('CLOSET');
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredTarget('NONE');
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setActiveTarget('CLOSET');
  };

  return (
    <group
      ref={groupRef}
      position={[4.5, 0, -10.2]}
      onPointerOver={over}
      onPointerOut={out}
      onClick={click}
    >
      {/* ===== WARDROBE FRAME (dark wood) ===== */}
      {/* Back panel */}
      <mesh position={[0, 5, -0.3]} receiveShadow>
        <boxGeometry args={[6, 9.5, 0.2]} />
        <meshStandardMaterial
          color="#241a12"
          emissive={PALETTE.neonCyan}
          emissiveIntensity={glow}
          roughness={0.85}
        />
      </mesh>
      {/* Side + top frame */}
      {[
        [-3, 5, 0.4, 9.5, 1],
        [3, 5, 0.4, 9.5, 1],
        [0, 9.6, 6, 0.5, 1],
        [0, 0.3, 6, 0.5, 1],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y as number, 0.4]} castShadow>
          <boxGeometry args={[w as number, h as number, 1.4]} />
          <meshStandardMaterial color={PALETTE.woodDark} roughness={0.75} />
        </mesh>
      ))}
      {/* Center divider */}
      <mesh position={[1.4, 5, 0.2]}>
        <boxGeometry args={[0.15, 9, 1.2]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.75} />
      </mesh>

      {/* ===== HANGING SECTION (left) ===== */}
      <mesh position={[-1, 6.6, 0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 3.4, 10]} />
        <meshStandardMaterial color={PALETTE.chrome} metalness={0.8} roughness={0.25} />
      </mesh>
      {CLOTHES.map((c, i) => (
        <group key={i} position={[c.x, 5.4, 0.2]}>
          {/* Hanger hook */}
          <mesh position={[0, 1.1, 0]}>
            <torusGeometry args={[0.07, 0.015, 6, 12, Math.PI]} />
            <meshStandardMaterial color={PALETTE.chrome} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Garment */}
          <mesh castShadow>
            <boxGeometry args={[0.42, 2, 0.28]} />
            <meshStandardMaterial color={c.color} roughness={0.9} />
          </mesh>
          {/* Shoulders */}
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[0.5, 0.25, 0.28]} />
            <meshStandardMaterial color={c.color} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* ===== TOP SHELF: shoeboxes + storage ===== */}
      <mesh position={[-1, 8.4, 0.2]}>
        <boxGeometry args={[3.6, 0.12, 1.2]} />
        <meshStandardMaterial color="#2a2018" roughness={0.8} />
      </mesh>
      <mesh position={[-1.6, 8.75, 0.2]}>
        <boxGeometry args={[1, 0.55, 0.9]} />
        <meshStandardMaterial color={PALETTE.nikeOrange} roughness={0.55} />
      </mesh>
      <mesh position={[-0.4, 8.75, 0.2]}>
        <boxGeometry args={[1, 0.55, 0.9]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.55} />
      </mesh>
      <mesh position={[0.7, 8.8, 0.2]}>
        <boxGeometry args={[0.8, 0.6, 0.9]} />
        <meshStandardMaterial color="#2f2f36" roughness={0.7} />
      </mesh>

      {/* ===== RIGHT COLUMN SHELVES ===== */}
      {[7.6, 5.7, 3.8, 1.9].map((y, i) => (
        <mesh key={i} position={[2.2, y, 0.2]}>
          <boxGeometry args={[1.5, 0.12, 1.2]} />
          <meshStandardMaterial color="#2a2018" roughness={0.8} />
        </mesh>
      ))}
      {/* Basketball */}
      <mesh position={[2.2, 6.15, 0.2]} castShadow>
        <sphereGeometry args={[0.42, 20, 20]} />
        <meshStandardMaterial color={PALETTE.basketball} roughness={0.75} />
      </mesh>
      {/* Small plant */}
      <mesh position={[2.5, 8, 0.2]}>
        <cylinderGeometry args={[0.13, 0.1, 0.24, 10]} />
        <meshStandardMaterial color="#7a5236" roughness={0.8} />
      </mesh>
      <mesh position={[2.5, 8.28, 0.2]}>
        <icosahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color={PALETTE.plantGreen} roughness={0.8} flatShading />
      </mesh>
      {/* Rubik's cube */}
      <mesh position={[1.9, 8, 0.2]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#e0b64a" roughness={0.5} />
      </mesh>
      {/* Turntable */}
      <group position={[2.2, 4.05, 0.2]}>
        <mesh>
          <boxGeometry args={[1.3, 0.15, 1]} />
          <meshStandardMaterial color="#1a1a1e" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.04, 24]} />
          <meshStandardMaterial color="#0c0c0e" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.02, 12]} />
          <meshStandardMaterial color={PALETTE.clothRed} roughness={0.5} />
        </mesh>
      </group>
      {/* Vinyl records (leaning stack) */}
      <mesh position={[2.2, 2.5, 0.2]} rotation={[0, 0, 0.08]}>
        <boxGeometry args={[1.3, 1.2, 0.5]} />
        <meshStandardMaterial color="#161618" roughness={0.7} />
      </mesh>
      {/* Storage bins bottom */}
      <mesh position={[2.2, 1.3, 0.2]}>
        <boxGeometry args={[1.3, 0.9, 1]} />
        <meshStandardMaterial color="#26262c" roughness={0.8} />
      </mesh>
    </group>
  );
}
