/**
 * The room, assembled. Geometry order mirrors how it would actually be built:
 * shell first, then the joinery and openings, then the furniture, then the
 * loose props that get dropped in last.
 */

import Shell from './parts/Shell';
import { Wardrobe, DisplayShelf } from './parts/Joinery';
import CityWindow from './parts/CityWindow';
import DoorAlcove from './parts/DoorAlcove';
import Desk from './props/Desk';
import Chair from './props/Chair';
import IdBadge from './parts/IdBadge';
import Bed from './props/Bed';
import { LaundryTower, Nightstand, NeonBolt } from './props/EastWall';
import { GraffitiTag, Plaque, WaveSign, Poster, WallShelf } from './props/WallArt';
import FloorProps from './props/FloorProps';
import Lighting from './Lighting';
import { DESK } from './spec';

export default function StudioScene() {
  return (
    <>
      <Lighting />

      {/* shell + built-ins */}
      <Shell />
      <Wardrobe />
      <DisplayShelf />
      <CityWindow />
      <DoorAlcove />
      <LaundryTower />

      {/* wall dressing */}
      <GraffitiTag />
      <Plaque x={DESK.x1 - 0.16} y={1.78} />
      <WaveSign />
      <Poster />
      <WallShelf />
      <NeonBolt />

      {/* furniture */}
      <Desk />
      <Chair />
      <IdBadge />
      <Bed />
      <Nightstand />

      {/* loose props */}
      <FloorProps />
    </>
  );
}
