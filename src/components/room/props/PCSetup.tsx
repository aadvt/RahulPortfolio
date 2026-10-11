import { useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useRoomStore } from '@/store/useRoomStore';
import { PALETTE } from '../palette';

/**
 * Desk workstation (interactive 'PC' target) — desk, monitor with a video-editing
 * timeline, speakers, RGB keyboard, camera, PC tower and an office chair.
 * Sits against the back wall, left-center of the room.
 */
export default function PCSetup() {
  const groupRef = useRef<THREE.Group>(null);
  const { setActiveTarget, setHoveredTarget, hoveredTarget } = useRoomStore();
  const isHovered = hoveredTarget === 'PC';
  const glow = isHovered ? 0.4 : 0;

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredTarget('PC');
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredTarget('NONE');
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setActiveTarget('PC');
  };

  return (
    <group
      ref={groupRef}
      position={[-3, 0, -8.6]}
      onPointerOver={over}
      onPointerOut={out}
      onClick={click}
    >
      {/* ===== DESK ===== */}
      <mesh position={[0, 2.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.4, 0.16, 2.4]} />
        <meshStandardMaterial
          color={PALETTE.woodLight}
          roughness={0.55}
          emissive={PALETTE.neonPurple}
          emissiveIntensity={glow}
        />
      </mesh>
      {/* Metal legs */}
      {[
        [-2.5, 1],
        [2.5, 1],
        [-2.5, -0.9],
        [2.5, -0.9],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.15, z]} castShadow>
          <boxGeometry args={[0.12, 2.3, 0.12]} />
          <meshStandardMaterial color={PALETTE.metalDark} roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      {/* Drawer unit (right side) */}
      <mesh position={[1.9, 1.4, 0]} castShadow>
        <boxGeometry args={[1.2, 1.7, 2.1]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.7} />
      </mesh>
      {[1.9, 1.4, 0.9].map((y, i) => (
        <mesh key={i} position={[2.51, y, 0]}>
          <boxGeometry args={[0.04, 0.06, 0.5]} />
          <meshStandardMaterial color={PALETTE.chrome} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* ===== MONITOR (video editing timeline) ===== */}
      <mesh position={[0, 3, -0.7]}>
        <boxGeometry args={[0.25, 0.5, 0.2]} />
        <meshStandardMaterial color={PALETTE.metalDark} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.55, -0.8]}>
        <boxGeometry args={[3, 1.7, 0.12]} />
        <meshStandardMaterial color="#0a0a0d" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Screen (preview area) */}
      <mesh position={[0, 3.85, -0.73]}>
        <planeGeometry args={[2.7, 0.85]} />
        <meshStandardMaterial
          color="#1a2740"
          emissive="#2d5a9e"
          emissiveIntensity={isHovered ? 1.4 : 0.9}
          toneMapped={false}
        />
      </mesh>
      {/* Timeline tracks (colorful clips) */}
      {['#e0b64a', '#7c3aed', '#22d3ee', '#e0555a'].map((c, i) => (
        <mesh key={i} position={[-0.6 + (i % 2) * 0.9, 3.25 - Math.floor(i / 2) * 0.18, -0.72]}>
          <planeGeometry args={[0.8, 0.12]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1} toneMapped={false} />
        </mesh>
      ))}

      {/* ===== STUDIO SPEAKERS ===== */}
      {[-1.9, 1.15].map((x, i) => (
        <group key={i} position={[x, 2.9, -0.5]}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.8, 0.5]} />
            <meshStandardMaterial color={PALETTE.black} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.1, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.04, 16]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.22, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.04, 16]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* ===== RGB KEYBOARD ===== */}
      <mesh position={[-0.2, 2.42, 0.55]}>
        <boxGeometry args={[1.6, 0.12, 0.55]} />
        <meshStandardMaterial color={PALETTE.black} roughness={0.6} />
      </mesh>
      <mesh position={[-0.2, 2.49, 0.55]}>
        <planeGeometry args={[1.5, 0.45]} />
        <meshStandardMaterial color="#111" emissive="#a855f7" emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      {/* Mouse + large pad */}
      <mesh position={[1.1, 2.4, 0.6]}>
        <boxGeometry args={[1.4, 0.02, 0.9]} />
        <meshStandardMaterial color="#1a1a1f" roughness={0.8} />
      </mesh>
      <mesh position={[1.1, 2.46, 0.6]}>
        <boxGeometry args={[0.22, 0.08, 0.36]} />
        <meshStandardMaterial color={PALETTE.black} roughness={0.5} />
      </mesh>

      {/* ===== DESK LAMP (articulated) ===== */}
      <group position={[-2.3, 2.4, -0.3]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.18, 0.2, 0.08, 12]} />
          <meshStandardMaterial color={PALETTE.metalDark} roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.55, 0]} rotation={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
          <meshStandardMaterial color={PALETTE.metalDark} roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0.05, 1.05, 0.35]} rotation={[1.2, 0, 0]}>
          <coneGeometry args={[0.22, 0.32, 16, 1, true]} />
          <meshStandardMaterial color={PALETTE.metalDark} roughness={0.5} side={2} />
        </mesh>
        <mesh position={[0.05, 0.95, 0.42]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshStandardMaterial color="#fff2d8" emissive={PALETTE.warmLED} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </group>

      {/* ===== DSLR CAMERA ON DESK ===== */}
      <group position={[-1.2, 2.55, 0.7]} rotation={[0, 0.6, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.35, 0.28]} />
          <meshStandardMaterial color="#18181c" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.15, 0.3, 20]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.4} metalness={0.3} />
        </mesh>
      </group>

      {/* ===== COFFEE MUG ===== */}
      <mesh position={[-1.9, 2.6, 0.6]}>
        <cylinderGeometry args={[0.16, 0.14, 0.35, 16]} />
        <meshStandardMaterial color="#2a2a30" roughness={0.6} />
      </mesh>

      {/* ===== DESK PLANT ===== */}
      <mesh position={[-1.3, 2.55, -0.6]}>
        <cylinderGeometry args={[0.17, 0.13, 0.3, 10]} />
        <meshStandardMaterial color="#7a5236" roughness={0.8} />
      </mesh>
      <mesh position={[-1.3, 2.85, -0.6]}>
        <icosahedronGeometry args={[0.26, 0]} />
        <meshStandardMaterial color={PALETTE.plantGreen} roughness={0.8} flatShading />
      </mesh>

      {/* ===== PC TOWER (RGB, under desk right) ===== */}
      <group position={[1.9, 0.9, 0.4]}>
        <mesh castShadow>
          <boxGeometry args={[0.9, 1.8, 1.8]} />
          <meshStandardMaterial color="#0e0e12" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Glass side panel glow */}
        <mesh position={[-0.46, 0, 0]}>
          <planeGeometry args={[1.5, 1.5]} />
          <meshStandardMaterial
            color="#1a1030"
            emissive={isHovered ? '#c084fc' : '#6d28d9'}
            emissiveIntensity={isHovered ? 2 : 1.3}
            toneMapped={false}
            transparent
            opacity={0.85}
          />
        </mesh>
      </group>

      {/* ===== OFFICE CHAIR (in front of desk) ===== */}
      <group position={[0, 0, 2.3]}>
        {/* 5-star base */}
        {Array.from({ length: 5 }).map((_, i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.5, 0.15, Math.sin(a) * 0.5]} rotation={[0, -a, 0]}>
              <boxGeometry args={[0.7, 0.1, 0.14]} />
              <meshStandardMaterial color={PALETTE.metalDark} roughness={0.4} metalness={0.6} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 1.4, 10]} />
          <meshStandardMaterial color={PALETTE.metalMid} roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Seat */}
        <mesh position={[0, 1.7, 0]} castShadow>
          <boxGeometry args={[1.3, 0.25, 1.2]} />
          <meshStandardMaterial color="#16161a" roughness={0.7} />
        </mesh>
        {/* Backrest (mesh) */}
        <mesh position={[0, 2.9, -0.55]} rotation={[0.18, 0, 0]} castShadow>
          <boxGeometry args={[1.25, 2, 0.2]} />
          <meshStandardMaterial color="#1a1a20" roughness={0.75} />
        </mesh>
        {/* Armrests */}
        {[-0.72, 0.72].map((x, i) => (
          <mesh key={i} position={[x, 2.1, 0]}>
            <boxGeometry args={[0.15, 0.1, 0.9]} />
            <meshStandardMaterial color={PALETTE.black} roughness={0.6} />
          </mesh>
        ))}
        {/* Lanyard + ID badge hanging on armrest */}
        <mesh position={[0.72, 1.5, 0.5]}>
          <boxGeometry args={[0.04, 1, 0.02]} />
          <meshStandardMaterial color="#c8552a" roughness={0.7} />
        </mesh>
        <mesh position={[0.72, 0.95, 0.5]}>
          <boxGeometry args={[0.3, 0.42, 0.02]} />
          <meshStandardMaterial color="#e8e8ee" roughness={0.5} emissive="#3b82f6" emissiveIntensity={0.3} />
        </mesh>
      </group>
    </group>
  );
}
