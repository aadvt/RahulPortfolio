import { PALETTE } from './palette';

/**
 * Bed zone — front-right of the room, platform bed with warm LED underglow,
 * charcoal bedding, folded hoodie, and a nightstand with a lamp + plant.
 */
export default function BedZone() {
  return (
    <group position={[5.5, 0, 5]}>
      {/* ===== PLATFORM BASE ===== */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, 1, 6.5]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.7} />
      </mesh>

      {/* Warm LED underglow strip (floods floor under platform) */}
      <mesh position={[0, 0.08, 3.3]}>
        <boxGeometry args={[5, 0.08, 0.08]} />
        <meshStandardMaterial color={PALETTE.warmLED} emissive={PALETTE.warmLED} emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <mesh position={[-2.55, 0.08, 0]}>
        <boxGeometry args={[0.08, 0.08, 6.5]} />
        <meshStandardMaterial color={PALETTE.warmLED} emissive={PALETTE.warmLED} emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.25, 2]} intensity={2.4} color={PALETTE.warmLED} distance={11} decay={1.4} />

      {/* ===== MATTRESS + DUVET ===== */}
      <mesh position={[0, 1.35, 0.3]} castShadow>
        <boxGeometry args={[4.6, 0.7, 5.6]} />
        <meshStandardMaterial color={PALETTE.bedding} roughness={0.92} />
      </mesh>
      {/* Rumpled duvet top layer */}
      <mesh position={[0, 1.72, 0.8]} rotation={[0.02, 0, 0]}>
        <boxGeometry args={[4.5, 0.28, 4.2]} />
        <meshStandardMaterial color="#2e2e36" roughness={0.95} />
      </mesh>

      {/* ===== PILLOWS (head, back = -z) ===== */}
      <mesh position={[-1, 1.85, -2]} rotation={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[1.9, 0.45, 1.2]} />
        <meshStandardMaterial color="#33333c" roughness={0.9} />
      </mesh>
      <mesh position={[1.1, 1.85, -2]} rotation={[0, -0.1, 0]} castShadow>
        <boxGeometry args={[1.9, 0.45, 1.2]} />
        <meshStandardMaterial color="#33333c" roughness={0.9} />
      </mesh>

      {/* ===== FOLDED HOODIE ON BED ===== */}
      <group position={[0.2, 1.95, 1]} rotation={[0, 0.35, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.5, 0.32, 1.7]} />
          <meshStandardMaterial color="#1c1c22" roughness={0.9} />
        </mesh>
        {/* Small chest logo */}
        <mesh position={[0, 0.18, 0.3]}>
          <boxGeometry args={[0.4, 0.02, 0.25]} />
          <meshStandardMaterial color="#b23a3a" roughness={0.7} />
        </mesh>
      </group>

      {/* ===== NIGHTSTAND (right of bed) ===== */}
      <group position={[3.7, 0, 1.5]}>
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[1.4, 2, 1.4]} />
          <meshStandardMaterial color={PALETTE.woodMed} roughness={0.7} />
        </mesh>
        {/* Drawer line */}
        <mesh position={[0.71, 1.2, 0]}>
          <boxGeometry args={[0.03, 0.05, 1]} />
          <meshStandardMaterial color={PALETTE.black} />
        </mesh>
        {/* Lamp */}
        <mesh position={[0, 2.3, 0]}>
          <cylinderGeometry args={[0.05, 0.09, 0.6, 10]} />
          <meshStandardMaterial color={PALETTE.metalDark} roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position={[0, 2.75, 0]}>
          <coneGeometry args={[0.32, 0.45, 18, 1, true]} />
          <meshStandardMaterial
            color="#e8cfa8"
            emissive={PALETTE.warmLED}
            emissiveIntensity={1.6}
            roughness={0.6}
            side={2}
          />
        </mesh>
        {/* Small plant */}
        <mesh position={[0.5, 2.15, 0.3]}>
          <cylinderGeometry args={[0.13, 0.1, 0.24, 10]} />
          <meshStandardMaterial color="#7a5236" roughness={0.8} />
        </mesh>
        <mesh position={[0.5, 2.42, 0.3]}>
          <icosahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color={PALETTE.plantGreen} roughness={0.8} flatShading />
        </mesh>
      </group>
    </group>
  );
}
