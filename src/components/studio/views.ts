/**
 * Named cameras. The first seven reproduce the panels of the reference sheet
 * (images/complete_room.png) one-for-one, so the build can be compared against
 * it panel by panel.
 */

import { create } from 'zustand';
import { HALF_W, HALF_D, MONITOR, BADGE, BADGE_NORMAL } from './spec';

export type ViewId =
  | 'hero'
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'desk'
  | 'monitor'
  | 'badge'
  | 'bed'
  | 'bath'
  | 'archive'
  | 'rack'
  | 'contact';

export type View = { label: string; position: [number, number, number]; target: [number, number, number]; fov?: number };

const EYE = 1.6;

export const VIEWS: Record<ViewId, View> = {
  // Inside the room, in the south-east corner, looking across it: the north wall
  // (desk, wardrobe, window), the bed and the bathroom alcove all in one frame.
  hero: { label: 'Hero', position: [HALF_W - 0.28, 2.0, HALF_D - 0.28], target: [0.1, 0.85, -1.0], fov: 68 },
  front: { label: 'Front', position: [0, EYE, HALF_D - 0.2], target: [0, EYE - 0.1, -HALF_D], fov: 74 },
  back: { label: 'Back', position: [-0.9, EYE, -HALF_D + 0.5], target: [-2.6, EYE - 0.1, HALF_D], fov: 66 },
  left: { label: 'Left', position: [HALF_W - 0.45, EYE, 0.5], target: [-HALF_W, EYE - 0.15, -0.2], fov: 72 },
  right: { label: 'Right', position: [-HALF_W + 0.45, EYE, -0.1], target: [HALF_W, EYE - 0.15, -0.6], fov: 72 },
  top: { label: 'Plan', position: [0, 9.6, 0.02], target: [0, 0, 0], fov: 40 },
  desk: { label: 'Desk', position: [-1.3, 1.45, 0.3], target: [-2.2, 1.15, -2.2], fov: 55 },
  /**
   * Square on the ultrawide, from just above and behind the chair back — any
   * lower and the backrest cuts across the bottom third of the panel. The fov
   * is chosen so the glass fills ~80% of the frame width at 16:9.
   */
  monitor: {
    label: 'Monitor',
    position: [MONITOR.x, MONITOR.y + 0.175, MONITOR.z + 1.39],
    target: [MONITOR.x, MONITOR.y - 0.025, MONITOR.z + MONITOR.face],
    fov: 26,
  },
  /**
   * Square on the ID card, backed off along its own normal with a little lift
   * so the line of sight passes over the seat cushion rather than through it.
   * A 24° lens at 380 mm puts the 108 mm card across ~67% of frame height —
   * readable, with the lanyard clip still in shot for context.
   */
  badge: {
    label: 'About',
    position: [
      BADGE.x + BADGE_NORMAL[0] * 0.38,
      BADGE.y + BADGE_NORMAL[1] * 0.38 + 0.05,
      BADGE.z + BADGE_NORMAL[2] * 0.38,
    ],
    target: [BADGE.x, BADGE.y, BADGE.z],
    fov: 24,
  },
  bed: { label: 'Bed', position: [0.1, 1.95, 1.6], target: [2.5, 0.85, -1.5], fov: 55 },
  bath: { label: 'Bath', position: [-1.1, 1.5, -0.1], target: [-HALF_W - 0.74, 1.3, -0.4], fov: 52 },

  /* ---- portfolio stops (see stops.ts) ---- */
  /** The spray tag over the desk, with the monitor and lamp in the bottom of frame for context. */
  archive: { label: 'Archive', position: [-1.62, 1.72, 0.75], target: [-2.0, 1.92, -HALF_D], fov: 40 },
  /** Straight down the wardrobe bay, low enough that the rail sits in the upper third. */
  rack: { label: 'Rack', position: [-0.5, 1.42, 1.05], target: [-0.54, 1.3, -HALF_D], fov: 47 },
  /** Over the foot of the bed, out through the window with the neon bolt on the pier. */
  contact: { label: 'Contact', position: [1.15, 1.62, 0.95], target: [1.5, 1.55, -HALF_D], fov: 44 },
};

/** Reference-sheet cameras. Only offered in the HUD with ?debug in the URL. */
export const DEBUG_VIEWS: ViewId[] = [
  'hero',
  'front',
  'back',
  'left',
  'right',
  'top',
  'desk',
  'monitor',
  'badge',
  'bed',
  'bath',
];

type Store = { view: ViewId; setView: (v: ViewId) => void };

export const useStudioView = create<Store>((set) => ({
  view: 'hero',
  setView: (view) => set({ view }),
}));
