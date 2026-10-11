import Shell from './Shell';
import Bathroom from './Bathroom';
import LaundryWindow from './LaundryWindow';
import BedZone from './BedZone';
import FloorProps from './FloorProps';
import PCSetup from './props/PCSetup';
import Sneakers from './props/Sneakers';
import Closet from './props/Closet';
import Mirror from './props/Mirror';
import { PALETTE } from './palette';

export default function RoomScene() {
  return (
    <>
      {/* ===== LIGHTING ===== */}

      {/* Ambient base so nothing reads pure black */}
      <ambientLight intensity={0.6} color="#c8ccdd" />

      {/* Cool sky / warm floor hemisphere fill */}
      <hemisphereLight args={['#6b74a8', PALETTE.woodDark, 0.6]} />

      {/* Key directional light (soft shadows over the room) */}
      <directionalLight
        position={[10, 16, 12]}
        intensity={1.4}
        color="#fff4e2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={60}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
      />

      {/* General room fill (center of the room) */}
      <pointLight position={[0, 9, 2]} intensity={2} color="#fff0dc" distance={38} decay={1.3} />

      {/* Purple + blue accent wash (matches the neon trim) */}
      <pointLight position={[-6, 9, -8]} intensity={2} color={PALETTE.neonPurple} distance={24} decay={1.5} />
      <pointLight position={[8, 9, -8]} intensity={1.7} color={PALETTE.neonBlue} distance={26} decay={1.5} />

      {/* ===== GEOMETRY ===== */}
      <Shell />
      <Bathroom />
      <LaundryWindow />
      <BedZone />
      <FloorProps />

      {/* ===== INTERACTIVE PROPS ===== */}
      <PCSetup />
      <Sneakers />
      <Closet />
      <Mirror />
    </>
  );
}
