import { PALETTE } from './palette';

/**
 * Room shell: a 3-wall cutaway box (back / left / right walls, open front + top)
 * proportioned so the perspective camera reads as a dollhouse diorama.
 * Interior spans x[-11,11] z[-11,11], height 11.
 */
export default function Shell() {
  return (
    <group>
      {/* ===== FLOOR ===== */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[22, 0.3, 22]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={0.65} metalness={0.15} />
      </mesh>

      {/* Floor rim / diorama base edge (front + open sides) */}
      <mesh position={[0, -0.35, 11]}>
        <boxGeometry args={[22.8, 0.7, 0.8]} />
        <meshStandardMaterial color={PALETTE.trim} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[11, -0.35, 0]}>
        <boxGeometry args={[0.8, 0.7, 22.8]} />
        <meshStandardMaterial color={PALETTE.trim} roughness={0.5} metalness={0.4} />
      </mesh>

      {/* ===== BACK WALL (z = -11) ===== */}
      <mesh position={[0, 5.5, -11]} receiveShadow>
        <boxGeometry args={[22, 11, 0.4]} />
        <meshStandardMaterial color={PALETTE.concreteLight} roughness={0.95} />
      </mesh>

      {/* ===== LEFT WALL (x = -11) ===== */}
      <mesh position={[-11, 5.5, 0]} receiveShadow>
        <boxGeometry args={[0.4, 11, 22]} />
        <meshStandardMaterial color={PALETTE.concrete} roughness={0.95} />
      </mesh>

      {/* ===== RIGHT WALL (x = 11) ===== */}
      <mesh position={[11, 5.5, 0]} receiveShadow>
        <boxGeometry args={[0.4, 11, 22]} />
        <meshStandardMaterial color={PALETTE.concrete} roughness={0.95} />
      </mesh>

      {/* Bathroom / desk divider wall (short partition, left-back) */}
      <mesh position={[-6, 5.5, -6]} receiveShadow>
        <boxGeometry args={[0.35, 11, 10]} />
        <meshStandardMaterial color={PALETTE.concreteWarm} roughness={0.95} />
      </mesh>

      {/* ===== DARK WALL TOP TRIM (navy diorama edge) ===== */}
      <mesh position={[0, 11.1, -11]}>
        <boxGeometry args={[22.4, 0.5, 0.7]} />
        <meshStandardMaterial color={PALETTE.trim} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[-11, 11.1, 0]}>
        <boxGeometry args={[0.7, 0.5, 22.4]} />
        <meshStandardMaterial color={PALETTE.trim} roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[11, 11.1, 0]}>
        <boxGeometry args={[0.7, 0.5, 22.4]} />
        <meshStandardMaterial color={PALETTE.trim} roughness={0.4} metalness={0.5} />
      </mesh>

      {/* ===== PURPLE NEON CEILING TRIM (runs along back + right top) ===== */}
      <mesh position={[2, 10.4, -10.75]}>
        <boxGeometry args={[16, 0.12, 0.12]} />
        <meshStandardMaterial
          color={PALETTE.neonPurple}
          emissive={PALETTE.neonPurple}
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[10.75, 10.4, -2]}>
        <boxGeometry args={[0.12, 0.12, 16]} />
        <meshStandardMaterial
          color={PALETTE.neonPurple}
          emissive={PALETTE.neonPurple}
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>

      {/* ===== GRAFFITI WALL PANEL (back wall, above desk) ===== */}
      {/* Dark spray-painted panel standing in for the "CREATE BUILD REPEAT"
          mural — kept as geometry (no async font/worker) for render safety. */}
      <mesh position={[-3, 7.6, -10.74]}>
        <planeGeometry args={[6, 3.4]} />
        <meshStandardMaterial color="#2a2530" roughness={0.95} />
      </mesh>
      {/* Three paint "bars" suggesting the three stacked words */}
      {[8.4, 7.5, 6.6].map((y, i) => (
        <mesh key={i} position={[-3, y, -10.72]}>
          <planeGeometry args={[3.6 - i * 0.3, 0.5]} />
          <meshStandardMaterial
            color="#0d0d12"
            emissive={PALETTE.neonPurple}
            emissiveIntensity={0.25}
            roughness={0.8}
          />
        </mesh>
      ))}

      {/* ===== BLUE NEON SIGN (chart line, back wall top-left) ===== */}
      <group position={[-8.6, 8.6, -10.7]}>
        <mesh>
          <boxGeometry args={[1.7, 1, 0.1]} />
          <meshStandardMaterial color="#08080c" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <boxGeometry args={[1.5, 0.08, 0.05]} />
          <meshStandardMaterial
            color={PALETTE.neonBlue}
            emissive={PALETTE.neonBlue}
            emissiveIntensity={3.5}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[-0.3, 0.28, 0.08]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.7, 0.08, 0.05]} />
          <meshStandardMaterial
            color={PALETTE.neonBlue}
            emissive={PALETTE.neonBlue}
            emissiveIntensity={3.5}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0.35, 0.2, 0.08]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.6, 0.08, 0.05]} />
          <meshStandardMaterial
            color={PALETTE.neonBlue}
            emissive={PALETTE.neonBlue}
            emissiveIntensity={3.5}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* ===== HEADPHONES HANGING (back wall, right of graffiti) ===== */}
      <group position={[1.4, 6.6, -10.7]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.35, 0.06, 8, 24, Math.PI]} />
          <meshStandardMaterial color={PALETTE.black} roughness={0.5} />
        </mesh>
        <mesh position={[-0.35, -0.15, 0]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color={PALETTE.black} roughness={0.6} />
        </mesh>
        <mesh position={[0.35, -0.15, 0]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color={PALETTE.black} roughness={0.6} />
        </mesh>
      </group>

      {/* Power outlet detail */}
      <mesh position={[2.6, 5.8, -10.72]}>
        <boxGeometry args={[0.35, 0.5, 0.05]} />
        <meshStandardMaterial color="#d8d4cc" roughness={0.6} />
      </mesh>
    </group>
  );
}
