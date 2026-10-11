/**
 * Deterministic noise helpers used by the procedural texture bakery.
 * Everything is seeded so a reload always produces the identical room.
 */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t: number) => t * t * (3 - 2 * t);

/**
 * Value noise on an N x N lattice. Sampling with `x = u * N` makes the result
 * tile seamlessly across u,v in [0,1] — which is what wall/floor repeats need.
 */
export function valueNoise(seed: number, n: number) {
  const rnd = mulberry32(seed);
  const grid = new Float32Array(n * n);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();

  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const i0 = ((xi % n) + n) % n;
    const j0 = ((yi % n) + n) % n;
    const i1 = (i0 + 1) % n;
    const j1 = (j0 + 1) % n;
    const a = grid[j0 * n + i0];
    const b = grid[j0 * n + i1];
    const c = grid[j1 * n + i0];
    const d = grid[j1 * n + i1];
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
  };
}

export type Noise2D = (u: number, v: number) => number;

/** Tiling fractal noise. `base` = lattice cells across the texture. */
export function fbm(seed: number, base: number, octaves = 4, gain = 0.5, aspect = 1): Noise2D {
  const layers: { fx: number; fy: number; amp: number; n: (x: number, y: number) => number }[] = [];
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const fx = Math.max(1, Math.round(base * Math.pow(2, o)));
    const fy = Math.max(1, Math.round(base * aspect * Math.pow(2, o)));
    layers.push({ fx, fy, amp, n: valueNoise(seed + o * 9173, Math.max(fx, fy)) });
    total += amp;
    amp *= gain;
  }
  return (u, v) => {
    let s = 0;
    for (const l of layers) s += l.n(u * l.fx, v * l.fy) * l.amp;
    return s / total;
  };
}

/** Ridged noise — good for hairline cracks and stone veining. */
export function ridged(seed: number, base: number, octaves = 3, aspect = 1): Noise2D {
  const f = fbm(seed, base, octaves, 0.55, aspect);
  return (u, v) => 1 - Math.abs(f(u, v) * 2 - 1);
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
