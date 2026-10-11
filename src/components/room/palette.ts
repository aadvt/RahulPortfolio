// Shared material palette for the studio room.
// Keeping colors in one place so the whole scene reads as one lighting system.

export const PALETTE = {
  // Structure
  concrete: '#3d3d45',
  concreteLight: '#50505a',
  concreteWarm: '#4a453f',
  floor: '#2c2c32',
  trim: '#14141f',
  tile: '#4c4c54',

  // Woods
  woodDark: '#4f3622',
  woodMed: '#6b4a30',
  woodLight: '#8a5f3d',

  // Metals / plastics
  metalDark: '#1b1b20',
  metalMid: '#3a3a42',
  chrome: '#c8ccd2',
  black: '#141418',

  // Neon / LED
  neonPurple: '#a855f7',
  neonBlue: '#3b82f6',
  neonCyan: '#22d3ee',
  warmLED: '#ffb45a',

  // Accent objects
  basketball: '#c2410c',
  nikeOrange: '#e8632a',
  detergentBlue: '#2563eb',
  plantGreen: '#2f6b45',
  clothRed: '#8f2a2a',
  clothGrey: '#5a5a62',
  clothPlaid: '#7a3b3b',
  bedding: '#26262c',
  rug: '#22222a',
} as const;
