import type { CSSProperties } from 'react';

/** Shared visual language for /showcase — dark studio surface, warm accent. */
export const COLORS = {
  bg: '#08080a',
  surface: '#111114',
  surfaceRaised: '#17171c',
  border: 'rgba(255, 255, 255, 0.09)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  text: '#f4f4f5',
  textMuted: '#8b8b95',
  accent: '#ffb454',
};

export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
export const SANS = '"Space Grotesk", system-ui, sans-serif';

export const label: CSSProperties = {
  fontFamily: MONO,
  fontSize: '10px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: COLORS.textMuted,
};

export const panel: CSSProperties = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '14px',
};

export function chip(active = false): CSSProperties {
  return {
    fontFamily: MONO,
    fontSize: '11px',
    letterSpacing: '0.06em',
    padding: '7px 13px',
    borderRadius: '999px',
    cursor: 'pointer',
    transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
    border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
    background: active ? 'rgba(255, 180, 84, 0.14)' : 'transparent',
    color: active ? COLORS.accent : COLORS.textMuted,
  };
}
