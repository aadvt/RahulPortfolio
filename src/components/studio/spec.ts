/**
 * STUDIO ROOM — measured reconstruction spec.
 *
 * Every dimension below is in METRES and was measured off the reference sheet
 * `images/complete_room.png` (hero iso + front/back/left/right elevations +
 * floor plan + three ceiling views). Elevation pixel heights were normalised
 * against the ceiling line (3.05 m) to convert to real units.
 *
 * Axes:  +X = east (right),  +Z = south (toward the open side),  +Y = up.
 * Origin sits on the floor at the centre of the room.
 *
 * Wall roles (matching the reference views):
 *   NORTH (z = -D/2) .. graffiti + desk, wardrobe, display shelf, window,
 *                       neon bolt pier, stacked laundry tower
 *   EAST  (x = +W/2) .. bed head, nightstand
 *   WEST  (x = -W/2) .. bathroom + curtained door pocket, poster wall
 *   SOUTH ............ blank plaster, cut away when the camera is outside
 *
 * Everything the reference shows head-on in the hero lives on the NORTH wall.
 * That is deliberate: the hero camera sits south-east, so only north- and
 * west-facing joinery is ever visible in the marquee shot, and anything parked
 * against the east wall would show the viewer its back.
 */

export const ROOM = {
  width: 5.8, // X
  depth: 4.4, // Z
  height: 3.05, // Y
  wallThickness: 0.24,
} as const;

export const HALF_W = ROOM.width / 2; // 2.90
export const HALF_D = ROOM.depth / 2; // 2.20

/** Perimeter LED cove: a shadow-gap reveal cut into the top of every wall. */
export const COVE = {
  bottom: 2.86, // where the plaster wall stops
  setback: 0.075, // how far the reveal is pushed back into the wall
  stripY: 2.935, // centre height of the emissive strip
  stripHeight: 0.028,
  stripDepth: 0.014,
} as const;

/** Shadow gap where the wall meets the floor (reads as a recessed skirting). */
export const SKIRT = { height: 0.05, setback: 0.022 } as const;

/* ------------------------------------------------------------------ */
/* NORTH WALL                                                          */
/* ------------------------------------------------------------------ */

/** Editing desk — long walnut top on a black steel frame, against the graffiti. */
export const DESK = {
  x0: -2.82,
  x1: -1.14,
  depth: 0.68,
  top: 0.755, // worktop upper face
  thickness: 0.045,
  /** Drawer pedestal hangs under the left third of the top. */
  pedestal: { x0: -2.74, x1: -2.22, drawers: 4 },
  /** Glass-side PC tower stands on the floor under the right end. */
  tower: { x: -1.42, z: -1.82, w: 0.26, h: 0.50, d: 0.46 },
} as const;

/**
 * The 34" ultrawide. Derived from DESK rather than measured independently so
 * the panel can never drift off its own worktop, and pulled out of Desk.tsx
 * because the clickable screen, the camera that flies to it and the video
 * player mounted on its glass all need the same numbers.
 */
export const MONITOR = {
  /** Centre of the panel, in world space. */
  x: (DESK.x0 + DESK.x1) / 2 + 0.02,
  z: -ROOM.depth / 2 + 0.02 + 0.19,
  /** Screen centre height: worktop + stand rise. */
  y: DESK.top + 0.47,
  width: 1.0,
  height: 0.42,
  bezel: 0.011,
  /**
   * Curvature of the shell. Gentle on purpose — the glass itself is one flat
   * plane (a curved DOM panel does not exist), so the arc behind it has to stay
   * shallow enough that the two never visibly separate.
   */
  radius: 6.0,
  segments: 9,
  /** How far the flat glass sits proud of the arc's origin plane. */
  face: 0.03,
} as const;

/** Graffiti tag painted straight onto the plaster above the desk. */
export const TAG = { x: -2.0, y: 2.22, width: 1.72, height: 0.72 } as const;

/** Open wardrobe — north wall, hanging bay with a boxed-out top shelf. */
export const WARDROBE = {
  x0: -1.10,
  x1: 0.02,
  height: 2.42,
  depth: 0.60,
  frame: 0.055,
  topShelf: 1.92, // full-width shelf; storage boxes live above it
  railY: 1.78,
} as const;

/** Lit display shelf — north wall, hard against the wardrobe's east side. */
export const SHELF = {
  x0: 0.02,
  x1: 0.76,
  height: 2.42,
  depth: 0.40,
  frame: 0.05,
  plinth: 0.07,
  /** Shelf face heights measured from the floor (bottom -> top). */
  shelves: [0.52, 0.92, 1.34, 1.76, 2.12],
  /** Bays that carry an LED strip under the shelf above them. */
  litBays: [1, 2, 3],
} as const;

/** City window — north wall, over the bed. */
export const WINDOW = {
  centerX: 1.30,
  width: 0.84,
  sill: 0.64,
  head: 2.46,
  reveal: 0.16, // how deep the opening is set back from the room face
  frame: 0.055,
  blindDrop: 0.44, // venetian blinds hang this far below the head
} as const;

/**
 * Laundry tower — washer stacked under a dryer plus a narrow utility bay, in
 * the north-east corner. It faces south so the machines read in the hero, and
 * the bed head tucks against its west return.
 */
export const LAUNDRY = {
  x0: 1.94,
  x1: 2.90,
  height: 2.52,
  depth: 0.66, // how far it stands off the north wall
  frame: 0.05,
  plinth: 0.07,
  /** The machines fill the west part; the rest is open shelving. */
  split: 0.66, // fraction of the inner width taken by the machine bay
  topShelf: 1.9,
  /** The stack starts above mattress height so both doors read past the bed. */
  machineBase: 0.62,
  machine: { size: 0.56, gap: 0.012 },
} as const;

/** Violet neon bolt on the plaster pier between the window and the tower. */
export const BOLT = { x: 1.83, y: 1.58, height: 0.44 } as const;

/* ------------------------------------------------------------------ */
/* EAST WALL                                                           */
/* ------------------------------------------------------------------ */

/** Nightstand tucked against the east wall, south of the bed head. */
export const NIGHTSTAND = { x: 2.6, z: 0.62, w: 0.52, d: 0.5, h: 0.56 } as const;

/* ------------------------------------------------------------------ */
/* WEST WALL                                                           */
/* ------------------------------------------------------------------ */

/**
 * The wet pocket: one recess carved back into the west wall holding the
 * curtained door (north end) and the vanity (south end), split by a pier.
 */
export const ALCOVE = {
  z0: -1.88,
  z1: 0.12,
  height: 2.32,
  depth: 0.74, // pocket depth, carved back into the wall
  surround: 0.1, // pilaster projection into the room
  lining: 0.09, // warm stone reveal thickness
  step: { out: 0.26, rise: 0.045, round: 0.16 },
  door: { z0: -1.80, z1: -1.0, height: 2.06 },
  /** Pier between the door and the vanity — the towel hangs here. */
  pier: { z0: -1.0, z1: -0.86 },
  light: { z: -1.4, y: 2.28 }, // recessed downlight over the threshold
} as const;

/** Vanity unit + LED mirror on the pocket's back wall. */
export const VANITY = {
  z: -0.44, // centre
  width: 0.80,
  depth: 0.46,
  height: 0.82,
  mirror: { width: 0.50, height: 0.72, bottom: 1.16 },
} as const;

/** Blue waveform sign, high on the west wall over the pocket. */
export const SIGN = { z: -1.3, y: 2.6, width: 0.58, height: 0.32 } as const;

/** Poster + floating shelf on the plain south stretch of the west wall. */
export const POSTER = { z: 0.82, y: 1.92, width: 0.40, height: 0.54 } as const;
export const WALL_SHELF = { z: 0.86, y: 1.32, width: 0.46, depth: 0.16 } as const;

/* ------------------------------------------------------------------ */
/* FLOOR                                                               */
/* ------------------------------------------------------------------ */

/** Low walnut platform bed with an LED underglow, head against the east wall. */
export const BED = {
  x0: 0.82,
  x1: 2.84, // head end, hard against the east wall
  z0: -1.48, // clears the laundry tower's south face by 60 mm
  z1: 0.06,
  deck: 0.30, // platform top
  overhang: 0.11, // deck oversail past the plinth, so the LED reads as a slot
  mattress: 0.26,
} as const;

/** Charcoal low-pile rug filling the middle of the floor. */
export const RUG = { x: -0.52, z: 0.86, w: 2.4, d: 1.94 } as const;

export const CHAIR = { x: -1.96, z: -1.06, rot: 0.34 } as const;

/**
 * The ID card hanging off the chair's backrest — clickable, and the only
 * "about me" surface in the room.
 *
 * Placed here rather than nested inside <Chair> because the camera that flies
 * in to read it needs the card's world transform, and a badge that has drifted
 * out from under its own close-up is worse than no close-up.
 */
export const BADGE = (() => {
  // Where the card sits in chair space (lanyard group + card offset).
  const lx = 0.025;
  const ly = 0.575;
  const lz = -0.114;
  const c = Math.cos(CHAIR.rot);
  const s = Math.sin(CHAIR.rot);
  return {
    x: CHAIR.x + lx * c + lz * s,
    y: ly,
    z: CHAIR.z - lx * s + lz * c,
    /** Yaw follows the chair; the card is tipped back and rolled a hair. */
    yaw: CHAIR.rot,
    tilt: 0.09,
    roll: 0.02,
    width: 0.072,
    height: 0.108,
    thickness: 0.005,
  };
})();

/** Outward normal of the card face, in world space. */
export const BADGE_NORMAL: [number, number, number] = (() => {
  const ct = Math.cos(BADGE.tilt);
  const st = Math.sin(BADGE.tilt);
  const cy = Math.cos(BADGE.yaw);
  const sy = Math.sin(BADGE.yaw);
  return [ct * sy, -st, ct * cy];
})();
export const DUFFEL = { x: -2.3, z: 1.34, rot: 0.42 } as const;
export const SKATE = { z: 0.6, lean: 0.13 } as const;
export const SNEAKERS = { x: 1.94, z: 0.48 } as const;

/** Diorama base slab the room sits on (visible from the hero camera). */
export const BASE = { overhang: 0.5, thickness: 0.18, chamfer: 0.62 } as const;

/**
 * Albedo palette. These are base colours only — the scene is deliberately
 * under-lit, so most surfaces render far darker than their albedo.
 */
export const C = {
  plaster: '#8b8783',
  plasterCool: '#837c78',
  ceiling: '#7e7773',
  floor: '#7d7975',
  trim: '#3b3a3e',
  walnut: '#4a3122',
  walnutDark: '#38251a',
  walnutLight: '#5d4029',
  travertine: '#c3ae95',
  windowFrame: '#191b20',
  blinds: '#252931',
  curtain: '#1b140f',
  metal: '#8e9199',
  steel: '#1c1d21',
  appliance: '#b9bcc0',
  bedding: '#33322f',
  rug: '#2a2926',

  neon: '#b750ff',
  neonLight: '#8f3dff',
  neonBlue: '#4aa8ff',
  warmLED: '#ffb765',
  downlight: '#ffd2a2',
  lantern: '#ffa64d',
  cityGlow: '#6179b8',
  screen: '#5fa8d6',
  rgb: '#c05cff',
} as const;
