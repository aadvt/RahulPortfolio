/**
 * Procedural texture bakery.
 *
 * Every surface in the room is generated in code (no image assets): an albedo
 * canvas, a normal map derived from the same height field, and a roughness map.
 * Baking runs once per surface and is cached at module scope.
 */

import * as THREE from 'three';
import { fbm, ridged, clamp01, lerp, smoothstep, mulberry32, type Noise2D } from './noise';

export type Surface = {
  id: string;
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
};

type SurfaceOpts = {
  id: string;
  size?: number;
  /** 0..1 height field driving the normal map. */
  height: Noise2D;
  /** RGB 0..255 for a texel, given the local height. */
  color: (u: number, v: number, h: number) => [number, number, number];
  /** 0..1 roughness for a texel. */
  roughness: (u: number, v: number, h: number) => number;
  normalStrength?: number;
};

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function finish(tex: THREE.CanvasTexture, srgb: boolean) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function bake(o: SurfaceOpts): Surface {
  const size = o.size ?? 512;
  const strength = o.normalStrength ?? 1;

  const hField = new Float32Array(size * size);
  const albedo = canvas(size);
  const rough = canvas(size);
  const normal = canvas(size);

  const aCtx = albedo.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;
  const nCtx = normal.getContext('2d')!;
  const aImg = aCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const nImg = nCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const h = clamp01(o.height(u, v));
      hField[i] = h;

      const [r, g, b] = o.color(u, v, h);
      aImg.data[i * 4] = r;
      aImg.data[i * 4 + 1] = g;
      aImg.data[i * 4 + 2] = b;
      aImg.data[i * 4 + 3] = 255;

      const rg = Math.round(clamp01(o.roughness(u, v, h)) * 255);
      rImg.data[i * 4] = rg;
      rImg.data[i * 4 + 1] = rg;
      rImg.data[i * 4 + 2] = rg;
      rImg.data[i * 4 + 3] = 255;
    }
  }

  // Sobel the height field into a tangent-space normal map.
  const at = (x: number, y: number) => hField[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength;
      let ny = -dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      nImg.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      nImg.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nImg.data[i + 2] = Math.round((nz / len * 0.5 + 0.5) * 255);
      nImg.data[i + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);

  return {
    id: o.id,
    map: finish(new THREE.CanvasTexture(albedo), true),
    normalMap: finish(new THREE.CanvasTexture(normal), false),
    roughnessMap: finish(new THREE.CanvasTexture(rough), false),
  };
}

/* ------------------------------------------------------------------ */
/* Repeat helper                                                       */
/* ------------------------------------------------------------------ */

const repeatCache = new Map<string, Surface>();

/**
 * Clone a baked surface with a specific tiling. Clones share the GPU upload,
 * so tiling a surface across 20 meshes costs one texture in VRAM.
 */
export function tiled(s: Surface, u: number, v: number): Surface {
  const key = `${s.id}|${u.toFixed(3)}|${v.toFixed(3)}`;
  const hit = repeatCache.get(key);
  if (hit) return hit;
  const clone = (t: THREE.CanvasTexture) => {
    const c = t.clone();
    c.repeat.set(u, v);
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.needsUpdate = true;
    return c as THREE.CanvasTexture;
  };
  const out: Surface = {
    id: key,
    map: clone(s.map),
    normalMap: clone(s.normalMap),
    roughnessMap: clone(s.roughnessMap),
  };
  repeatCache.set(key, out);
  return out;
}

/** Tile a surface by world size, at `metres` per texture repeat. */
export function tiledBySize(s: Surface, width: number, height: number, metres = 2) {
  return tiled(s, width / metres, height / metres);
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

let _plaster: Surface | null = null;
/** Troweled plaster/concrete of the walls — mottled, hairline-cracked, matte. */
export function plasterSurface(): Surface {
  if (_plaster) return _plaster;
  const blotch = fbm(1201, 3, 4, 0.55);
  const grain = fbm(1307, 40, 3, 0.5);
  const micro = fbm(1409, 150, 2, 0.5);
  const cracks = ridged(1511, 6, 4);
  const patina = fbm(1613, 2, 3, 0.6);
  // Cast panels, ~0.5 m a side: a hairline joint every quarter of the texture.
  const panelSeam = (u: number, v: number) => {
    const x = (u * 4) % 1;
    const y = (v * 4) % 1;
    return Math.max(smoothstep(0.012, 0.0, Math.min(x, 1 - x)), smoothstep(0.012, 0.0, Math.min(y, 1 - y)));
  };

  _plaster = bake({
    id: 'plaster',
    // Deliberately gentle. Poured concrete is a *smooth* surface with colour
    // variation, not a rough one — a strong height field here turns every wall
    // into rock and is the fastest way to lose the reference's flat planes.
    size: 512,
    normalStrength: 0.55,
    height: (u, v) => {
      const crack = smoothstep(0.86, 0.99, cracks(u, v)) * 0.5;
      return clamp01(0.5 + (blotch(u, v) - 0.5) * 0.22 + (grain(u, v) - 0.5) * 0.2 + (micro(u, v) - 0.5) * 0.16 - crack - panelSeam(u, v) * 0.18);
    },
    color: (u, v, h) => {
      // Warm grey plaster with cool blotching and faint mineral staining.
      const t = (h - 0.5) * 0.55 + (patina(u, v) - 0.5) * 0.16;
      const seam = panelSeam(u, v);
      const base = 112 + t * 20 - seam * 34;
      return [
        clamp01((base - 2) / 255) * 255,
        clamp01((base - 3) / 255) * 255,
        clamp01((base + 4 + (patina(u, v) - 0.5) * 7) / 255) * 255,
      ];
    },
    roughness: (u, v, h) => 0.9 + (1 - h) * 0.09,
  });
  return _plaster;
}

let _floor: Surface | null = null;
/** Polished poured concrete — soft cloudy blotches, low-frequency gloss drift. */
export function floorSurface(): Surface {
  if (_floor) return _floor;
  const cloud = fbm(2203, 2, 4, 0.6);
  const swirl = fbm(2311, 5, 3, 0.5);
  const spec = fbm(2417, 3, 2, 0.5);
  const grit = fbm(2521, 180, 2, 0.5);
  // Large-format porcelain: 4 tiles across the 2.6 m repeat, thin dark joints.
  const joint = (u: number, v: number) => {
    const x = (u * 4) % 1;
    const y = (v * 4) % 1;
    return Math.max(smoothstep(0.014, 0.0, Math.min(x, 1 - x)), smoothstep(0.014, 0.0, Math.min(y, 1 - y)));
  };

  _floor = bake({
    id: 'floor',
    size: 512,
    normalStrength: 0.35,
    height: (u, v) => clamp01(0.5 + (cloud(u, v) - 0.5) * 0.3 + (grit(u, v) - 0.5) * 0.2 - joint(u, v) * 0.3),
    color: (u, v, h) => {
      const t = (cloud(u, v) - 0.5) * 0.7 + (swirl(u, v) - 0.5) * 0.4 + (h - 0.5) * 0.3;
      const base = 87 + t * 34 - joint(u, v) * 40;
      return [base + 3, base - 1, base - 3];
    },
    // Burnished concrete: mostly glossy with cloudier, duller patches.
    roughness: (u, v) => clamp01(0.18 + (spec(u, v) - 0.5) * 0.24 + (swirl(u, v) - 0.5) * 0.1),
  });
  return _floor;
}

let _walnut: Surface | null = null;
/** Dark walnut with straight grain running along V. */
export function walnutSurface(): Surface {
  if (_walnut) return _walnut;
  const grain = fbm(3301, 3, 4, 0.55, 26); // stretched heavily along V
  const fibre = fbm(3407, 8, 3, 0.5, 40);
  const pores = fbm(3511, 90, 2, 0.5, 3);
  const figure = fbm(3617, 2, 3, 0.6, 6);

  _walnut = bake({
    id: 'walnut',
    size: 512,
    normalStrength: 0.9,
    height: (u, v) => clamp01(0.5 + (grain(u, v) - 0.5) * 0.6 + (fibre(u, v) - 0.5) * 0.35 - (pores(u, v) > 0.78 ? 0.25 : 0)),
    color: (u, v, h) => {
      const g = (h - 0.5) * 1.5 + (figure(u, v) - 0.5) * 0.6;
      const t = clamp01(0.5 + g * 0.5);
      return [lerp(48, 104, t), lerp(30, 66, t), lerp(20, 42, t)];
    },
    // Satin lacquer: grain lines catch a little more light than the pores.
    roughness: (u, v, h) => clamp01(0.52 - (h - 0.5) * 0.22 + (pores(u, v) > 0.78 ? 0.16 : 0)),
  });
  return _walnut;
}

let _travertine: Surface | null = null;
/** Warm limestone lining — ashlar seams + horizontal bedding + pitting. */
export function travertineSurface(): Surface {
  if (_travertine) return _travertine;
  const bed = fbm(4103, 4, 4, 0.55, 7);
  const pit = fbm(4211, 70, 2, 0.5);
  const stain = fbm(4317, 2, 3, 0.6);
  const rnd = mulberry32(4423);
  const jitter: number[] = Array.from({ length: 16 }, () => rnd());

  // Running-bond seam field: 8 courses tall, half-brick offset per course.
  const seam = (u: number, v: number) => {
    const course = Math.floor(v * 8);
    const off = (course % 2) * 0.5 + jitter[course % 16] * 0.06;
    const x = ((u + off) % 0.25) / 0.25;
    const y = (v * 8) % 1;
    const vertical = smoothstep(0.02, 0.0, Math.min(x, 1 - x));
    const horizontal = smoothstep(0.035, 0.0, Math.min(y, 1 - y));
    return Math.max(vertical, horizontal);
  };

  _travertine = bake({
    id: 'travertine',
    size: 512,
    normalStrength: 1.9,
    height: (u, v) => clamp01(0.62 + (bed(u, v) - 0.5) * 0.4 - seam(u, v) * 0.55 - (pit(u, v) > 0.8 ? 0.22 : 0)),
    color: (u, v, h) => {
      const t = (h - 0.5) * 1.1 + (stain(u, v) - 0.5) * 0.5;
      return [clamp01((122 + t * 30) / 255) * 255, clamp01((119 + t * 29) / 255) * 255, clamp01((121 + t * 29) / 255) * 255];
    },
    roughness: (u, v, h) => clamp01(0.82 + (1 - h) * 0.12),
  });
  return _travertine;
}

let _tile: Surface | null = null;
/** Small-format bathroom floor tile — square grid, matte, faintly mottled. */
export function tileSurface(): Surface {
  if (_tile) return _tile;
  const mottle = fbm(6203, 5, 4, 0.55);
  const grit = fbm(6311, 120, 2, 0.5);
  const N = 6; // tiles across the texture
  const joint = (u: number, v: number) => {
    const x = (u * N) % 1;
    const y = (v * N) % 1;
    return Math.max(smoothstep(0.05, 0.0, Math.min(x, 1 - x)), smoothstep(0.05, 0.0, Math.min(y, 1 - y)));
  };

  _tile = bake({
    id: 'tile',
    size: 512,
    normalStrength: 1.5,
    height: (u, v) => clamp01(0.7 + (mottle(u, v) - 0.5) * 0.22 + (grit(u, v) - 0.5) * 0.1 - joint(u, v) * 0.6),
    color: (u, v, h) => {
      const t = (h - 0.5) * 0.9 + (mottle(u, v) - 0.5) * 0.5;
      const base = 132 + t * 34;
      return [base + 4, base, base - 6];
    },
    roughness: (u, v) => clamp01(0.42 + joint(u, v) * 0.45 + (mottle(u, v) - 0.5) * 0.14),
  });
  return _tile;
}

let _rug: Surface | null = null;
/** Charcoal low-pile rug — dense fibre noise with a woven directional bias. */
export function rugSurface(): Surface {
  if (_rug) return _rug;
  const pile = fbm(6427, 110, 3, 0.55, 1.4);
  const drift = fbm(6529, 6, 3, 0.6);
  const weave = fbm(6637, 200, 2, 0.5, 0.3);

  _rug = bake({
    id: 'rug',
    size: 512,
    normalStrength: 1.4,
    height: (u, v) => clamp01(0.5 + (pile(u, v) - 0.5) * 0.8 + (weave(u, v) - 0.5) * 0.35),
    color: (u, v, h) => {
      const t = (h - 0.5) * 0.9 + (drift(u, v) - 0.5) * 0.35;
      const base = 44 + t * 26;
      return [base + 2, base + 1, base];
    },
    roughness: () => 0.98,
  });
  return _rug;
}

let _denim: Surface | null = null;
/** Heavy cotton/denim twill — the bedding, the hoodie, the duffel. */
export function denimSurface(): Surface {
  if (_denim) return _denim;
  const twillA = fbm(6741, 90, 2, 0.5, 0.9);
  const twillB = fbm(6857, 90, 2, 0.5, 1.1);
  const slub = fbm(6961, 7, 3, 0.6);

  _denim = bake({
    id: 'denim',
    size: 256,
    normalStrength: 0.4,
    height: (u, v) => clamp01(0.5 + (twillA(u + v * 0.5, v) - 0.5) * 0.7 + (twillB(u, v) - 0.5) * 0.3),
    color: (u, v, h) => {
      const t = (h - 0.5) * 0.7 + (slub(u, v) - 0.5) * 0.35;
      const base = 74 + t * 24;
      return [base + 1, base, base - 2];
    },
    roughness: (u, v, h) => clamp01(0.9 - (h - 0.5) * 0.12),
  });
  return _denim;
}

let _fabric: Surface | null = null;
/** Heavy blackout curtain weave. */
export function fabricSurface(): Surface {
  if (_fabric) return _fabric;
  const weftU = fbm(5101, 120, 2, 0.5, 0.35);
  const weftV = fbm(5209, 120, 2, 0.5, 3);
  const slub = fbm(5303, 6, 3, 0.6);

  _fabric = bake({
    id: 'fabric',
    size: 256,
    normalStrength: 1.1,
    height: (u, v) => clamp01(0.5 + (weftU(u, v) - 0.5) * 0.5 + (weftV(u, v) - 0.5) * 0.5),
    color: (u, v, h) => {
      const t = (h - 0.5) * 0.8 + (slub(u, v) - 0.5) * 0.4;
      return [clamp01((30 + t * 14) / 255) * 255, clamp01((23 + t * 12) / 255) * 255, clamp01((17 + t * 10) / 255) * 255];
    },
    roughness: () => 0.96,
  });
  return _fabric;
}

/* ------------------------------------------------------------------ */
/* City backdrop                                                       */
/* ------------------------------------------------------------------ */

let _city: THREE.CanvasTexture | null = null;
/**
 * Dusk skyline seen through the window: magenta/orange gradient sky, layered
 * building silhouettes receding into haze, and thousands of window lights.
 */
export function cityTexture(): THREE.CanvasTexture {
  if (_city) return _city;
  const W = 1024;
  const H = 1280;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry32(90210);

  // --- sky -----------------------------------------------------------
  const horizon = H * 0.46;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#241a3d');
  sky.addColorStop(0.34, '#3d2b57');
  sky.addColorStop(0.62, '#6b4470');
  sky.addColorStop(0.83, '#a55a6a');
  sky.addColorStop(1, '#d97a52');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);
  ctx.fillStyle = '#1b1630';
  ctx.fillRect(0, horizon, W, H - horizon);

  // --- cloud bands ---------------------------------------------------
  const band = fbm(7717, 5, 4, 0.55, 0.12);
  const cloud = ctx.createImageData(W, Math.round(horizon));
  for (let y = 0; y < horizon; y++) {
    const v = y / horizon;
    for (let x = 0; x < W; x++) {
      const n = band(x / W, v);
      const density = smoothstep(0.55, 0.85, n) * smoothstep(0.05, 0.4, v) * (1 - smoothstep(0.75, 1, v));
      const i = (y * W + x) * 4;
      const warm = smoothstep(0.3, 1, v);
      cloud.data[i] = lerp(150, 232, warm);
      cloud.data[i + 1] = lerp(122, 150, warm);
      cloud.data[i + 2] = lerp(178, 150, warm);
      cloud.data[i + 3] = density * 210;
    }
  }
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = W;
  cloudCanvas.height = Math.round(horizon);
  cloudCanvas.getContext('2d')!.putImageData(cloud, 0, 0);
  ctx.drawImage(cloudCanvas, 0, 0);

  // Warm glow sitting on the horizon.
  const glow = ctx.createRadialGradient(W * 0.36, horizon, 10, W * 0.36, horizon, W * 0.7);
  glow.addColorStop(0, 'rgba(255,150,90,0.42)');
  glow.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // --- skyline layers ------------------------------------------------
  type Layer = { top: number; tint: string; haze: number; minW: number; maxW: number; lit: number; step: number };
  // Drawn big on purpose. Seen through a 0.9 m window from two metres away,
  // a "realistic" 40-px tower resolves to a couple of screen pixels and the
  // whole skyline turns into a dot grid.
  const layers: Layer[] = [
    { top: horizon - 30, tint: '#3d3866', haze: 0.55, minW: 34, maxW: 78, lit: 0.13, step: 66 },
    { top: horizon - 8, tint: '#2e2952', haze: 0.3, minW: 46, maxW: 106, lit: 0.19, step: 82 },
    { top: horizon + 18, tint: '#221d40', haze: 0.12, minW: 62, maxW: 148, lit: 0.27, step: 98 },
  ];

  for (const L of layers) {
    let x = -40;
    while (x < W + 40) {
      const w = L.minW + rnd() * (L.maxW - L.minW);
      const tall = rnd() > 0.82;
      const h = (tall ? 1.25 : 0.5) * (L.step * 0.55 + rnd() * L.step * 1.35);
      const top = Math.max(20, L.top - h);
      ctx.fillStyle = L.tint;
      ctx.fillRect(x, top, w, H - top);

      // haze wash so distant blocks sit back
      ctx.fillStyle = `rgba(140,120,160,${L.haze * 0.35})`;
      ctx.fillRect(x, top, w, H - top);

      // rooftop detail: mast / box / setback
      if (tall) {
        ctx.fillStyle = L.tint;
        ctx.fillRect(x + w * 0.45, top - 34 - rnd() * 36, 4, 38);
        ctx.fillStyle = 'rgba(255,60,60,0.9)';
        ctx.fillRect(x + w * 0.45 - 2, top - 37, 8, 6);
      } else if (rnd() > 0.5) {
        ctx.fillStyle = L.tint;
        ctx.fillRect(x + w * 0.2, top - 20, w * 0.4, 24);
      }

      // window grid
      const pitch = 13;
      const cols = Math.max(2, Math.floor(w / pitch));
      const rows = Math.floor((H - top) / (pitch * 1.15));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (rnd() > L.lit) continue;
          const wx = x + 5 + cx * ((w - 8) / cols);
          const wy = top + 8 + cy * pitch * 1.15;
          if (wy > H - 8) continue;
          const warm = rnd();
          ctx.fillStyle =
            warm > 0.78 ? 'rgba(190,215,255,0.9)' : warm > 0.3 ? 'rgba(255,196,120,0.95)' : 'rgba(255,150,70,0.85)';
          ctx.fillRect(wx, wy, 4.5 + rnd() * 3, 5.5);
        }
      }
      x += w + 4 + rnd() * 12;
    }
  }

  // Street-level light haze rising off the city.
  const street = ctx.createLinearGradient(0, H, 0, H * 0.62);
  street.addColorStop(0, 'rgba(255,170,90,0.3)');
  street.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = street;
  ctx.fillRect(0, H * 0.62, W, H * 0.38);

  _city = finish(new THREE.CanvasTexture(c), true);
  _city.wrapS = _city.wrapT = THREE.ClampToEdgeWrapping;
  return _city;
}

/* ------------------------------------------------------------------ */
/* Decals — flat art painted onto walls and screens                    */
/* ------------------------------------------------------------------ */

function decal(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

const HEAVY = '900 italic {S}px Impact, "Arial Black", "Haettenschweiler", sans-serif';
const font = (px: number) => HEAVY.replace('{S}', String(px));

let _tag: THREE.CanvasTexture | null = null;
/**
 * The "CREATE BUILD REPEAT" hand tag. Painted as black spray on transparent so
 * the plaster underneath keeps showing through the strokes.
 */
export function tagTexture(): THREE.CanvasTexture {
  if (_tag) return _tag;
  const W = 1024;
  const H = 428;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry32(31337);

  const ink = 'rgba(9,7,10,0.94)';
  const lines: [string, number, number, number, number][] = [
    // text, x, baseline, size, rotation
    ['CREATE', 108, 132, 122, -0.055],
    ['BUILD', 148, 250, 122, -0.05],
    ['REPEAT', 118, 368, 122, -0.045],
  ];

  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  for (const [text, x, y, size, rot] of lines) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = font(size);
    // A double pass with a hair of offset thickens the stroke the way a fat
    // marker nib does, and stops the type reading as a clean vector.
    ctx.fillText(text, 0, 0);
    ctx.fillText(text, 1.5, -1);
    // paint drips off a few letters
    const w = ctx.measureText(text).width;
    for (let i = 0; i < 4; i++) {
      const dx = rnd() * w;
      const len = 10 + rnd() * 34;
      ctx.fillRect(dx, 0, 3 + rnd() * 2, len);
      ctx.beginPath();
      ctx.arc(dx + 2, len, 2.6 + rnd() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // crown over the first word
  ctx.save();
  ctx.translate(150, 44);
  ctx.rotate(-0.08);
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.lineTo(12, 0);
  ctx.lineTo(26, 16);
  ctx.lineTo(40, 0);
  ctx.lineTo(54, 16);
  ctx.lineTo(68, 0);
  ctx.lineTo(78, 22);
  ctx.closePath();
  ctx.lineWidth = 7;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.restore();

  // scratchy asterisk / star marks scattered around the tag
  const marks: [number, number, number, string][] = [
    [72, 300, 26, ink],
    [828, 150, 34, ink],
    [880, 260, 24, ink],
    [640, 392, 22, 'rgba(120,52,190,0.8)'],
    [58, 190, 18, 'rgba(120,52,190,0.8)'],
  ];
  for (const [mx, my, r, col] of marks) {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 4.5;
    ctx.translate(mx, my);
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 4) * i + rnd() * 0.2;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.restore();
  }

  // faint violet overspray blooms
  for (let i = 0; i < 5; i++) {
    const gx = 120 + rnd() * 760;
    const gy = 60 + rnd() * 330;
    const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, 40 + rnd() * 50);
    g.addColorStop(0, 'rgba(126,58,196,0.22)');
    g.addColorStop(1, 'rgba(126,58,196,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - 100, gy - 100, 200, 200);
  }

  _tag = decal(c);
  return _tag;
}

let _poster: THREE.CanvasTexture | null = null;
/** The black studio poster on the west wall — four words, thin condensed type. */
export function posterTexture(): THREE.CanvasTexture {
  if (_poster) return _poster;
  const W = 384;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, W, H);
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.01)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.05)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(228,222,236,0.88)';
  ctx.font = '600 40px "Helvetica Neue", Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  const words = ['DISCIPLINE', 'FITNESS', 'FOCUS', 'FREEDOM'];
  words.forEach((w, i) => ctx.fillText(w, 42, 168 + i * 62));

  ctx.strokeStyle = 'rgba(183,80,255,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(42, 196 + 3 * 62);
  ctx.lineTo(150, 196 + 3 * 62);
  ctx.stroke();

  _poster = decal(c);
  return _poster;
}

/** The one bitmap in the whole room: the portrait card from the legacy hero. */
export const BADGE_PHOTO = '/images/IMG_5775.PNG';

let _badge: THREE.CanvasTexture | null = null;
/**
 * The studio ID slung over the chair back — the about card.
 *
 * Photo window, "RAHUL T D" set in the same heavy italic as the wall tag, and
 * the role scratched in underneath. Because the photo is a file rather than
 * noise, the card is drawn twice: once immediately so nothing pops in blank,
 * and again when the image lands.
 */
export function badgeTexture(): THREE.CanvasTexture {
  if (_badge) return _badge;
  const W = 512;
  const H = 768;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const tex = decal(c);

  const PAD = 40;
  const PHOTO = { x: PAD, y: 92, w: W - PAD * 2, h: 408 };
  const ink = '#1a1618';

  /** Rough, scraped lettering: several light passes plus rakes across them. */
  const scratch = (text: string, x: number, y: number, size: number, rnd: () => number) => {
    ctx.save();
    ctx.font = `700 ${size}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.15;
    for (let p = 0; p < 5; p++) {
      ctx.strokeStyle = `rgba(26,22,24,${0.18 + rnd() * 0.16})`;
      ctx.save();
      ctx.translate(x + (rnd() - 0.5) * 2.6, y + (rnd() - 0.5) * 2.2);
      ctx.rotate((rnd() - 0.5) * 0.007);
      ctx.strokeText(text, 0, 0);
      ctx.restore();
    }
    const w = ctx.measureText(text).width;
    for (let i = 0; i < 8; i++) {
      const sx = x + rnd() * w;
      const sy = y - size * (0.1 + rnd() * 0.72);
      ctx.strokeStyle = `rgba(30,24,26,${0.18 + rnd() * 0.26})`;
      ctx.lineWidth = 0.8 + rnd() * 1.1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (rnd() - 0.25) * 44, sy + (rnd() - 0.5) * 7);
      ctx.stroke();
    }
    ctx.restore();
    return w;
  };

  /** Cover-fit, biased to the top so a face is never cropped at the chin. */
  const cover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const r = Math.max(w / img.width, h / img.height);
    const sw = w / r;
    const sh = h / r;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * 0.16, sw, sh, x, y, w, h);
  };

  const draw = (photo?: HTMLImageElement) => {
    const rnd = mulberry32(90210);
    ctx.clearRect(0, 0, W, H);

    /* ---- card stock ---- */
    ctx.fillStyle = '#e9e5dc';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 3200; i++) {
      const a = rnd();
      ctx.fillStyle = a > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(120,112,104,0.16)';
      ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
    }
    // handled edges: the card is darker where thumbs have been
    const wear = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
    wear.addColorStop(0, 'rgba(90,82,76,0)');
    wear.addColorStop(1, 'rgba(90,82,76,0.22)');
    ctx.fillStyle = wear;
    ctx.fillRect(0, 0, W, H);

    /* ---- lanyard slot ---- */
    ctx.fillStyle = 'rgba(40,34,32,0.85)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 58, 30, 116, 20, 10);
    ctx.fill();

    /* ---- header ---- */
    ctx.font = '700 19px ui-monospace, "Courier New", monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(40,34,36,0.72)';
    ctx.fillText('SINCE — 2024', PAD, 82);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(183,80,255,0.95)';
    ctx.fillText('NO. 001', W - PAD, 82);
    ctx.textAlign = 'left';

    /* ---- portrait window ---- */
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, 4);
    ctx.clip();
    ctx.fillStyle = '#17151a';
    ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    if (photo) {
      // Graded a touch cool and flat so a photograph sits inside a room where
      // every other surface was generated.
      ctx.filter = 'grayscale(0.22) contrast(1.06) brightness(0.98)';
      cover(photo, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
      ctx.filter = 'none';
      const tint = ctx.createLinearGradient(PHOTO.x, PHOTO.y, PHOTO.x, PHOTO.y + PHOTO.h);
      tint.addColorStop(0, 'rgba(90,44,140,0.10)');
      tint.addColorStop(1, 'rgba(10,8,14,0.30)');
      ctx.fillStyle = tint;
      ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(40,34,36,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, 4);
    ctx.stroke();

    /* ---- name ---- */
    const NAME = 'RAHUL T D';
    let size = 72;
    ctx.font = font(size);
    while (ctx.measureText(NAME).width > PHOTO.w && size > 30) {
      size -= 2;
      ctx.font = font(size);
    }
    ctx.fillStyle = ink;
    ctx.fillText(NAME, PAD, 570);
    ctx.fillText(NAME, PAD + 1.4, 569);

    /* ---- scratched lettering under the name ---- */
    scratch('DIGITAL DESIGNER', PAD, 614, 30, rnd);
    scratch('& ART DIRECTOR', PAD, 650, 30, rnd);

    /* ---- barcode + footer ---- */
    let bx = PAD;
    ctx.fillStyle = 'rgba(26,22,24,0.88)';
    while (bx < W - PAD - 150) {
      const w = 1.5 + rnd() * 4.5;
      ctx.fillRect(bx, 678, w, 44);
      bx += w + 1.5 + rnd() * 4;
    }
    ctx.font = '700 17px ui-monospace, "Courier New", monospace';
    ctx.fillStyle = 'rgba(40,34,36,0.66)';
    ctx.textAlign = 'right';
    ctx.fillText('ALL AREAS', W - PAD, 700);
    ctx.fillText('STUDIO ACCESS', W - PAD, 722);
    ctx.textAlign = 'left';

    /* ---- wear over the top of everything ---- */
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.1 + rnd() * 0.2})`;
      ctx.lineWidth = 0.7 + rnd();
      const sx = rnd() * W;
      const sy = rnd() * H;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (rnd() - 0.5) * 120, sy + (rnd() - 0.5) * 40);
      ctx.stroke();
    }
  };

  draw();

  const img = new Image();
  img.onload = () => {
    draw(img);
    tex.needsUpdate = true;
  };
  img.src = BADGE_PHOTO;

  _badge = tex;
  return tex;
}

let _screen: THREE.CanvasTexture | null = null;
/**
 * The editing suite on the ultrawide: dark chrome, a graded preview, a scrub
 * bar and a stack of coloured clips over an audio waveform.
 */
export function screenTexture(): THREE.CanvasTexture {
  if (_screen) return _screen;
  const W = 1536;
  const H = 640;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry32(4242);

  ctx.fillStyle = '#101218';
  ctx.fillRect(0, 0, W, H);

  // --- top chrome ----------------------------------------------------
  ctx.fillStyle = '#171a22';
  ctx.fillRect(0, 0, W, 26);
  ctx.fillStyle = '#3f4552';
  for (let i = 0; i < 7; i++) ctx.fillRect(20 + i * 62, 9, 44, 8);

  // --- left bin panel ------------------------------------------------
  ctx.fillStyle = '#151821';
  ctx.fillRect(0, 26, 300, 330);
  ctx.fillStyle = '#232838';
  for (let r = 0; r < 5; r++)
    for (let col = 0; col < 3; col++) ctx.fillRect(16 + col * 94, 44 + r * 62, 82, 48);
  ctx.fillStyle = '#59627a';
  for (let r = 0; r < 5; r++)
    for (let col = 0; col < 3; col++) ctx.fillRect(16 + col * 94, 96 + r * 62, 54, 5);

  // --- programme monitor ---------------------------------------------
  const px = 312;
  const py = 34;
  const pw = 700;
  const ph = 314;
  const sky = ctx.createLinearGradient(0, py, 0, py + ph);
  sky.addColorStop(0, '#120b22');
  sky.addColorStop(0.42, '#4a1f52');
  sky.addColorStop(0.62, '#b8484a');
  sky.addColorStop(0.78, '#e8873f');
  sky.addColorStop(1, '#1a1220');
  ctx.fillStyle = sky;
  ctx.fillRect(px, py, pw, ph);
  // a lone rider silhouette on a road, vanishing-point framing
  ctx.fillStyle = 'rgba(10,7,14,0.92)';
  ctx.beginPath();
  ctx.moveTo(px, py + ph);
  ctx.lineTo(px + pw * 0.42, py + ph * 0.66);
  ctx.lineTo(px + pw * 0.58, py + ph * 0.66);
  ctx.lineTo(px + pw, py + ph);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,170,0.5)';
  ctx.fillRect(px + pw * 0.497, py + ph * 0.68, 6, ph * 0.32);
  ctx.fillStyle = '#07060a';
  ctx.beginPath();
  ctx.ellipse(px + pw * 0.5, py + ph * 0.71, 16, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  // scopes overlay in the corner
  ctx.strokeStyle = 'rgba(120,220,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + pw - 118, py + 12, 104, 74);

  // --- right inspector ------------------------------------------------
  ctx.fillStyle = '#151821';
  ctx.fillRect(1024, 26, W - 1024, 330);
  ctx.fillStyle = '#2b3142';
  for (let i = 0; i < 9; i++) ctx.fillRect(1046, 52 + i * 34, 460, 20);
  ctx.fillStyle = '#7fd6ff';
  for (let i = 0; i < 9; i++) ctx.fillRect(1046, 52 + i * 34, 40 + rnd() * 340, 20);

  // --- timeline -------------------------------------------------------
  ctx.fillStyle = '#0c0e14';
  ctx.fillRect(0, 360, W, H - 360);
  ctx.strokeStyle = '#232735';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 40, 372);
    ctx.lineTo(i * 40, H);
    ctx.stroke();
  }

  const clipColors = ['#28c8d8', '#c94fd8', '#3f8ae0', '#d8a13f', '#4fd88a'];
  let x = 26;
  for (let row = 0; row < 3; row++) {
    x = 26 + row * 40;
    const y = 392 + row * 46;
    while (x < W - 40) {
      const w = 60 + rnd() * 190;
      ctx.fillStyle = clipColors[Math.floor(rnd() * clipColors.length)];
      ctx.globalAlpha = 0.82;
      ctx.fillRect(x, y, w, 36);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(6,8,12,0.55)';
      ctx.fillRect(x, y, w, 9);
      x += w + 6;
    }
  }
  // audio track with a waveform
  ctx.fillStyle = '#1c6f4a';
  ctx.fillRect(26, 534, W - 60, 52);
  ctx.fillStyle = '#54e6a0';
  for (let i = 0; i < (W - 60) / 3; i++) {
    const a = (0.25 + 0.75 * Math.abs(Math.sin(i * 0.21) * Math.sin(i * 0.037))) * 22;
    ctx.fillRect(28 + i * 3, 560 - a, 2, a * 2);
  }
  // playhead
  ctx.fillStyle = '#ff5470';
  ctx.fillRect(548, 372, 2.5, H - 372);
  ctx.beginPath();
  ctx.moveTo(538, 372);
  ctx.lineTo(560, 372);
  ctx.lineTo(549, 388);
  ctx.closePath();
  ctx.fill();

  _screen = decal(c);
  return _screen;
}

let _deck: THREE.CanvasTexture | null = null;
/** Skate deck bottom graphic — dark base under a violet/magenta spray collage. */
export function deckTexture(): THREE.CanvasTexture {
  if (_deck) return _deck;
  const W = 256;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry32(5150);

  ctx.fillStyle = '#100c16';
  ctx.fillRect(0, 0, W, H);

  // spray blooms
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const y = 60 + rnd() * (H - 120);
    const r = 24 + rnd() * 80;
    const hue = rnd() > 0.5 ? [188, 62, 226] : [232, 70, 132];
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},${0.3 + rnd() * 0.35})`);
    g.addColorStop(1, `rgba(${hue[0]},${hue[1]},${hue[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // scratched linework
  ctx.strokeStyle = 'rgba(228,220,240,0.55)';
  for (let i = 0; i < 30; i++) {
    ctx.lineWidth = 1 + rnd() * 2.4;
    ctx.beginPath();
    const x = rnd() * W;
    const y = rnd() * H;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 90, y + (rnd() - 0.5) * 160);
    ctx.stroke();
  }
  // a big glyph down the middle
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(12,8,16,0.86)';
  ctx.font = font(150);
  ctx.textAlign = 'center';
  ctx.fillText('RIDE', 0, 46);
  ctx.restore();
  // grip-tape band at each end
  ctx.fillStyle = 'rgba(8,8,10,0.75)';
  ctx.fillRect(0, 0, W, 70);
  ctx.fillRect(0, H - 70, W, 70);

  _deck = decal(c);
  return _deck;
}

let _pcScreen: THREE.CanvasTexture | null = null;
/** Tiny status readout on the PC tower's side glass. */
export function towerGlowTexture(): THREE.CanvasTexture {
  if (_pcScreen) return _pcScreen;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry32(818);
  ctx.fillStyle = '#0a0410';
  ctx.fillRect(0, 0, S, S);
  // fan rings + a cluster of RGB-lit heatsink fins
  for (const [cx, cy, r] of [
    [78, 78, 46],
    [78, 180, 46],
  ] as const) {
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, 'rgba(215,120,255,0.95)');
    g.addColorStop(0.6, 'rgba(120,60,220,0.6)');
    g.addColorStop(1, 'rgba(30,10,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(90,200,255,0.8)';
  for (let i = 0; i < 16; i++) ctx.fillRect(150, 40 + i * 11, 80, 5 + rnd() * 2);
  _pcScreen = decal(c);
  return _pcScreen;
}

