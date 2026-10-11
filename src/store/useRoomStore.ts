import { create } from 'zustand';

export type RoomTarget = 'NONE' | 'PC' | 'SHOES' | 'CLOSET' | 'MIRROR';

interface RoomState {
  activeTarget: RoomTarget;
  hoveredTarget: RoomTarget;
  setActiveTarget: (target: RoomTarget) => void;
  setHoveredTarget: (target: RoomTarget) => void;
  resetView: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  activeTarget: 'NONE',
  hoveredTarget: 'NONE',
  setActiveTarget: (target: RoomTarget) => set({ activeTarget: target }),
  setHoveredTarget: (target: RoomTarget) => set({ hoveredTarget: target }),
  resetView: () => set({ activeTarget: 'NONE', hoveredTarget: 'NONE' }),
}));
