/**
 * Whether the desk monitor is awake.
 *
 * Kept out of the React tree because three different places need it: the
 * clickable screen inside <Desk>, the camera rig (leaving the monitor view
 * puts the machine back to sleep) and the room's HUD.
 */

import { create } from 'zustand';

type Store = {
  /** True once the user has clicked the screen — the video player is mounted. */
  on: boolean;
  /** Index into REELS. */
  track: number;
  wake: () => void;
  sleep: () => void;
  setTrack: (i: number) => void;
};

export const useMonitor = create<Store>((set) => ({
  on: false,
  track: 0,
  wake: () => set({ on: true }),
  sleep: () => set({ on: false }),
  setTrack: (track) => set({ track }),
}));
