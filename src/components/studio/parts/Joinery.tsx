/**
 * Built-in joinery on the north wall: the open hanging wardrobe and the lit
 * display shelf that butts against its east side.
 *
 * Both are the same construction language from the reference — a walnut carcass
 * with a visible face frame, a warm stone back panel, an LED tucked behind
 * every shelf nosing, and a bevel on every edge so the units catch a highlight
 * instead of reading as flat boxes.
 */

import { WARDROBE as WD, SHELF as SH, HALF_D, C } from '../spec';
import { mat, plain, Panel, Slab, Cyl, Ball } from '../kit';
import { M, ShelfLED, StorageBox, ShoeBox, Plant, Vine } from '../props/common';
import Garments from '../props/Garments';

const walnut = (u: number, v: number) => mat('walnut', { repeat: [u, v], normalScale: 0.75 });
const walnutDeep = (u: number, v: number) => mat('walnut', { repeat: [u, v], tint: '#8e7f75', normalScale: 0.75 });
const stone = (u: number, v: number) =>
  mat('travertine', { repeat: [u, v], tint: '#8f8478', normalScale: 0.9 });

/* ------------------------------------------------------------------ */
/* Open wardrobe — north wall                                          */
/* ------------------------------------------------------------------ */

export function Wardrobe() {
  const w = WD.x1 - WD.x0;
  const d = WD.depth;
  const f = WD.frame;
  const innerW = w - f * 2;
  const cx = (WD.x0 + WD.x1) / 2;
  const top = WD.height;
  const shelfT = 0.04;

  const carcass = walnut(1.2, 2.6);
  const board = walnut(1.2, 0.5);
  const back = walnutDeep(1.2, 2.2);

  return (
    <group position={[cx, 0, -HALF_D]}>
      {/* back panel, held a few mm off the wall so the LED can graze it */}
      <Slab size={[innerW, top - 0.02, 0.018]} position={[0, top / 2, 0.02]} material={back} />

      {/* carcass */}
      <Panel size={[f, top, d]} position={[-w / 2 + f / 2, top / 2, d / 2]} material={carcass} />
      <Panel size={[f, top, d]} position={[w / 2 - f / 2, top / 2, d / 2]} material={carcass} />
      <Panel size={[w, f, d]} position={[0, top - f / 2, d / 2]} material={board} />
      <Panel size={[innerW, f, d - 0.02]} position={[0, f / 2, d / 2]} material={board} />

      {/* full-width shelf; the storage above it is what you see from the room */}
      <Panel size={[innerW, shelfT, d - 0.02]} position={[0, WD.topShelf, (d - 0.02) / 2]} material={board} />
      <Panel
        size={[innerW, shelfT + 0.014, 0.016]}
        position={[0, WD.topShelf, d - 0.026]}
        material={board}
        radius={0.005}
      />

      {/* hanging rail + its brackets */}
      <Cyl
        r={0.014}
        h={innerW - 0.02}
        position={[0, WD.railY, d * 0.52]}
        rotation={[0, 0, Math.PI / 2]}
        material={plain(C.metal, 0.28, 0.9)}
        segments={14}
      />
      {[-1, 1].map((s) => (
        <Slab
          key={s}
          size={[0.03, 0.05, 0.05]}
          position={[s * (innerW / 2 - 0.02), WD.railY + 0.03, d * 0.52]}
          material={M.steel}
        />
      ))}

      {/* the clothes themselves */}
      <Garments
        count={11}
        width={innerW - 0.14}
        railY={WD.railY}
        z={d * 0.52}
        seed={17}
      />

      {/* rail wash: tape behind the shelf nosing, aimed down at the shoulders */}
      <ShelfLED length={innerW - 0.08} position={[0, WD.topShelf - 0.052, d - 0.085]} intensity={2.4} />

      {/* top-shelf storage: sneaker boxes and two fabric bins */}
      <ShoeBox size={[0.3, 0.15, 0.19]} position={[-w / 2 + 0.24, WD.topShelf + 0.1, d * 0.5]} rotation={[0, 0.06, 0]} body="#d5d1c9" lid="#c9c4bb" />
      <ShoeBox size={[0.3, 0.15, 0.19]} position={[-w / 2 + 0.24, WD.topShelf + 0.26, d * 0.5]} rotation={[0, -0.04, 0]} body="#c8562a" lid="#d2603a" />
      <ShoeBox size={[0.28, 0.14, 0.18]} position={[-w / 2 + 0.6, WD.topShelf + 0.095, d * 0.48]} rotation={[0, -0.09, 0]} body="#2f3033" lid="#3a3b3f" />
      <StorageBox size={[0.3, 0.21, 0.22]} position={[w / 2 - 0.24, WD.topShelf + 0.13, d * 0.5]} tint="#4a4b4f" />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Lit display shelf — north wall, east of the wardrobe                */
/* ------------------------------------------------------------------ */

export function DisplayShelf() {
  const w = SH.x1 - SH.x0;
  const d = SH.depth;
  const f = SH.frame;
  const innerW = w - f * 2;
  const cx = (SH.x0 + SH.x1) / 2;
  const top = SH.height;
  const shelfT = 0.036;

  const carcass = walnut(1.0, 2.6);
  const board = walnut(1.0, 0.4);
  const back = stone(1.0, 2.4);

  return (
    <group position={[cx, 0, -HALF_D]}>
      <Slab size={[innerW, top - SH.plinth, 0.018]} position={[0, (top + SH.plinth) / 2, 0.02]} material={back} />

      {/* carcass */}
      <Panel size={[f, top, d]} position={[-w / 2 + f / 2, top / 2, d / 2]} material={carcass} />
      <Panel size={[f, top, d]} position={[w / 2 - f / 2, top / 2, d / 2]} material={carcass} />
      <Panel size={[w, f, d]} position={[0, top - f / 2, d / 2]} material={board} />
      <Panel size={[innerW, f, d - 0.02]} position={[0, SH.plinth + f / 2, d / 2]} material={board} />
      <Slab size={[w - 0.02, SH.plinth, d - 0.05]} position={[0, SH.plinth / 2, d / 2 - 0.025]} material={walnutDeep(1, 0.2)} />

      {/* shelves with a proud nosing that catches the strip light */}
      {SH.shelves.map((y, i) => (
        <group key={i}>
          <Panel size={[innerW, shelfT, d - 0.025]} position={[0, y - shelfT / 2, (d - 0.025) / 2]} material={board} />
          <Panel
            size={[innerW, shelfT + 0.012, 0.014]}
            position={[0, y - shelfT / 2, d - 0.024]}
            material={board}
            radius={0.004}
          />
        </group>
      ))}

      {/* bay lighting */}
      {SH.litBays.map((b) => {
        const yTop = SH.shelves[b + 1] ?? top - f;
        return <ShelfLED key={b} length={innerW - 0.05} position={[0, yTop - 0.062, d - 0.07]} intensity={2.4} />;
      })}

      <ShelfDressing width={innerW} depth={d} />
    </group>
  );
}

/**
 * What actually lives on the display shelf, bottom to top: record crates,
 * a turntable, the basketball, an award and a framed photo.
 */
function ShelfDressing({ width, depth }: { width: number; depth: number }) {
  const zc = depth * 0.5;
  const [s0, s1, s2, s3, s4] = SH.shelves;

  return (
    <group>
      {/* --- bottom bay: two fabric bins ------------------------------- */}
      <StorageBox size={[width * 0.44, 0.2, depth * 0.62]} position={[-width * 0.24, SH.plinth + 0.14, zc]} tint="#33353a" />
      <StorageBox size={[width * 0.44, 0.2, depth * 0.62]} position={[width * 0.24, SH.plinth + 0.14, zc]} tint="#3d3f44" />

      {/* --- s0..s1: vinyl crate + a leaning sleeve -------------------- */}
      <group position={[-width * 0.2, s0 + 0.005, zc]}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh
            key={i}
            position={[-0.13 + i * 0.019, 0.145, 0]}
            rotation={[0, 0, 0.03 + (i % 3) * 0.012]}
            material={plain(['#241f2c', '#2e2a20', '#1d2630', '#3a2530'][i % 4], 0.86)}
            castShadow
          >
            <boxGeometry args={[0.014, 0.29, depth * 0.66]} />
          </mesh>
        ))}
      </group>
      <StorageBox size={[width * 0.34, 0.2, depth * 0.6]} position={[width * 0.28, s0 + 0.105, zc]} tint="#2f3136" />

      {/* --- s1..s2: turntable ---------------------------------------- */}
      <group position={[0, s1 + 0.005, zc]}>
        <Panel size={[width * 0.78, 0.055, depth * 0.72]} position={[0, 0.028, 0]} material={M.blackMatte} radius={0.008} />
        <Cyl r={0.085} h={0.014} position={[-width * 0.09, 0.062, 0]} material={plain('#151518', 0.5, 0.3)} segments={22} />
        <Cyl r={0.082} h={0.006} position={[-width * 0.09, 0.071, 0]} material={plain('#e0b447', 0.42, 0.3)} segments={22} />
        <Cyl r={0.011} h={0.012} position={[-width * 0.09, 0.077, 0]} material={M.chrome} segments={10} />
        {/* tonearm */}
        <Cyl r={0.007} h={0.016} position={[width * 0.2, 0.064, -depth * 0.2]} material={M.chrome} segments={10} />
        <mesh position={[width * 0.06, 0.076, -depth * 0.05]} rotation={[0, -0.72, 0]} material={M.chrome} castShadow={false}>
          <boxGeometry args={[0.2, 0.007, 0.007]} />
        </mesh>
      </group>

      {/* --- s2..s3: basketball + a small plant ------------------------ */}
      <group position={[-width * 0.16, s2 + 0.125, zc]}>
        <Ball r={0.121} material={plain('#a4551f', 0.86)} segments={22} />
        {/* seams */}
        {[0, 1].map((i) => (
          <mesh key={i} rotation={[0, (i * Math.PI) / 2, 0]} material={plain('#241109', 0.9)}>
            <torusGeometry args={[0.121, 0.0035, 6, 30]} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={plain('#241109', 0.9)}>
          <torusGeometry args={[0.121, 0.0035, 6, 30]} />
        </mesh>
      </group>
      <Plant position={[width * 0.28, s2 + 0.004, zc + 0.02]} scale={0.8} seed={1.2} />

      {/* --- s3..s4: award, framed photo, curio ------------------------ */}
      <group position={[-width * 0.24, s3 + 0.005, zc]}>
        {/* faceted crystal award on a black plinth */}
        <Panel size={[0.11, 0.028, 0.08]} position={[0, 0.014, 0]} material={M.blackMatte} radius={0.005} />
        <mesh position={[0, 0.115, 0]} material={plain('#7b8ea8', 0.14, 0.35, { transparent: true, opacity: 0.72 })} castShadow>
          <octahedronGeometry args={[0.085, 0]} />
        </mesh>
      </group>
      <group position={[width * 0.12, s3 + 0.06, zc - 0.01]} rotation={[0, -0.22, 0]}>
        <Panel size={[0.14, 0.11, 0.014]} material={walnutDeep(0.4, 0.3)} radius={0.005} />
        <mesh position={[0, 0, 0.009]} material={plain('#20242e', 0.5)}>
          <planeGeometry args={[0.11, 0.082]} />
        </mesh>
      </group>
      <Cyl r={0.035} r2={0.03} h={0.09} position={[width * 0.32, s3 + 0.045, zc]} material={plain('#3c4048', 0.6, 0.25)} segments={12} />

      {/* --- top shelf: trailing vine over the edge -------------------- */}
      <Vine position={[width * 0.34, s4 - 0.02, depth * 0.86]} length={0.56} leaves={18} seed={2.1} />
      <Plant position={[width * 0.3, s4 + 0.002, zc]} scale={0.72} seed={2.6} pot={M.terracotta} />
      <StorageBox size={[width * 0.42, 0.16, depth * 0.6]} position={[-width * 0.22, s4 + 0.085, zc]} tint="#3a3c41" />
    </group>
  );
}
