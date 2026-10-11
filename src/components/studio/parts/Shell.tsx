/**
 * Room shell — floor slab, ceiling, four walls segmented around their openings,
 * the perimeter LED cove reveal, and the diorama base the room sits on.
 *
 * Walls are "cutaway": each one hides itself when the camera moves to its
 * outside face, which is what turns the closed room into the dollhouse view
 * from the reference hero render without changing any geometry.
 */

import * as THREE from 'three';
import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { ROOM, HALF_W, HALF_D, COVE, SKIRT, WINDOW, ALCOVE, BASE, C } from '../spec';
import { mat, plain, Slab, LedBar } from '../kit';
import { floorSurface, tiled } from '../textures';

const T = ROOM.wallThickness;
const WALL_TOP = COVE.bottom; // plaster stops here; the reveal band runs above

/* ------------------------------------------------------------------ */
/* Cutaway                                                             */
/* ------------------------------------------------------------------ */

type Axis = 'x' | 'y' | 'z';

/** Hides its children once the camera crosses to the outside of a plane. */
function Cutaway({ axis, sign, at, children }: { axis: Axis; sign: 1 | -1; at: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    const d = (camera.position[axis] - at) * sign;
    // Small hysteresis band so a camera parked on the plane doesn't strobe.
    if (g.visible && d < -0.12) g.visible = false;
    else if (!g.visible && d > 0.12) g.visible = true;
  });
  return <group ref={ref}>{children}</group>;
}

/* ------------------------------------------------------------------ */
/* Cove                                                                */
/* ------------------------------------------------------------------ */

/**
 * The recessed band above the wall plus its LED. `length` runs along the wall,
 * and the group is placed/rotated by the caller so +Z points into the room.
 */
function CoveRun({ length, offset = 0 }: { length: number; offset?: number }) {
  const band = mat('plaster', { repeat: [length / 2, 0.12], tint: '#cfcac6', normalScale: 0.5 });
  const h = ROOM.height - COVE.bottom;
  return (
    <group position={[offset, 0, 0]}>
      {/* recessed plaster band running up to the ceiling */}
      <Slab size={[length, h, 0.02]} position={[0, COVE.bottom + h / 2, -COVE.setback]} material={band} />
      {/* the ledge the strip sits on (reads as the shadow gap from below) */}
      <Slab size={[length, 0.02, COVE.setback]} position={[0, COVE.bottom, -COVE.setback / 2]} material={band} />
      {/* aluminium channel + the LED tape inside it */}
      <Slab
        size={[length, 0.03, 0.032]}
        position={[0, COVE.stripY - 0.026, -COVE.setback + 0.03]}
        material={plain('#2b2b31', 0.45, 0.7)}
      />
      <LedBar
        size={[length - 0.02, COVE.stripHeight, COVE.stripDepth]}
        position={[0, COVE.stripY, -COVE.setback + 0.036]}
        color={C.neon}
        intensity={3.1}
      />
      {/* diffuser bleed just above the tape, where the reveal catches most light */}
      <LedBar
        size={[length - 0.02, 0.012, 0.004]}
        position={[0, COVE.stripY + 0.03, -COVE.setback + 0.022]}
        color={C.neon}
        intensity={1.5}
      />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export default function Shell() {
  const wallOut = mat('plaster', { repeat: [2.4, 1.4], tint: '#4e4c4a', normalScale: 0.35 });
  const ceiling = mat('plaster', { repeat: [3.1, 2.2], tint: '#c8c3bf', normalScale: 0.28 });
  const trim = plain(C.trim, 0.42, 0.55);

  // Big repeats keep the mottling low-frequency: at 3 m per tile the wall reads
  // as poured concrete rather than as a texture swatch stamped nine times.
  const wall = (w: number, h: number) => mat('plaster', { repeat: [w / 3, h / 3], normalScale: 0.45 });

  const floorTex = useMemo(() => tiled(floorSurface(), ROOM.width / 2.6, ROOM.depth / 2.6), []);

  // Diorama base: chamfered octagon, the silhouette the hero render sits on.
  const baseGeo = useMemo(() => {
    const x = HALF_W + T + BASE.overhang;
    const z = HALF_D + T + BASE.overhang;
    const c = BASE.chamfer;
    const s = new THREE.Shape();
    s.moveTo(-x + c, -z);
    s.lineTo(x - c, -z);
    s.lineTo(x, -z + c);
    s.lineTo(x, z - c);
    s.lineTo(x - c, z);
    s.lineTo(-x + c, z);
    s.lineTo(-x, z - c);
    s.lineTo(-x, -z + c);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: BASE.thickness, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  // North wall segments around the window opening.
  const wx0 = WINDOW.centerX - WINDOW.width / 2;
  const wx1 = WINDOW.centerX + WINDOW.width / 2;
  const nLeftW = wx0 - -(HALF_W + T);
  const nRightW = HALF_W + T - wx1;

  // West wall segments around the alcove pocket.
  const aZ0 = ALCOVE.z0;
  const aZ1 = ALCOVE.z1;
  const wNorthD = aZ0 - -HALF_D;
  const wSouthD = HALF_D - aZ1;

  return (
    <group>
      {/* ===================== BASE + FLOOR ===================== */}
      <mesh geometry={baseGeo} position={[0, -BASE.thickness, 0]} material={trim} receiveShadow />

      {/*
        Burnished concrete, as a plain PBR surface.

        A real reflection pass was tried here and thrown out: drei's reflector
        blends the (almost entirely black) reflected room over the shaded
        surface, so the floor rendered near-black no matter what albedo it was
        given — dark enough that the charcoal rug on top of it read as the
        *lighter* object. A glossy standard material gets the same long
        specular streaks under the LED runs from the environment probe, and the
        concrete keeps its own value.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        {/* No roughness map. The baked one runs down to 0.18, which sends
            almost all of the floor's energy into a specular reflection of a
            black room and leaves the diffuse — the part you actually read as
            "concrete" — in the dark. */}
        <meshStandardMaterial
          map={floorTex.map}
          normalMap={floorTex.normalMap}
          normalScale={new THREE.Vector2(0.35, 0.35)}
          color={C.floor}
          metalness={0.04}
          roughness={0.52}
          envMapIntensity={0.35}
        />
      </mesh>

      {/* ===================== CEILING ===================== */}
      {/* The soffit slab starts 5 mm *above* the ceiling plane. Straddling it
          (which is what a slab centred on ROOM.height + half its own height
          does) puts two coplanar surfaces in the same depth range, and the
          ceiling strobes as soon as the camera moves. */}
      <Cutaway axis="y" sign={-1} at={ROOM.height}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM.height, 0]} material={ceiling} receiveShadow>
          <planeGeometry args={[ROOM.width, ROOM.depth]} />
        </mesh>
        <Slab
          size={[ROOM.width + T * 2, 0.14, ROOM.depth + T * 2]}
          position={[0, ROOM.height + 0.075, 0]}
          material={wallOut}
        />
      </Cutaway>

      {/* ===================== NORTH WALL (window) ===================== */}
      <Cutaway axis="z" sign={1} at={-HALF_D}>
        <group>
          <Slab
            size={[nLeftW, WALL_TOP, T]}
            position={[-(HALF_W + T) + nLeftW / 2, WALL_TOP / 2, -HALF_D - T / 2]}
            material={wall(nLeftW, WALL_TOP)}
          />
          <Slab
            size={[nRightW, WALL_TOP, T]}
            position={[wx1 + nRightW / 2, WALL_TOP / 2, -HALF_D - T / 2]}
            material={wall(nRightW, WALL_TOP)}
          />
          <Slab
            size={[WINDOW.width, WINDOW.sill, T]}
            position={[WINDOW.centerX, WINDOW.sill / 2, -HALF_D - T / 2]}
            material={wall(WINDOW.width, WINDOW.sill)}
          />
          <Slab
            size={[WINDOW.width, WALL_TOP - WINDOW.head, T]}
            position={[WINDOW.centerX, (WALL_TOP + WINDOW.head) / 2, -HALF_D - T / 2]}
            material={wall(WINDOW.width, WALL_TOP - WINDOW.head)}
          />
          {/* recessed shadow gap at the floor */}
          <Slab
            size={[ROOM.width + T * 2, SKIRT.height, 0.02]}
            position={[0, SKIRT.height / 2, -HALF_D - SKIRT.setback]}
            material={plain('#171418', 0.95)}
          />
          <group position={[0, 0, -HALF_D]}>
            <CoveRun length={ROOM.width + T * 2} />
          </group>
          <Slab size={[ROOM.width + T * 2, 0.1, T + 0.04]} position={[0, ROOM.height + 0.13, -HALF_D - T / 2]} material={trim} />
        </group>
      </Cutaway>

      {/* ===================== WEST WALL (alcove) ===================== */}
      <Cutaway axis="x" sign={1} at={-HALF_W}>
        <group>
          <Slab
            size={[T, WALL_TOP, wNorthD]}
            position={[-HALF_W - T / 2, WALL_TOP / 2, -HALF_D + wNorthD / 2]}
            material={wall(wNorthD, WALL_TOP)}
          />
          <Slab
            size={[T, WALL_TOP, wSouthD]}
            position={[-HALF_W - T / 2, WALL_TOP / 2, aZ1 + wSouthD / 2]}
            material={wall(wSouthD, WALL_TOP)}
          />
          <Slab
            size={[T, WALL_TOP - ALCOVE.height, aZ1 - aZ0]}
            position={[-HALF_W - T / 2, (WALL_TOP + ALCOVE.height) / 2, (aZ0 + aZ1) / 2]}
            material={wall(aZ1 - aZ0, WALL_TOP - ALCOVE.height)}
          />
          <Slab
            size={[0.02, SKIRT.height, ROOM.depth]}
            position={[-HALF_W - SKIRT.setback, SKIRT.height / 2, 0]}
            material={plain('#171418', 0.95)}
          />
          <group position={[-HALF_W, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <CoveRun length={ROOM.depth} />
          </group>
          <Slab size={[T + 0.04, 0.1, ROOM.depth + T * 2]} position={[-HALF_W - T / 2, ROOM.height + 0.13, 0]} material={trim} />
        </group>
      </Cutaway>

      {/* ===================== SOUTH WALL ===================== */}
      <Cutaway axis="z" sign={-1} at={HALF_D}>
        <group>
          <Slab
            size={[ROOM.width + T * 2, WALL_TOP, T]}
            position={[0, WALL_TOP / 2, HALF_D + T / 2]}
            material={wall(ROOM.width, WALL_TOP)}
          />
          <Slab
            size={[ROOM.width + T * 2, SKIRT.height, 0.02]}
            position={[0, SKIRT.height / 2, HALF_D + SKIRT.setback]}
            material={plain('#171418', 0.95)}
          />
          <group position={[0, 0, HALF_D]} rotation={[0, Math.PI, 0]}>
            <CoveRun length={ROOM.width + T * 2} />
          </group>
          <Slab size={[ROOM.width + T * 2, 0.1, T + 0.04]} position={[0, ROOM.height + 0.13, HALF_D + T / 2]} material={trim} />
        </group>
      </Cutaway>

      {/* ===================== EAST WALL ===================== */}
      <Cutaway axis="x" sign={-1} at={HALF_W}>
        <group>
          <Slab
            size={[T, WALL_TOP, ROOM.depth]}
            position={[HALF_W + T / 2, WALL_TOP / 2, 0]}
            material={wall(ROOM.depth, WALL_TOP)}
          />
          <Slab
            size={[0.02, SKIRT.height, ROOM.depth]}
            position={[HALF_W + SKIRT.setback, SKIRT.height / 2, 0]}
            material={plain('#171418', 0.95)}
          />
          <group position={[HALF_W, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <CoveRun length={ROOM.depth} />
          </group>
          <Slab size={[T + 0.04, 0.1, ROOM.depth + T * 2]} position={[HALF_W + T / 2, ROOM.height + 0.13, 0]} material={trim} />
        </group>
      </Cutaway>

    </group>
  );
}
