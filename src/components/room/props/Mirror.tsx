import { useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useRoomStore } from '@/store/useRoomStore';
import { PALETTE } from '../palette';

/**
 * LED-lit bathroom mirror (interactive 'MIRROR' target) — mounted on the
 * left wall above the vanity, facing into the room (+x).
 */
export default function Mirror() {
  const groupRef = useRef<THREE.Group>(null);
  const { setActiveTarget, setHoveredTarget, hoveredTarget } = useRoomStore();
  const isHovered = hoveredTarget === 'MIRROR';

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredTarget('MIRROR');
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredTarget('NONE');
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setActiveTarget('MIRROR');
  };

  return (
    <group
      ref={groupRef}
      position={[-10.65, 4.6, -8]}
      rotation={[0, Math.PI / 2, 0]}
      onPointerOver={over}
      onPointerOut={out}
      onClick={click}
    >
      {/* Warm LED backlight halo */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[2.3, 3, 0.05]} />
        <meshStandardMaterial
          color="#fff4e0"
          emissive={PALETTE.warmLED}
          emissiveIntensity={isHovered ? 3 : 2}
          toneMapped={false}
        />
      </mesh>
      {/* Mirror glass */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[2, 2.7, 0.06]} />
        <meshStandardMaterial
          color="#aeb6c2"
          metalness={1}
          roughness={0.08}
          emissive={isHovered ? '#60a5fa' : '#1a2436'}
          emissiveIntensity={isHovered ? 0.4 : 0.15}
        />
      </mesh>
      {/* Reflection sheen streak */}
      <mesh position={[-0.4, 0.3, 0.06]} rotation={[0, 0, 0.4]}>
        <planeGeometry args={[0.4, 2]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.12} toneMapped={false} />
      </mesh>
      {/* Warm fill from the mirror LEDs */}
      <pointLight position={[0.6, 0, 0]} intensity={isHovered ? 2 : 1.3} color={PALETTE.warmLED} distance={8} decay={1.5} />
    </group>
  );
}
