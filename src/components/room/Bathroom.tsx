import { PALETTE } from './palette';

/**
 * Bathroom nook — back-left corner along the left wall (x ≈ -11).
 * The interactive LED mirror is a separate component (props/Mirror).
 */
export default function Bathroom() {
  return (
    <group>
      {/* Tiled wall backing (left wall interior, brighter than concrete) */}
      <mesh position={[-10.75, 5, -8]} receiveShadow>
        <boxGeometry args={[0.1, 10, 6]} />
        <meshStandardMaterial color={PALETTE.tile} roughness={0.5} metalness={0.1} />
      </mesh>

      {/* ===== VANITY CABINET ===== */}
      <mesh position={[-10.1, 1.4, -8]} castShadow>
        <boxGeometry args={[1.4, 2, 2.4]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.7} />
      </mesh>
      {/* Cabinet doors seam */}
      <mesh position={[-9.38, 1.4, -8]}>
        <boxGeometry args={[0.05, 1.6, 0.05]} />
        <meshStandardMaterial color={PALETTE.black} roughness={0.5} />
      </mesh>
      {/* Counter top */}
      <mesh position={[-10.1, 2.45, -8]} castShadow>
        <boxGeometry args={[1.5, 0.15, 2.6]} />
        <meshStandardMaterial color="#e8e6e0" roughness={0.3} />
      </mesh>
      {/* Sink basin */}
      <mesh position={[-10.1, 2.5, -8]}>
        <cylinderGeometry args={[0.45, 0.35, 0.25, 20]} />
        <meshStandardMaterial color="#f4f3ef" roughness={0.2} />
      </mesh>
      <mesh position={[-10.1, 2.6, -8]}>
        <cylinderGeometry args={[0.38, 0.3, 0.2, 20]} />
        <meshStandardMaterial color="#1c1c22" roughness={0.3} />
      </mesh>
      {/* Faucet */}
      <mesh position={[-10.5, 2.75, -8]}>
        <cylinderGeometry args={[0.035, 0.035, 0.5, 8]} />
        <meshStandardMaterial color={PALETTE.chrome} metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[-10.35, 2.95, -8]} rotation={[0, 0, Math.PI / 3]}>
        <cylinderGeometry args={[0.035, 0.035, 0.35, 8]} />
        <meshStandardMaterial color={PALETTE.chrome} metalness={0.9} roughness={0.15} />
      </mesh>

      {/* ===== WALL SCONCE LAMP (above mirror) ===== */}
      <group position={[-10.6, 6.7, -7]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.5, 8]} />
          <meshStandardMaterial color={PALETTE.metalDark} roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position={[0.35, -0.1, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.28, 0.35, 16, 1, true]} />
          <meshStandardMaterial color={PALETTE.metalDark} roughness={0.5} side={2} />
        </mesh>
        <mesh position={[0.35, -0.22, 0]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial
            color="#fff2d8"
            emissive={PALETTE.warmLED}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* ===== TOWEL RING + TOWEL ===== */}
      <mesh position={[-10.65, 3.6, -6.4]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.03, 8, 20]} />
        <meshStandardMaterial color={PALETTE.chrome} metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-10.6, 3.15, -6.4]}>
        <boxGeometry args={[0.08, 1, 0.5]} />
        <meshStandardMaterial color="#d5d0c6" roughness={0.9} />
      </mesh>

      {/* ===== SHOWER CURTAIN + ROD ===== */}
      <mesh position={[-8.2, 7.4, -9.4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 3.2, 8]} />
        <meshStandardMaterial color={PALETTE.chrome} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-8.2, 5.4, -9.4]}>
        <boxGeometry args={[3, 4, 0.08]} />
        <meshStandardMaterial color="#2a2730" roughness={0.9} />
      </mesh>

      {/* ===== SMALL WALL SHELF + CANDLE + PLANT (front-left) ===== */}
      <mesh position={[-10.4, 3.4, -3]} castShadow>
        <boxGeometry args={[1.1, 0.1, 1]} />
        <meshStandardMaterial color={PALETTE.woodMed} roughness={0.7} />
      </mesh>
      <mesh position={[-10.5, 3.65, -3.2]}>
        <cylinderGeometry args={[0.13, 0.13, 0.3, 12]} />
        <meshStandardMaterial
          color="#f5f0e6"
          emissive={PALETTE.warmLED}
          emissiveIntensity={1}
          roughness={0.5}
        />
      </mesh>
      {/* Plant */}
      <mesh position={[-10.2, 3.6, -2.7]}>
        <cylinderGeometry args={[0.14, 0.11, 0.28, 10]} />
        <meshStandardMaterial color="#7a5236" roughness={0.8} />
      </mesh>
      <mesh position={[-10.2, 3.9, -2.7]}>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={PALETTE.plantGreen} roughness={0.8} flatShading />
      </mesh>

      {/* ===== "DISCIPLINED / FOCUS / FREEDOM" POSTER ===== */}
      <mesh position={[-10.9, 4.3, -1]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.4, 1.8]} />
        <meshStandardMaterial color="#0a0a0d" roughness={0.6} />
      </mesh>

      {/* Bath mat */}
      <mesh position={[-9.5, 0.2, -6.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2, 1.6]} />
        <meshStandardMaterial color="#33323a" roughness={0.95} />
      </mesh>
    </group>
  );
}
