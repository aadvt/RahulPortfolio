import { PALETTE } from './palette';

/**
 * Loose floor items: center rug, skateboard leaning on the left wall,
 * and a duffel bag near the front-left.
 */
export default function FloorProps() {
  return (
    <group>
      {/* ===== CENTER SHAG RUG ===== */}
      <mesh position={[-0.5, 0.18, 3]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 5]} />
        <meshStandardMaterial color={PALETTE.rug} roughness={1} />
      </mesh>
      {/* Rug pile edge lift for a bit of depth */}
      <mesh position={[-0.5, 0.2, 3]}>
        <boxGeometry args={[6, 0.06, 5]} />
        <meshStandardMaterial color="#26262e" roughness={1} />
      </mesh>

      {/* ===== SKATEBOARD (leaning on left wall, front) ===== */}
      <group position={[-10.4, 1.8, 4]} rotation={[0, 0, 0.14]}>
        {/* Deck */}
        <mesh castShadow>
          <boxGeometry args={[0.25, 3.4, 0.85]} />
          <meshStandardMaterial color="#5b21b6" roughness={0.55} />
        </mesh>
        {/* Graphic stripe */}
        <mesh position={[0.13, 0, 0]}>
          <boxGeometry args={[0.02, 3, 0.6]} />
          <meshStandardMaterial color="#1e1b2e" roughness={0.6} />
        </mesh>
        {/* Wheels */}
        {[
          [1.4, 0.3],
          [1.4, -0.3],
          [-1.4, 0.3],
          [-1.4, -0.3],
        ].map(([y, z], i) => (
          <mesh key={i} position={[-0.18, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.14, 0.14, 0.12, 12]} />
            <meshStandardMaterial color="#e8e4d8" roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* ===== DUFFEL BAG (front-left floor) ===== */}
      <group position={[-8, 0.55, 7.5]} rotation={[0, 0.5, 0]}>
        <mesh castShadow>
          <boxGeometry args={[2, 1, 0.9]} />
          <meshStandardMaterial color="#2b2b30" roughness={0.85} />
        </mesh>
        {/* Rounded top via cylinder */}
        <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 1.9, 16]} />
          <meshStandardMaterial color="#303035" roughness={0.85} />
        </mesh>
        {/* Handles */}
        <mesh position={[0.3, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.03, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#18181c" roughness={0.7} />
        </mesh>
        {/* Red label */}
        <mesh position={[0.5, 0, 0.46]}>
          <boxGeometry args={[0.5, 0.2, 0.02]} />
          <meshStandardMaterial color={PALETTE.clothRed} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}
