import { PALETTE } from './palette';

/**
 * Right-wall zone (x ≈ 11): window with dusk city view, venetian blinds,
 * stacked washer/dryer, supply shelf, and a purple neon lightning bolt.
 */
export default function LaundryWindow() {
  return (
    <group>
      {/* ===== WINDOW FRAME + CITY VIEW ===== */}
      <mesh position={[10.78, 6, -4]}>
        <boxGeometry args={[0.25, 4.4, 3.6]} />
        <meshStandardMaterial color="#26364f" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* City glow panel (emissive dusk sky) */}
      <mesh position={[10.72, 6, -4]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[3.2, 4]} />
        <meshStandardMaterial
          color="#3a2f5c"
          emissive="#6d4a9c"
          emissiveIntensity={0.8}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>
      {/* Orange horizon band */}
      <mesh position={[10.71, 4.9, -4]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[3.2, 0.9]} />
        <meshStandardMaterial
          color="#c2632e"
          emissive="#e8783a"
          emissiveIntensity={0.9}
          toneMapped={false}
        />
      </mesh>
      {/* City building silhouettes with lit windows */}
      {[
        [-1.1, 4.5, 0.5, 1.6],
        [-0.5, 4.4, 0.6, 1.9],
        [0.1, 4.35, 0.55, 1.4],
        [0.7, 4.5, 0.6, 2.1],
        [1.2, 4.4, 0.5, 1.6],
      ].map(([z, y, w, h], i) => (
        <group key={i}>
          <mesh position={[10.68, y - 0.6 + h / 2, -4 + z]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[w, h]} />
            <meshStandardMaterial color="#14101f" roughness={0.8} />
          </mesh>
          <mesh position={[10.66, y - 0.4 + h / 2, -4 + z]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[w * 0.7, h * 0.7]} />
            <meshStandardMaterial
              color="#ffcf7a"
              emissive="#ffb04a"
              emissiveIntensity={0.7}
              toneMapped={false}
              transparent
              opacity={0.55}
            />
          </mesh>
        </group>
      ))}
      {/* Venetian blinds (partial, top) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[10.6, 7.4 - i * 0.16, -4]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[3.1, 0.12]} />
          <meshStandardMaterial color="#8fb4d8" roughness={0.5} metalness={0.2} />
        </mesh>
      ))}
      {/* ===== STACKED WASHER / DRYER ===== */}
      <group position={[10, 0, 0.5]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[1.7, 2.6, 2.4]} />
          <meshStandardMaterial color="#c4c8ce" roughness={0.35} metalness={0.55} />
        </mesh>
        {/* Doors */}
        {[0.9, 2.05].map((y) => (
          <group key={y} position={[-0.75, y, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.55, 0.55, 0.12, 24]} />
              <meshStandardMaterial color="#2a2a30" roughness={0.3} metalness={0.4} />
            </mesh>
            <mesh position={[-0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.4, 0.4, 0.08, 24]} />
              <meshStandardMaterial color="#0d0d12" roughness={0.2} metalness={0.6} />
            </mesh>
          </group>
        ))}
        {/* Control panel LEDs */}
        <mesh position={[-0.75, 2.55, 0.7]}>
          <boxGeometry args={[0.05, 0.12, 0.4]} />
          <meshStandardMaterial color="#0a0a0a" emissive={PALETTE.neonCyan} emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      </group>

      {/* ===== SUPPLY SHELF (front-right, detergent + basket + towels) ===== */}
      <mesh position={[10.2, 4.6, 4]} castShadow>
        <boxGeometry args={[1.3, 0.12, 2.4]} />
        <meshStandardMaterial color={PALETTE.woodMed} roughness={0.7} />
      </mesh>
      {/* Detergent bottles */}
      {[-0.5, 0].map((z, i) => (
        <mesh key={i} position={[10.2, 5, 4 + z]}>
          <boxGeometry args={[0.4, 0.7, 0.35]} />
          <meshStandardMaterial color={PALETTE.detergentBlue} roughness={0.4} />
        </mesh>
      ))}
      {/* Wicker basket */}
      <mesh position={[10.2, 5, 4.7]}>
        <cylinderGeometry args={[0.35, 0.3, 0.6, 12]} />
        <meshStandardMaterial color="#c9b28a" roughness={0.9} />
      </mesh>
      {/* Folded towels shelf below */}
      <mesh position={[10.2, 3.4, 4]} castShadow>
        <boxGeometry args={[1.3, 0.12, 2.4]} />
        <meshStandardMaterial color={PALETTE.woodMed} roughness={0.7} />
      </mesh>
      <mesh position={[10.2, 3.7, 4]}>
        <boxGeometry args={[0.9, 0.4, 1.6]} />
        <meshStandardMaterial color="#d9d4ca" roughness={0.9} />
      </mesh>
      {/* Small lamp on shelf */}
      <mesh position={[10.2, 5, 3.3]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#fff2d8" emissive={PALETTE.warmLED} emissiveIntensity={1.8} toneMapped={false} />
      </mesh>

      {/* Laundry basket on floor */}
      <mesh position={[9.6, 0.6, 3.2]}>
        <cylinderGeometry args={[0.55, 0.45, 1.1, 14]} />
        <meshStandardMaterial color="#c9c4bc" roughness={0.85} wireframe={false} />
      </mesh>

      {/* ===== PURPLE NEON LIGHTNING BOLT (far right) ===== */}
      <group position={[10.6, 4.6, 6.5]}>
        <mesh position={[0, 0.3, 0]} rotation={[0, -Math.PI / 2, 0.4]}>
          <boxGeometry args={[0.5, 0.14, 0.06]} />
          <meshStandardMaterial color={PALETTE.neonPurple} emissive={PALETTE.neonPurple} emissiveIntensity={3.5} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.15, 0]} rotation={[0, -Math.PI / 2, -0.5]}>
          <boxGeometry args={[0.55, 0.14, 0.06]} />
          <meshStandardMaterial color={PALETTE.neonPurple} emissive={PALETTE.neonPurple} emissiveIntensity={3.5} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
