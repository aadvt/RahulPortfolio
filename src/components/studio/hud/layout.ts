/**
 * Panel geometry, shared by the DOM (which draws the panel) and the camera rig
 * (which slides the projection so the subject is not hidden behind it). Kept in
 * one place so the two can never disagree about where the panel is.
 */

import type { StopId } from '../stops';

/** Stops whose content lives in a side panel. Work plays on the monitor itself. */
export const PANEL_STOPS: StopId[] = ['about', 'archive', 'rack', 'contact'];

/** Below this width the panel becomes a bottom sheet. */
export const SHEET_BREAKPOINT = 900;

export const panelWidth = (w: number) => Math.round(Math.min(520, Math.max(380, w * 0.34)));
export const PANEL_GAP = 20;
export const sheetHeight = (h: number) => Math.round(h * 0.52);

/**
 * How far to shift the camera's view window, in CSS pixels. A positive x moves
 * the image left (into the space the right-hand panel leaves); a positive y
 * moves it up (above the bottom sheet).
 */
export function panelInset(stop: StopId, hidden: boolean, w: number, h: number) {
  // On a phone the overview's title sits over the top of the frame, so drop
  // the room into the open space below it.
  if (stop === 'home' && w < SHEET_BREAKPOINT) return { x: 0, y: -h * 0.09 };
  if (hidden || !PANEL_STOPS.includes(stop)) return { x: 0, y: 0 };
  if (w >= SHEET_BREAKPOINT) return { x: (panelWidth(w) + PANEL_GAP) / 2, y: 0 };
  return { x: 0, y: sheetHeight(h) * 0.42 };
}
