import { useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useRoomStore } from '@/store/useRoomStore';
import { PALETTE } from '../palette';

/** One Air-Jordan-style high-top built from primitives. */
function Shoe({ flip, glow }: { flip: number; glow: number }) {
  return (
    <group scale={[flip, 1, 1]}>
      {/* Sole */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.42, 0.18, 1.05]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.5} emissive="#ffffff" emissiveIntensity={glow} />
      </mesh>
      {/* Toe */}
      <mesh position={[0, 0.32, 0.32]}>
        <boxGeometry args={[0.4, 0.28, 0.42]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.6} />
      </mesh>
      {/* Mid upper (red) */}
      <mesh position={[0, 0.38, -0.05]}>
        <boxGeometry args={[0.4, 0.32, 0.5]} />
        <meshStandardMaterial color="#b0202a" roughness={0.6} />
      </mesh>
      {/* Ankle collar (high-top, black) */}
      <mesh position={[0, 0.62, -0.32]}>
        <boxGeometry args={[0.4, 0.5, 0.42]} />
        <meshStandardMaterial color="#16161a" roughness={0.7} />
      </mesh>
      {/* Swoosh accent */}
      <mesh position={[0.21, 0.4, 0]}>
        <boxGeometry args={[0.02, 0.12, 0.5]} />
        <meshStandardMaterial color="#16161a" roughness={0.6} />
      </mesh>
    </group>
  );
}

/**
 * Air Jordan sneakers (interactive 'SHOES' target) — floor beside the bed.
 */
export default function Sneakers() {
  const groupRef = useRef<THREE.Group>(null);
  const { setActiveTarget, setHoveredTarget, hoveredTarget } = useRoomStore();
  const glow = hoveredTarget === 'SHOES' ? 0.5 : 0;

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredTarget('SHOES');
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredTarget('NONE');
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setActiveTarget('SHOES');
  };

  return (
    <group
      ref={groupRef}
      position={[8.5, 0, 8]}
      onPointerOver={over}
      onPointerOut={out}
      onClick={click}
    >
      <group position={[-0.35, 0, 0]} rotation={[0, 0.25, 0]}>
        <Shoe flip={1} glow={glow} />
      </group>
      <group position={[0.35, 0, 0.2]} rotation={[0, -0.15, 0]}>
        <Shoe flip={-1} glow={glow} />
      </group>
    </group>
  );
}
