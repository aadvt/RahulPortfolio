import * as THREE from 'three';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      const paletteValue = clamp01(
        0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
      );
      const color = mixPalette(colors, paletteValue);
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : new THREE.Color(typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F'),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Wardrobe
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createWardrobeModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Wardrobe";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["phantom"] = createSculptMaterial(
    "phantom",
    {"id": "phantom", "name": "Hidden anchor", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#000000", "color": "#000000", "albedo": {"dominant": "#000000", "secondary": ["#000000"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#000000", "#000000"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 1.0, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["wood"] = createSculptMaterial(
    "wood",
    {"id": "wood", "name": "Dark oak", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#4f3622", "color": "#4f3622", "albedo": {"dominant": "#4f3622", "secondary": ["#5e4029", "#3a2718"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#4f3622", "#5e4029", "#3a2718"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.7, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["woodback"] = createSculptMaterial(
    "woodback",
    {"id": "woodback", "name": "Back panel", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#241a12", "color": "#241a12", "albedo": {"dominant": "#241a12", "secondary": ["#241a12"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#241a12", "#241a12"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.85, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["chrome"] = createSculptMaterial(
    "chrome",
    {"id": "chrome", "name": "Chrome rod", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#c8ccd2", "color": "#c8ccd2", "albedo": {"dominant": "#c8ccd2", "secondary": ["#c8ccd2"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#c8ccd2", "#c8ccd2"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.25, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.8, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["led"] = createSculptMaterial(
    "led",
    {"id": "led", "name": "Warm LED", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#ffb454", "color": "#ffb454", "albedo": {"dominant": "#ffb454", "secondary": ["#ffb454"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#ffb454", "#ffb454"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.5, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["nike"] = createSculptMaterial(
    "nike",
    {"id": "nike", "name": "Nike box", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#e8632a", "color": "#e8632a", "albedo": {"dominant": "#e8632a", "secondary": ["#e8632a"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#e8632a", "#e8632a"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.55, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["whitebox"] = createSculptMaterial(
    "whitebox",
    {"id": "whitebox", "name": "White box", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#e8e4dc", "color": "#e8e4dc", "albedo": {"dominant": "#e8e4dc", "secondary": ["#e8e4dc"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#e8e4dc", "#e8e4dc"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.55, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["greybox"] = createSculptMaterial(
    "greybox",
    {"id": "greybox", "name": "Grey box", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#2f2f36", "color": "#2f2f36", "albedo": {"dominant": "#2f2f36", "secondary": ["#2f2f36"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#2f2f36", "#2f2f36"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.7, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["ball"] = createSculptMaterial(
    "ball",
    {"id": "ball", "name": "Basketball", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#c2410c", "color": "#c2410c", "albedo": {"dominant": "#c2410c", "secondary": ["#a8380e"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#c2410c", "#a8380e"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.75, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["plastic"] = createSculptMaterial(
    "plastic",
    {"id": "plastic", "name": "Black plastic", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#18181c", "color": "#18181c", "albedo": {"dominant": "#18181c", "secondary": ["#18181c"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#18181c", "#18181c"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.5, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["blackmetal"] = createSculptMaterial(
    "blackmetal",
    {"id": "blackmetal", "name": "Black metal", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#1a1a1e", "color": "#1a1a1e", "albedo": {"dominant": "#1a1a1e", "secondary": ["#1a1a1e"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#1a1a1e", "#1a1a1e"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.4, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.6, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["records"] = createSculptMaterial(
    "records",
    {"id": "records", "name": "Vinyl stack", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#161618", "color": "#161618", "albedo": {"dominant": "#161618", "secondary": ["#161618"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#161618", "#161618"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.7, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["bin"] = createSculptMaterial(
    "bin",
    {"id": "bin", "name": "Storage bin", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#26262c", "color": "#26262c", "albedo": {"dominant": "#26262c", "secondary": ["#26262c"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#26262c", "#26262c"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.8, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["pot"] = createSculptMaterial(
    "pot",
    {"id": "pot", "name": "Pot", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#7a5236", "color": "#7a5236", "albedo": {"dominant": "#7a5236", "secondary": ["#7a5236"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#7a5236", "#7a5236"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.8, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["green"] = createSculptMaterial(
    "green",
    {"id": "green", "name": "Foliage", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#2f6b45", "color": "#2f6b45", "albedo": {"dominant": "#2f6b45", "secondary": ["#3a8055"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#2f6b45", "#3a8055"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.8, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["trophy"] = createSculptMaterial(
    "trophy",
    {"id": "trophy", "name": "Trophy", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#2a2a30", "color": "#2a2a30", "albedo": {"dominant": "#2a2a30", "secondary": ["#2a2a30"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#2a2a30", "#2a2a30"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.4, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.5, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["rubik"] = createSculptMaterial(
    "rubik",
    {"id": "rubik", "name": "Rubik cube", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#e0b64a", "color": "#e0b64a", "albedo": {"dominant": "#e0b64a", "secondary": ["#c0392b", "#2e7d32"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#e0b64a", "#c0392b", "#2e7d32"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.5, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["cloth_grey"] = createSculptMaterial(
    "cloth_grey",
    {"id": "cloth_grey", "name": "Grey hoodie", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#5a5a62", "color": "#5a5a62", "albedo": {"dominant": "#5a5a62", "secondary": ["#5a5a62"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#5a5a62", "#5a5a62"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.9, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["cloth_red"] = createSculptMaterial(
    "cloth_red",
    {"id": "cloth_red", "name": "Red hoodie", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#8f2a2a", "color": "#8f2a2a", "albedo": {"dominant": "#8f2a2a", "secondary": ["#8f2a2a"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#8f2a2a", "#8f2a2a"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.9, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["cloth_grey2"] = createSculptMaterial(
    "cloth_grey2",
    {"id": "cloth_grey2", "name": "Light grey hoodie", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#7a7a82", "color": "#7a7a82", "albedo": {"dominant": "#7a7a82", "secondary": ["#7a7a82"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#7a7a82", "#7a7a82"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.9, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["cloth_plaid"] = createSculptMaterial(
    "cloth_plaid",
    {"id": "cloth_plaid", "name": "Plaid shirt", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#7a3b3b", "color": "#7a3b3b", "albedo": {"dominant": "#7a3b3b", "secondary": ["#d9d4cc"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#7a3b3b", "#d9d4cc"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.9, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["cloth_brown"] = createSculptMaterial(
    "cloth_brown",
    {"id": "cloth_brown", "name": "Brown jacket", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#4a3a2a", "color": "#4a3a2a", "albedo": {"dominant": "#4a3a2a", "secondary": ["#4a3a2a"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#4a3a2a", "#4a3a2a"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.9, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["cloth_dark"] = createSculptMaterial(
    "cloth_dark",
    {"id": "cloth_dark", "name": "Dark jacket", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#2f2f36", "color": "#2f2f36", "albedo": {"dominant": "#2f2f36", "secondary": ["#2f2f36"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#2f2f36", "#2f2f36"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.9, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Anchor__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
    node_root_0.scale.set(1.0, 1.0, 1.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Anchor", "level": "macro", "role": "body", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "phantom"};
  node_root_0.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["phantom"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Anchor";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Anchor", "level": "macro", "role": "body", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "phantom"};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {};

  const attachment_back_1 = null;
  const endpoint_back_1 = makeAttachmentEndpoint(attachment_back_1);
  const node_back_1 = new THREE.Group();
  node_back_1.name = "Back panel__pivot";
  if (endpoint_back_1) {
    node_back_1.position.copy(endpoint_back_1.start);
    node_back_1.rotation.set(0, 0, 0);
    node_back_1.scale.set(1, 1, 1);
  } else {
    node_back_1.position.set(0.0, 2.0, -0.6);
    node_back_1.rotation.set(0.0, 0.0, 0.0);
    node_back_1.scale.set(2.4, 4.0, 0.1);
  }
  node_back_1.userData.sculptComponent = {"id": "back", "name": "Back panel", "level": "macro", "role": "body", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 2.4, "height": 4.0, "depth": 0.1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 2.0, -0.6], "rotation": [0, 0, 0]}, "material": "woodback"};
  node_back_1.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_back_1);
  nodes["back"] = node_back_1;
  const mesh_back_1Geometry = endpoint_back_1
    ? new THREE.CylinderGeometry(endpoint_back_1.endRadius, endpoint_back_1.baseRadius, endpoint_back_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_back_1 = new THREE.Mesh(
    mesh_back_1Geometry,
    materialMap["woodback"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_back_1.name = "Back panel";
  if (endpoint_back_1) {
    mesh_back_1.position.copy(endpoint_back_1.midpoint);
    mesh_back_1.quaternion.copy(endpoint_back_1.quaternion);
  }
  mesh_back_1.castShadow = options.castShadow ?? true;
  mesh_back_1.receiveShadow = options.receiveShadow ?? true;
  mesh_back_1.userData.sculptComponent = {"id": "back", "name": "Back panel", "level": "macro", "role": "body", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 2.4, "height": 4.0, "depth": 0.1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 2.0, -0.6], "rotation": [0, 0, 0]}, "material": "woodback"};
  node_back_1.add(mesh_back_1);
  meshes["back"] = mesh_back_1;
  colliders["back"] = {};

  const attachment_side_l_2 = null;
  const endpoint_side_l_2 = makeAttachmentEndpoint(attachment_side_l_2);
  const node_side_l_2 = new THREE.Group();
  node_side_l_2.name = "Side left__pivot";
  if (endpoint_side_l_2) {
    node_side_l_2.position.copy(endpoint_side_l_2.start);
    node_side_l_2.rotation.set(0, 0, 0);
    node_side_l_2.scale.set(1, 1, 1);
  } else {
    node_side_l_2.position.set(-1.2, 2.0, 0.0);
    node_side_l_2.rotation.set(0.0, 0.0, 0.0);
    node_side_l_2.scale.set(0.15, 4.0, 1.4);
  }
  node_side_l_2.userData.sculptComponent = {"id": "side_l", "name": "Side left", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.15, "height": 4.0, "depth": 1.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.2, 2.0, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_side_l_2.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_side_l_2);
  nodes["side_l"] = node_side_l_2;
  const mesh_side_l_2Geometry = endpoint_side_l_2
    ? new THREE.CylinderGeometry(endpoint_side_l_2.endRadius, endpoint_side_l_2.baseRadius, endpoint_side_l_2.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_side_l_2 = new THREE.Mesh(
    mesh_side_l_2Geometry,
    materialMap["wood"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_side_l_2.name = "Side left";
  if (endpoint_side_l_2) {
    mesh_side_l_2.position.copy(endpoint_side_l_2.midpoint);
    mesh_side_l_2.quaternion.copy(endpoint_side_l_2.quaternion);
  }
  mesh_side_l_2.castShadow = options.castShadow ?? true;
  mesh_side_l_2.receiveShadow = options.receiveShadow ?? true;
  mesh_side_l_2.userData.sculptComponent = {"id": "side_l", "name": "Side left", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.15, "height": 4.0, "depth": 1.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.2, 2.0, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_side_l_2.add(mesh_side_l_2);
  meshes["side_l"] = mesh_side_l_2;
  colliders["side_l"] = {};

  const attachment_side_r_3 = null;
  const endpoint_side_r_3 = makeAttachmentEndpoint(attachment_side_r_3);
  const node_side_r_3 = new THREE.Group();
  node_side_r_3.name = "Side right__pivot";
  if (endpoint_side_r_3) {
    node_side_r_3.position.copy(endpoint_side_r_3.start);
    node_side_r_3.rotation.set(0, 0, 0);
    node_side_r_3.scale.set(1, 1, 1);
  } else {
    node_side_r_3.position.set(1.2, 2.0, 0.0);
    node_side_r_3.rotation.set(0.0, 0.0, 0.0);
    node_side_r_3.scale.set(0.15, 4.0, 1.4);
  }
  node_side_r_3.userData.sculptComponent = {"id": "side_r", "name": "Side right", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.15, "height": 4.0, "depth": 1.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.2, 2.0, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_side_r_3.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_side_r_3);
  nodes["side_r"] = node_side_r_3;
  const mesh_side_r_3Geometry = endpoint_side_r_3
    ? new THREE.CylinderGeometry(endpoint_side_r_3.endRadius, endpoint_side_r_3.baseRadius, endpoint_side_r_3.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_side_r_3 = new THREE.Mesh(
    mesh_side_r_3Geometry,
    materialMap["wood"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_side_r_3.name = "Side right";
  if (endpoint_side_r_3) {
    mesh_side_r_3.position.copy(endpoint_side_r_3.midpoint);
    mesh_side_r_3.quaternion.copy(endpoint_side_r_3.quaternion);
  }
  mesh_side_r_3.castShadow = options.castShadow ?? true;
  mesh_side_r_3.receiveShadow = options.receiveShadow ?? true;
  mesh_side_r_3.userData.sculptComponent = {"id": "side_r", "name": "Side right", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.15, "height": 4.0, "depth": 1.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.2, 2.0, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_side_r_3.add(mesh_side_r_3);
  meshes["side_r"] = mesh_side_r_3;
  colliders["side_r"] = {};

  const attachment_top_4 = null;
  const endpoint_top_4 = makeAttachmentEndpoint(attachment_top_4);
  const node_top_4 = new THREE.Group();
  node_top_4.name = "Top__pivot";
  if (endpoint_top_4) {
    node_top_4.position.copy(endpoint_top_4.start);
    node_top_4.rotation.set(0, 0, 0);
    node_top_4.scale.set(1, 1, 1);
  } else {
    node_top_4.position.set(0.0, 3.95, 0.0);
    node_top_4.rotation.set(0.0, 0.0, 0.0);
    node_top_4.scale.set(2.4, 0.15, 1.4);
  }
  node_top_4.userData.sculptComponent = {"id": "top", "name": "Top", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 2.4, "height": 0.15, "depth": 1.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 3.95, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_top_4.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_top_4);
  nodes["top"] = node_top_4;
  const mesh_top_4Geometry = endpoint_top_4
    ? new THREE.CylinderGeometry(endpoint_top_4.endRadius, endpoint_top_4.baseRadius, endpoint_top_4.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_top_4 = new THREE.Mesh(
    mesh_top_4Geometry,
    materialMap["wood"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_top_4.name = "Top";
  if (endpoint_top_4) {
    mesh_top_4.position.copy(endpoint_top_4.midpoint);
    mesh_top_4.quaternion.copy(endpoint_top_4.quaternion);
  }
  mesh_top_4.castShadow = options.castShadow ?? true;
  mesh_top_4.receiveShadow = options.receiveShadow ?? true;
  mesh_top_4.userData.sculptComponent = {"id": "top", "name": "Top", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 2.4, "height": 0.15, "depth": 1.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 3.95, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_top_4.add(mesh_top_4);
  meshes["top"] = mesh_top_4;
  colliders["top"] = {};

  const attachment_bottom_5 = null;
  const endpoint_bottom_5 = makeAttachmentEndpoint(attachment_bottom_5);
  const node_bottom_5 = new THREE.Group();
  node_bottom_5.name = "Bottom__pivot";
  if (endpoint_bottom_5) {
    node_bottom_5.position.copy(endpoint_bottom_5.start);
    node_bottom_5.rotation.set(0, 0, 0);
    node_bottom_5.scale.set(1, 1, 1);
  } else {
    node_bottom_5.position.set(0.0, 0.05, 0.0);
    node_bottom_5.rotation.set(0.0, 0.0, 0.0);
    node_bottom_5.scale.set(2.4, 0.15, 1.4);
  }
  node_bottom_5.userData.sculptComponent = {"id": "bottom", "name": "Bottom", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 2.4, "height": 0.15, "depth": 1.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.05, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_bottom_5.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_bottom_5);
  nodes["bottom"] = node_bottom_5;
  const mesh_bottom_5Geometry = endpoint_bottom_5
    ? new THREE.CylinderGeometry(endpoint_bottom_5.endRadius, endpoint_bottom_5.baseRadius, endpoint_bottom_5.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_bottom_5 = new THREE.Mesh(
    mesh_bottom_5Geometry,
    materialMap["wood"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bottom_5.name = "Bottom";
  if (endpoint_bottom_5) {
    mesh_bottom_5.position.copy(endpoint_bottom_5.midpoint);
    mesh_bottom_5.quaternion.copy(endpoint_bottom_5.quaternion);
  }
  mesh_bottom_5.castShadow = options.castShadow ?? true;
  mesh_bottom_5.receiveShadow = options.receiveShadow ?? true;
  mesh_bottom_5.userData.sculptComponent = {"id": "bottom", "name": "Bottom", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 2.4, "height": 0.15, "depth": 1.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.05, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_bottom_5.add(mesh_bottom_5);
  meshes["bottom"] = mesh_bottom_5;
  colliders["bottom"] = {};

  const attachment_divider_6 = null;
  const endpoint_divider_6 = makeAttachmentEndpoint(attachment_divider_6);
  const node_divider_6 = new THREE.Group();
  node_divider_6.name = "Divider__pivot";
  if (endpoint_divider_6) {
    node_divider_6.position.copy(endpoint_divider_6.start);
    node_divider_6.rotation.set(0, 0, 0);
    node_divider_6.scale.set(1, 1, 1);
  } else {
    node_divider_6.position.set(0.15, 2.0, 0.0);
    node_divider_6.rotation.set(0.0, 0.0, 0.0);
    node_divider_6.scale.set(0.1, 3.8, 1.3);
  }
  node_divider_6.userData.sculptComponent = {"id": "divider", "name": "Divider", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.1, "height": 3.8, "depth": 1.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.15, 2.0, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_divider_6.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_divider_6);
  nodes["divider"] = node_divider_6;
  const mesh_divider_6Geometry = endpoint_divider_6
    ? new THREE.CylinderGeometry(endpoint_divider_6.endRadius, endpoint_divider_6.baseRadius, endpoint_divider_6.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_divider_6 = new THREE.Mesh(
    mesh_divider_6Geometry,
    materialMap["wood"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_divider_6.name = "Divider";
  if (endpoint_divider_6) {
    mesh_divider_6.position.copy(endpoint_divider_6.midpoint);
    mesh_divider_6.quaternion.copy(endpoint_divider_6.quaternion);
  }
  mesh_divider_6.castShadow = options.castShadow ?? true;
  mesh_divider_6.receiveShadow = options.receiveShadow ?? true;
  mesh_divider_6.userData.sculptComponent = {"id": "divider", "name": "Divider", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.1, "height": 3.8, "depth": 1.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.15, 2.0, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_divider_6.add(mesh_divider_6);
  meshes["divider"] = mesh_divider_6;
  colliders["divider"] = {};

  const attachment_rod_7 = null;
  const endpoint_rod_7 = makeAttachmentEndpoint(attachment_rod_7);
  const node_rod_7 = new THREE.Group();
  node_rod_7.name = "Hanging rod__pivot";
  if (endpoint_rod_7) {
    node_rod_7.position.copy(endpoint_rod_7.start);
    node_rod_7.rotation.set(0, 0, 0);
    node_rod_7.scale.set(1, 1, 1);
  } else {
    node_rod_7.position.set(-0.55, 2.7, 0.0);
    node_rod_7.rotation.set(0.0, 0.0, 1.5708);
    node_rod_7.scale.set(0.05, 1.3, 0.05);
  }
  node_rod_7.userData.sculptComponent = {"id": "rod", "name": "Hanging rod", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.05, "height": 1.3, "depth": 0.05, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.55, 2.7, 0], "rotation": [0, 0, 1.5708]}, "material": "chrome"};
  node_rod_7.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_rod_7);
  nodes["rod"] = node_rod_7;
  const mesh_rod_7Geometry = endpoint_rod_7
    ? new THREE.CylinderGeometry(endpoint_rod_7.endRadius, endpoint_rod_7.baseRadius, endpoint_rod_7.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_rod_7 = new THREE.Mesh(
    mesh_rod_7Geometry,
    materialMap["chrome"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rod_7.name = "Hanging rod";
  if (endpoint_rod_7) {
    mesh_rod_7.position.copy(endpoint_rod_7.midpoint);
    mesh_rod_7.quaternion.copy(endpoint_rod_7.quaternion);
  }
  mesh_rod_7.castShadow = options.castShadow ?? true;
  mesh_rod_7.receiveShadow = options.receiveShadow ?? true;
  mesh_rod_7.userData.sculptComponent = {"id": "rod", "name": "Hanging rod", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.05, "height": 1.3, "depth": 0.05, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.55, 2.7, 0], "rotation": [0, 0, 1.5708]}, "material": "chrome"};
  node_rod_7.add(mesh_rod_7);
  meshes["rod"] = mesh_rod_7;
  colliders["rod"] = {};

  const attachment_led_8 = null;
  const endpoint_led_8 = makeAttachmentEndpoint(attachment_led_8);
  const node_led_8 = new THREE.Group();
  node_led_8.name = "LED underglow__pivot";
  if (endpoint_led_8) {
    node_led_8.position.copy(endpoint_led_8.start);
    node_led_8.rotation.set(0, 0, 0);
    node_led_8.scale.set(1, 1, 1);
  } else {
    node_led_8.position.set(-0.55, 2.55, 0.5);
    node_led_8.rotation.set(0.0, 0.0, 0.0);
    node_led_8.scale.set(1.3, 0.06, 0.06);
  }
  node_led_8.userData.sculptComponent = {"id": "led", "name": "LED underglow", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.3, "height": 0.06, "depth": 0.06, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.55, 2.55, 0.5], "rotation": [0, 0, 0]}, "material": "led"};
  node_led_8.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_led_8);
  nodes["led"] = node_led_8;
  const mesh_led_8Geometry = endpoint_led_8
    ? new THREE.CylinderGeometry(endpoint_led_8.endRadius, endpoint_led_8.baseRadius, endpoint_led_8.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_led_8 = new THREE.Mesh(
    mesh_led_8Geometry,
    materialMap["led"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_led_8.name = "LED underglow";
  if (endpoint_led_8) {
    mesh_led_8.position.copy(endpoint_led_8.midpoint);
    mesh_led_8.quaternion.copy(endpoint_led_8.quaternion);
  }
  mesh_led_8.castShadow = options.castShadow ?? true;
  mesh_led_8.receiveShadow = options.receiveShadow ?? true;
  mesh_led_8.userData.sculptComponent = {"id": "led", "name": "LED underglow", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.3, "height": 0.06, "depth": 0.06, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.55, 2.55, 0.5], "rotation": [0, 0, 0]}, "material": "led"};
  node_led_8.add(mesh_led_8);
  meshes["led"] = mesh_led_8;
  colliders["led"] = {};

  const attachment_shelf_top_9 = null;
  const endpoint_shelf_top_9 = makeAttachmentEndpoint(attachment_shelf_top_9);
  const node_shelf_top_9 = new THREE.Group();
  node_shelf_top_9.name = "Top-left shelf__pivot";
  if (endpoint_shelf_top_9) {
    node_shelf_top_9.position.copy(endpoint_shelf_top_9.start);
    node_shelf_top_9.rotation.set(0, 0, 0);
    node_shelf_top_9.scale.set(1, 1, 1);
  } else {
    node_shelf_top_9.position.set(-0.5, 3.15, 0.0);
    node_shelf_top_9.rotation.set(0.0, 0.0, 0.0);
    node_shelf_top_9.scale.set(1.3, 0.1, 1.3);
  }
  node_shelf_top_9.userData.sculptComponent = {"id": "shelf_top", "name": "Top-left shelf", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.3, "height": 0.1, "depth": 1.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.5, 3.15, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_shelf_top_9.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_shelf_top_9);
  nodes["shelf_top"] = node_shelf_top_9;
  const mesh_shelf_top_9Geometry = endpoint_shelf_top_9
    ? new THREE.CylinderGeometry(endpoint_shelf_top_9.endRadius, endpoint_shelf_top_9.baseRadius, endpoint_shelf_top_9.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_shelf_top_9 = new THREE.Mesh(
    mesh_shelf_top_9Geometry,
    materialMap["wood"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shelf_top_9.name = "Top-left shelf";
  if (endpoint_shelf_top_9) {
    mesh_shelf_top_9.position.copy(endpoint_shelf_top_9.midpoint);
    mesh_shelf_top_9.quaternion.copy(endpoint_shelf_top_9.quaternion);
  }
  mesh_shelf_top_9.castShadow = options.castShadow ?? true;
  mesh_shelf_top_9.receiveShadow = options.receiveShadow ?? true;
  mesh_shelf_top_9.userData.sculptComponent = {"id": "shelf_top", "name": "Top-left shelf", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.3, "height": 0.1, "depth": 1.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.5, 3.15, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_shelf_top_9.add(mesh_shelf_top_9);
  meshes["shelf_top"] = mesh_shelf_top_9;
  colliders["shelf_top"] = {};

  const attachment_shelf1_10 = null;
  const endpoint_shelf1_10 = makeAttachmentEndpoint(attachment_shelf1_10);
  const node_shelf1_10 = new THREE.Group();
  node_shelf1_10.name = "Right shelf 1__pivot";
  if (endpoint_shelf1_10) {
    node_shelf1_10.position.copy(endpoint_shelf1_10.start);
    node_shelf1_10.rotation.set(0, 0, 0);
    node_shelf1_10.scale.set(1, 1, 1);
  } else {
    node_shelf1_10.position.set(0.65, 3.0, 0.0);
    node_shelf1_10.rotation.set(0.0, 0.0, 0.0);
    node_shelf1_10.scale.set(1.0, 0.1, 1.3);
  }
  node_shelf1_10.userData.sculptComponent = {"id": "shelf1", "name": "Right shelf 1", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.1, "depth": 1.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.65, 3.0, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_shelf1_10.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_shelf1_10);
  nodes["shelf1"] = node_shelf1_10;
  const mesh_shelf1_10Geometry = endpoint_shelf1_10
    ? new THREE.CylinderGeometry(endpoint_shelf1_10.endRadius, endpoint_shelf1_10.baseRadius, endpoint_shelf1_10.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_shelf1_10 = new THREE.Mesh(
    mesh_shelf1_10Geometry,
    materialMap["wood"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shelf1_10.name = "Right shelf 1";
  if (endpoint_shelf1_10) {
    mesh_shelf1_10.position.copy(endpoint_shelf1_10.midpoint);
    mesh_shelf1_10.quaternion.copy(endpoint_shelf1_10.quaternion);
  }
  mesh_shelf1_10.castShadow = options.castShadow ?? true;
  mesh_shelf1_10.receiveShadow = options.receiveShadow ?? true;
  mesh_shelf1_10.userData.sculptComponent = {"id": "shelf1", "name": "Right shelf 1", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.1, "depth": 1.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.65, 3.0, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_shelf1_10.add(mesh_shelf1_10);
  meshes["shelf1"] = mesh_shelf1_10;
  colliders["shelf1"] = {};

  const attachment_shelf2_11 = null;
  const endpoint_shelf2_11 = makeAttachmentEndpoint(attachment_shelf2_11);
  const node_shelf2_11 = new THREE.Group();
  node_shelf2_11.name = "Right shelf 2__pivot";
  if (endpoint_shelf2_11) {
    node_shelf2_11.position.copy(endpoint_shelf2_11.start);
    node_shelf2_11.rotation.set(0, 0, 0);
    node_shelf2_11.scale.set(1, 1, 1);
  } else {
    node_shelf2_11.position.set(0.65, 2.1, 0.0);
    node_shelf2_11.rotation.set(0.0, 0.0, 0.0);
    node_shelf2_11.scale.set(1.0, 0.1, 1.3);
  }
  node_shelf2_11.userData.sculptComponent = {"id": "shelf2", "name": "Right shelf 2", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.1, "depth": 1.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.65, 2.1, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_shelf2_11.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_shelf2_11);
  nodes["shelf2"] = node_shelf2_11;
  const mesh_shelf2_11Geometry = endpoint_shelf2_11
    ? new THREE.CylinderGeometry(endpoint_shelf2_11.endRadius, endpoint_shelf2_11.baseRadius, endpoint_shelf2_11.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_shelf2_11 = new THREE.Mesh(
    mesh_shelf2_11Geometry,
    materialMap["wood"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shelf2_11.name = "Right shelf 2";
  if (endpoint_shelf2_11) {
    mesh_shelf2_11.position.copy(endpoint_shelf2_11.midpoint);
    mesh_shelf2_11.quaternion.copy(endpoint_shelf2_11.quaternion);
  }
  mesh_shelf2_11.castShadow = options.castShadow ?? true;
  mesh_shelf2_11.receiveShadow = options.receiveShadow ?? true;
  mesh_shelf2_11.userData.sculptComponent = {"id": "shelf2", "name": "Right shelf 2", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.1, "depth": 1.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.65, 2.1, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_shelf2_11.add(mesh_shelf2_11);
  meshes["shelf2"] = mesh_shelf2_11;
  colliders["shelf2"] = {};

  const attachment_shelf3_12 = null;
  const endpoint_shelf3_12 = makeAttachmentEndpoint(attachment_shelf3_12);
  const node_shelf3_12 = new THREE.Group();
  node_shelf3_12.name = "Right shelf 3__pivot";
  if (endpoint_shelf3_12) {
    node_shelf3_12.position.copy(endpoint_shelf3_12.start);
    node_shelf3_12.rotation.set(0, 0, 0);
    node_shelf3_12.scale.set(1, 1, 1);
  } else {
    node_shelf3_12.position.set(0.65, 1.2, 0.0);
    node_shelf3_12.rotation.set(0.0, 0.0, 0.0);
    node_shelf3_12.scale.set(1.0, 0.1, 1.3);
  }
  node_shelf3_12.userData.sculptComponent = {"id": "shelf3", "name": "Right shelf 3", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.1, "depth": 1.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.65, 1.2, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_shelf3_12.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_shelf3_12);
  nodes["shelf3"] = node_shelf3_12;
  const mesh_shelf3_12Geometry = endpoint_shelf3_12
    ? new THREE.CylinderGeometry(endpoint_shelf3_12.endRadius, endpoint_shelf3_12.baseRadius, endpoint_shelf3_12.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_shelf3_12 = new THREE.Mesh(
    mesh_shelf3_12Geometry,
    materialMap["wood"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shelf3_12.name = "Right shelf 3";
  if (endpoint_shelf3_12) {
    mesh_shelf3_12.position.copy(endpoint_shelf3_12.midpoint);
    mesh_shelf3_12.quaternion.copy(endpoint_shelf3_12.quaternion);
  }
  mesh_shelf3_12.castShadow = options.castShadow ?? true;
  mesh_shelf3_12.receiveShadow = options.receiveShadow ?? true;
  mesh_shelf3_12.userData.sculptComponent = {"id": "shelf3", "name": "Right shelf 3", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.1, "depth": 1.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.65, 1.2, 0], "rotation": [0, 0, 0]}, "material": "wood"};
  node_shelf3_12.add(mesh_shelf3_12);
  meshes["shelf3"] = mesh_shelf3_12;
  colliders["shelf3"] = {};

  const attachment_box_nike_13 = null;
  const endpoint_box_nike_13 = makeAttachmentEndpoint(attachment_box_nike_13);
  const node_box_nike_13 = new THREE.Group();
  node_box_nike_13.name = "Nike shoebox__pivot";
  if (endpoint_box_nike_13) {
    node_box_nike_13.position.copy(endpoint_box_nike_13.start);
    node_box_nike_13.rotation.set(0, 0, 0);
    node_box_nike_13.scale.set(1, 1, 1);
  } else {
    node_box_nike_13.position.set(-0.5, 3.4, 0.0);
    node_box_nike_13.rotation.set(0.0, 0.0, 0.0);
    node_box_nike_13.scale.set(0.9, 0.4, 0.6);
  }
  node_box_nike_13.userData.sculptComponent = {"id": "box_nike", "name": "Nike shoebox", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.4, "depth": 0.6, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.5, 3.4, 0], "rotation": [0, 0, 0]}, "material": "nike"};
  node_box_nike_13.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_box_nike_13);
  nodes["box_nike"] = node_box_nike_13;
  const mesh_box_nike_13Geometry = endpoint_box_nike_13
    ? new THREE.CylinderGeometry(endpoint_box_nike_13.endRadius, endpoint_box_nike_13.baseRadius, endpoint_box_nike_13.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_box_nike_13 = new THREE.Mesh(
    mesh_box_nike_13Geometry,
    materialMap["nike"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_box_nike_13.name = "Nike shoebox";
  if (endpoint_box_nike_13) {
    mesh_box_nike_13.position.copy(endpoint_box_nike_13.midpoint);
    mesh_box_nike_13.quaternion.copy(endpoint_box_nike_13.quaternion);
  }
  mesh_box_nike_13.castShadow = options.castShadow ?? true;
  mesh_box_nike_13.receiveShadow = options.receiveShadow ?? true;
  mesh_box_nike_13.userData.sculptComponent = {"id": "box_nike", "name": "Nike shoebox", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.4, "depth": 0.6, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.5, 3.4, 0], "rotation": [0, 0, 0]}, "material": "nike"};
  node_box_nike_13.add(mesh_box_nike_13);
  meshes["box_nike"] = mesh_box_nike_13;
  colliders["box_nike"] = {};

  const attachment_box_white_14 = null;
  const endpoint_box_white_14 = makeAttachmentEndpoint(attachment_box_white_14);
  const node_box_white_14 = new THREE.Group();
  node_box_white_14.name = "White shoebox__pivot";
  if (endpoint_box_white_14) {
    node_box_white_14.position.copy(endpoint_box_white_14.start);
    node_box_white_14.rotation.set(0, 0, 0);
    node_box_white_14.scale.set(1, 1, 1);
  } else {
    node_box_white_14.position.set(-1.0, 3.4, 0.1);
    node_box_white_14.rotation.set(0.0, 0.0, 0.0);
    node_box_white_14.scale.set(0.7, 0.4, 0.55);
  }
  node_box_white_14.userData.sculptComponent = {"id": "box_white", "name": "White shoebox", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.7, "height": 0.4, "depth": 0.55, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.0, 3.4, 0.1], "rotation": [0, 0, 0]}, "material": "whitebox"};
  node_box_white_14.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_box_white_14);
  nodes["box_white"] = node_box_white_14;
  const mesh_box_white_14Geometry = endpoint_box_white_14
    ? new THREE.CylinderGeometry(endpoint_box_white_14.endRadius, endpoint_box_white_14.baseRadius, endpoint_box_white_14.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_box_white_14 = new THREE.Mesh(
    mesh_box_white_14Geometry,
    materialMap["whitebox"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_box_white_14.name = "White shoebox";
  if (endpoint_box_white_14) {
    mesh_box_white_14.position.copy(endpoint_box_white_14.midpoint);
    mesh_box_white_14.quaternion.copy(endpoint_box_white_14.quaternion);
  }
  mesh_box_white_14.castShadow = options.castShadow ?? true;
  mesh_box_white_14.receiveShadow = options.receiveShadow ?? true;
  mesh_box_white_14.userData.sculptComponent = {"id": "box_white", "name": "White shoebox", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.7, "height": 0.4, "depth": 0.55, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.0, 3.4, 0.1], "rotation": [0, 0, 0]}, "material": "whitebox"};
  node_box_white_14.add(mesh_box_white_14);
  meshes["box_white"] = mesh_box_white_14;
  colliders["box_white"] = {};

  const attachment_box_grey_15 = null;
  const endpoint_box_grey_15 = makeAttachmentEndpoint(attachment_box_grey_15);
  const node_box_grey_15 = new THREE.Group();
  node_box_grey_15.name = "Grey storage box__pivot";
  if (endpoint_box_grey_15) {
    node_box_grey_15.position.copy(endpoint_box_grey_15.start);
    node_box_grey_15.rotation.set(0, 0, 0);
    node_box_grey_15.scale.set(1, 1, 1);
  } else {
    node_box_grey_15.position.set(0.15, 3.45, 0.0);
    node_box_grey_15.rotation.set(0.0, 0.0, 0.0);
    node_box_grey_15.scale.set(0.8, 0.45, 0.6);
  }
  node_box_grey_15.userData.sculptComponent = {"id": "box_grey", "name": "Grey storage box", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.8, "height": 0.45, "depth": 0.6, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.15, 3.45, 0], "rotation": [0, 0, 0]}, "material": "greybox"};
  node_box_grey_15.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_box_grey_15);
  nodes["box_grey"] = node_box_grey_15;
  const mesh_box_grey_15Geometry = endpoint_box_grey_15
    ? new THREE.CylinderGeometry(endpoint_box_grey_15.endRadius, endpoint_box_grey_15.baseRadius, endpoint_box_grey_15.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_box_grey_15 = new THREE.Mesh(
    mesh_box_grey_15Geometry,
    materialMap["greybox"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_box_grey_15.name = "Grey storage box";
  if (endpoint_box_grey_15) {
    mesh_box_grey_15.position.copy(endpoint_box_grey_15.midpoint);
    mesh_box_grey_15.quaternion.copy(endpoint_box_grey_15.quaternion);
  }
  mesh_box_grey_15.castShadow = options.castShadow ?? true;
  mesh_box_grey_15.receiveShadow = options.receiveShadow ?? true;
  mesh_box_grey_15.userData.sculptComponent = {"id": "box_grey", "name": "Grey storage box", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.8, "height": 0.45, "depth": 0.6, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.15, 3.45, 0], "rotation": [0, 0, 0]}, "material": "greybox"};
  node_box_grey_15.add(mesh_box_grey_15);
  meshes["box_grey"] = mesh_box_grey_15;
  colliders["box_grey"] = {};

  const attachment_basketball_16 = null;
  const endpoint_basketball_16 = makeAttachmentEndpoint(attachment_basketball_16);
  const node_basketball_16 = new THREE.Group();
  node_basketball_16.name = "Basketball__pivot";
  if (endpoint_basketball_16) {
    node_basketball_16.position.copy(endpoint_basketball_16.start);
    node_basketball_16.rotation.set(0, 0, 0);
    node_basketball_16.scale.set(1, 1, 1);
  } else {
    node_basketball_16.position.set(0.5, 2.5, 0.1);
    node_basketball_16.rotation.set(0.0, 0.0, 0.0);
    node_basketball_16.scale.set(0.5, 0.5, 0.5);
  }
  node_basketball_16.userData.sculptComponent = {"id": "basketball", "name": "Basketball", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "sphere", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.5, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.5, 2.5, 0.1], "rotation": [0, 0, 0]}, "material": "ball"};
  node_basketball_16.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_basketball_16);
  nodes["basketball"] = node_basketball_16;
  const mesh_basketball_16Geometry = endpoint_basketball_16
    ? new THREE.CylinderGeometry(endpoint_basketball_16.endRadius, endpoint_basketball_16.baseRadius, endpoint_basketball_16.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_basketball_16 = new THREE.Mesh(
    mesh_basketball_16Geometry,
    materialMap["ball"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_basketball_16.name = "Basketball";
  if (endpoint_basketball_16) {
    mesh_basketball_16.position.copy(endpoint_basketball_16.midpoint);
    mesh_basketball_16.quaternion.copy(endpoint_basketball_16.quaternion);
  }
  mesh_basketball_16.castShadow = options.castShadow ?? true;
  mesh_basketball_16.receiveShadow = options.receiveShadow ?? true;
  mesh_basketball_16.userData.sculptComponent = {"id": "basketball", "name": "Basketball", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "sphere", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.5, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.5, 2.5, 0.1], "rotation": [0, 0, 0]}, "material": "ball"};
  node_basketball_16.add(mesh_basketball_16);
  meshes["basketball"] = mesh_basketball_16;
  colliders["basketball"] = {};

  const attachment_turntable_17 = null;
  const endpoint_turntable_17 = makeAttachmentEndpoint(attachment_turntable_17);
  const node_turntable_17 = new THREE.Group();
  node_turntable_17.name = "Turntable base__pivot";
  if (endpoint_turntable_17) {
    node_turntable_17.position.copy(endpoint_turntable_17.start);
    node_turntable_17.rotation.set(0, 0, 0);
    node_turntable_17.scale.set(1, 1, 1);
  } else {
    node_turntable_17.position.set(0.65, 1.35, 0.0);
    node_turntable_17.rotation.set(0.0, 0.0, 0.0);
    node_turntable_17.scale.set(0.9, 0.12, 0.8);
  }
  node_turntable_17.userData.sculptComponent = {"id": "turntable", "name": "Turntable base", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.12, "depth": 0.8, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.65, 1.35, 0], "rotation": [0, 0, 0]}, "material": "plastic"};
  node_turntable_17.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_turntable_17);
  nodes["turntable"] = node_turntable_17;
  const mesh_turntable_17Geometry = endpoint_turntable_17
    ? new THREE.CylinderGeometry(endpoint_turntable_17.endRadius, endpoint_turntable_17.baseRadius, endpoint_turntable_17.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_turntable_17 = new THREE.Mesh(
    mesh_turntable_17Geometry,
    materialMap["plastic"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_turntable_17.name = "Turntable base";
  if (endpoint_turntable_17) {
    mesh_turntable_17.position.copy(endpoint_turntable_17.midpoint);
    mesh_turntable_17.quaternion.copy(endpoint_turntable_17.quaternion);
  }
  mesh_turntable_17.castShadow = options.castShadow ?? true;
  mesh_turntable_17.receiveShadow = options.receiveShadow ?? true;
  mesh_turntable_17.userData.sculptComponent = {"id": "turntable", "name": "Turntable base", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.12, "depth": 0.8, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.65, 1.35, 0], "rotation": [0, 0, 0]}, "material": "plastic"};
  node_turntable_17.add(mesh_turntable_17);
  meshes["turntable"] = mesh_turntable_17;
  colliders["turntable"] = {};

  const attachment_platter_18 = null;
  const endpoint_platter_18 = makeAttachmentEndpoint(attachment_platter_18);
  const node_platter_18 = new THREE.Group();
  node_platter_18.name = "Turntable platter__pivot";
  if (endpoint_platter_18) {
    node_platter_18.position.copy(endpoint_platter_18.start);
    node_platter_18.rotation.set(0, 0, 0);
    node_platter_18.scale.set(1, 1, 1);
  } else {
    node_platter_18.position.set(0.65, 1.44, 0.0);
    node_platter_18.rotation.set(0.0, 0.0, 0.0);
    node_platter_18.scale.set(0.45, 0.04, 0.45);
  }
  node_platter_18.userData.sculptComponent = {"id": "platter", "name": "Turntable platter", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.45, "height": 0.04, "depth": 0.45, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.65, 1.44, 0], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_platter_18.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_platter_18);
  nodes["platter"] = node_platter_18;
  const mesh_platter_18Geometry = endpoint_platter_18
    ? new THREE.CylinderGeometry(endpoint_platter_18.endRadius, endpoint_platter_18.baseRadius, endpoint_platter_18.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_platter_18 = new THREE.Mesh(
    mesh_platter_18Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_platter_18.name = "Turntable platter";
  if (endpoint_platter_18) {
    mesh_platter_18.position.copy(endpoint_platter_18.midpoint);
    mesh_platter_18.quaternion.copy(endpoint_platter_18.quaternion);
  }
  mesh_platter_18.castShadow = options.castShadow ?? true;
  mesh_platter_18.receiveShadow = options.receiveShadow ?? true;
  mesh_platter_18.userData.sculptComponent = {"id": "platter", "name": "Turntable platter", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.45, "height": 0.04, "depth": 0.45, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.65, 1.44, 0], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_platter_18.add(mesh_platter_18);
  meshes["platter"] = mesh_platter_18;
  colliders["platter"] = {};

  const attachment_records_19 = null;
  const endpoint_records_19 = makeAttachmentEndpoint(attachment_records_19);
  const node_records_19 = new THREE.Group();
  node_records_19.name = "Vinyl records__pivot";
  if (endpoint_records_19) {
    node_records_19.position.copy(endpoint_records_19.start);
    node_records_19.rotation.set(0, 0, 0);
    node_records_19.scale.set(1, 1, 1);
  } else {
    node_records_19.position.set(0.45, 0.6, 0.1);
    node_records_19.rotation.set(0.0, 0.0, 0.0);
    node_records_19.scale.set(0.9, 0.9, 0.4);
  }
  node_records_19.userData.sculptComponent = {"id": "records", "name": "Vinyl records", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.9, "depth": 0.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.45, 0.6, 0.1], "rotation": [0, 0, 0]}, "material": "records"};
  node_records_19.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_records_19);
  nodes["records"] = node_records_19;
  const mesh_records_19Geometry = endpoint_records_19
    ? new THREE.CylinderGeometry(endpoint_records_19.endRadius, endpoint_records_19.baseRadius, endpoint_records_19.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_records_19 = new THREE.Mesh(
    mesh_records_19Geometry,
    materialMap["records"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_records_19.name = "Vinyl records";
  if (endpoint_records_19) {
    mesh_records_19.position.copy(endpoint_records_19.midpoint);
    mesh_records_19.quaternion.copy(endpoint_records_19.quaternion);
  }
  mesh_records_19.castShadow = options.castShadow ?? true;
  mesh_records_19.receiveShadow = options.receiveShadow ?? true;
  mesh_records_19.userData.sculptComponent = {"id": "records", "name": "Vinyl records", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.9, "depth": 0.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.45, 0.6, 0.1], "rotation": [0, 0, 0]}, "material": "records"};
  node_records_19.add(mesh_records_19);
  meshes["records"] = mesh_records_19;
  colliders["records"] = {};

  const attachment_bin1_20 = null;
  const endpoint_bin1_20 = makeAttachmentEndpoint(attachment_bin1_20);
  const node_bin1_20 = new THREE.Group();
  node_bin1_20.name = "Storage bin 1__pivot";
  if (endpoint_bin1_20) {
    node_bin1_20.position.copy(endpoint_bin1_20.start);
    node_bin1_20.rotation.set(0, 0, 0);
    node_bin1_20.scale.set(1, 1, 1);
  } else {
    node_bin1_20.position.set(0.9, 0.5, 0.4);
    node_bin1_20.rotation.set(0.0, 0.0, 0.0);
    node_bin1_20.scale.set(0.5, 0.5, 0.5);
  }
  node_bin1_20.userData.sculptComponent = {"id": "bin1", "name": "Storage bin 1", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.5, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.9, 0.5, 0.4], "rotation": [0, 0, 0]}, "material": "bin"};
  node_bin1_20.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_bin1_20);
  nodes["bin1"] = node_bin1_20;
  const mesh_bin1_20Geometry = endpoint_bin1_20
    ? new THREE.CylinderGeometry(endpoint_bin1_20.endRadius, endpoint_bin1_20.baseRadius, endpoint_bin1_20.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_bin1_20 = new THREE.Mesh(
    mesh_bin1_20Geometry,
    materialMap["bin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bin1_20.name = "Storage bin 1";
  if (endpoint_bin1_20) {
    mesh_bin1_20.position.copy(endpoint_bin1_20.midpoint);
    mesh_bin1_20.quaternion.copy(endpoint_bin1_20.quaternion);
  }
  mesh_bin1_20.castShadow = options.castShadow ?? true;
  mesh_bin1_20.receiveShadow = options.receiveShadow ?? true;
  mesh_bin1_20.userData.sculptComponent = {"id": "bin1", "name": "Storage bin 1", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.5, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.9, 0.5, 0.4], "rotation": [0, 0, 0]}, "material": "bin"};
  node_bin1_20.add(mesh_bin1_20);
  meshes["bin1"] = mesh_bin1_20;
  colliders["bin1"] = {};

  const attachment_bin2_21 = null;
  const endpoint_bin2_21 = makeAttachmentEndpoint(attachment_bin2_21);
  const node_bin2_21 = new THREE.Group();
  node_bin2_21.name = "Storage bin 2__pivot";
  if (endpoint_bin2_21) {
    node_bin2_21.position.copy(endpoint_bin2_21.start);
    node_bin2_21.rotation.set(0, 0, 0);
    node_bin2_21.scale.set(1, 1, 1);
  } else {
    node_bin2_21.position.set(0.4, 0.5, 0.4);
    node_bin2_21.rotation.set(0.0, 0.0, 0.0);
    node_bin2_21.scale.set(0.5, 0.5, 0.5);
  }
  node_bin2_21.userData.sculptComponent = {"id": "bin2", "name": "Storage bin 2", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.5, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.4, 0.5, 0.4], "rotation": [0, 0, 0]}, "material": "bin"};
  node_bin2_21.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_bin2_21);
  nodes["bin2"] = node_bin2_21;
  const mesh_bin2_21Geometry = endpoint_bin2_21
    ? new THREE.CylinderGeometry(endpoint_bin2_21.endRadius, endpoint_bin2_21.baseRadius, endpoint_bin2_21.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_bin2_21 = new THREE.Mesh(
    mesh_bin2_21Geometry,
    materialMap["bin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bin2_21.name = "Storage bin 2";
  if (endpoint_bin2_21) {
    mesh_bin2_21.position.copy(endpoint_bin2_21.midpoint);
    mesh_bin2_21.quaternion.copy(endpoint_bin2_21.quaternion);
  }
  mesh_bin2_21.castShadow = options.castShadow ?? true;
  mesh_bin2_21.receiveShadow = options.receiveShadow ?? true;
  mesh_bin2_21.userData.sculptComponent = {"id": "bin2", "name": "Storage bin 2", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.5, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.4, 0.5, 0.4], "rotation": [0, 0, 0]}, "material": "bin"};
  node_bin2_21.add(mesh_bin2_21);
  meshes["bin2"] = mesh_bin2_21;
  colliders["bin2"] = {};

  const attachment_plant_pot_22 = null;
  const endpoint_plant_pot_22 = makeAttachmentEndpoint(attachment_plant_pot_22);
  const node_plant_pot_22 = new THREE.Group();
  node_plant_pot_22.name = "Plant pot__pivot";
  if (endpoint_plant_pot_22) {
    node_plant_pot_22.position.copy(endpoint_plant_pot_22.start);
    node_plant_pot_22.rotation.set(0, 0, 0);
    node_plant_pot_22.scale.set(1, 1, 1);
  } else {
    node_plant_pot_22.position.set(1.0, 3.25, 0.0);
    node_plant_pot_22.rotation.set(0.0, 0.0, 0.0);
    node_plant_pot_22.scale.set(0.28, 0.25, 0.28);
  }
  node_plant_pot_22.userData.sculptComponent = {"id": "plant_pot", "name": "Plant pot", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.28, "height": 0.25, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.0, 3.25, 0], "rotation": [0, 0, 0]}, "material": "pot"};
  node_plant_pot_22.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_plant_pot_22);
  nodes["plant_pot"] = node_plant_pot_22;
  const mesh_plant_pot_22Geometry = endpoint_plant_pot_22
    ? new THREE.CylinderGeometry(endpoint_plant_pot_22.endRadius, endpoint_plant_pot_22.baseRadius, endpoint_plant_pot_22.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_plant_pot_22 = new THREE.Mesh(
    mesh_plant_pot_22Geometry,
    materialMap["pot"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_plant_pot_22.name = "Plant pot";
  if (endpoint_plant_pot_22) {
    mesh_plant_pot_22.position.copy(endpoint_plant_pot_22.midpoint);
    mesh_plant_pot_22.quaternion.copy(endpoint_plant_pot_22.quaternion);
  }
  mesh_plant_pot_22.castShadow = options.castShadow ?? true;
  mesh_plant_pot_22.receiveShadow = options.receiveShadow ?? true;
  mesh_plant_pot_22.userData.sculptComponent = {"id": "plant_pot", "name": "Plant pot", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.28, "height": 0.25, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.0, 3.25, 0], "rotation": [0, 0, 0]}, "material": "pot"};
  node_plant_pot_22.add(mesh_plant_pot_22);
  meshes["plant_pot"] = mesh_plant_pot_22;
  colliders["plant_pot"] = {};

  const attachment_plant_leaf_23 = null;
  const endpoint_plant_leaf_23 = makeAttachmentEndpoint(attachment_plant_leaf_23);
  const node_plant_leaf_23 = new THREE.Group();
  node_plant_leaf_23.name = "Trailing plant__pivot";
  if (endpoint_plant_leaf_23) {
    node_plant_leaf_23.position.copy(endpoint_plant_leaf_23.start);
    node_plant_leaf_23.rotation.set(0, 0, 0);
    node_plant_leaf_23.scale.set(1, 1, 1);
  } else {
    node_plant_leaf_23.position.set(1.0, 3.55, 0.0);
    node_plant_leaf_23.rotation.set(0.0, 0.0, 0.0);
    node_plant_leaf_23.scale.set(0.55, 0.55, 0.55);
  }
  node_plant_leaf_23.userData.sculptComponent = {"id": "plant_leaf", "name": "Trailing plant", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "sphere", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.55, "height": 0.55, "depth": 0.55, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.0, 3.55, 0], "rotation": [0, 0, 0]}, "material": "green"};
  node_plant_leaf_23.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_plant_leaf_23);
  nodes["plant_leaf"] = node_plant_leaf_23;
  const mesh_plant_leaf_23Geometry = endpoint_plant_leaf_23
    ? new THREE.CylinderGeometry(endpoint_plant_leaf_23.endRadius, endpoint_plant_leaf_23.baseRadius, endpoint_plant_leaf_23.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_plant_leaf_23 = new THREE.Mesh(
    mesh_plant_leaf_23Geometry,
    materialMap["green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_plant_leaf_23.name = "Trailing plant";
  if (endpoint_plant_leaf_23) {
    mesh_plant_leaf_23.position.copy(endpoint_plant_leaf_23.midpoint);
    mesh_plant_leaf_23.quaternion.copy(endpoint_plant_leaf_23.quaternion);
  }
  mesh_plant_leaf_23.castShadow = options.castShadow ?? true;
  mesh_plant_leaf_23.receiveShadow = options.receiveShadow ?? true;
  mesh_plant_leaf_23.userData.sculptComponent = {"id": "plant_leaf", "name": "Trailing plant", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "sphere", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.55, "height": 0.55, "depth": 0.55, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.0, 3.55, 0], "rotation": [0, 0, 0]}, "material": "green"};
  node_plant_leaf_23.add(mesh_plant_leaf_23);
  meshes["plant_leaf"] = mesh_plant_leaf_23;
  colliders["plant_leaf"] = {};

  const attachment_trophy_24 = null;
  const endpoint_trophy_24 = makeAttachmentEndpoint(attachment_trophy_24);
  const node_trophy_24 = new THREE.Group();
  node_trophy_24.name = "Trophy__pivot";
  if (endpoint_trophy_24) {
    node_trophy_24.position.copy(endpoint_trophy_24.start);
    node_trophy_24.rotation.set(0, 0, 0);
    node_trophy_24.scale.set(1, 1, 1);
  } else {
    node_trophy_24.position.set(0.35, 2.4, 0.2);
    node_trophy_24.rotation.set(0.0, 0.0, 0.0);
    node_trophy_24.scale.set(0.3, 0.5, 0.3);
  }
  node_trophy_24.userData.sculptComponent = {"id": "trophy", "name": "Trophy", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.5, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.35, 2.4, 0.2], "rotation": [0, 0, 0]}, "material": "trophy"};
  node_trophy_24.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_trophy_24);
  nodes["trophy"] = node_trophy_24;
  const mesh_trophy_24Geometry = endpoint_trophy_24
    ? new THREE.CylinderGeometry(endpoint_trophy_24.endRadius, endpoint_trophy_24.baseRadius, endpoint_trophy_24.length, 32, 12)
    : new THREE.ConeGeometry(0.5, 1, 48, 16);
  const mesh_trophy_24 = new THREE.Mesh(
    mesh_trophy_24Geometry,
    materialMap["trophy"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_trophy_24.name = "Trophy";
  if (endpoint_trophy_24) {
    mesh_trophy_24.position.copy(endpoint_trophy_24.midpoint);
    mesh_trophy_24.quaternion.copy(endpoint_trophy_24.quaternion);
  }
  mesh_trophy_24.castShadow = options.castShadow ?? true;
  mesh_trophy_24.receiveShadow = options.receiveShadow ?? true;
  mesh_trophy_24.userData.sculptComponent = {"id": "trophy", "name": "Trophy", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.5, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.35, 2.4, 0.2], "rotation": [0, 0, 0]}, "material": "trophy"};
  node_trophy_24.add(mesh_trophy_24);
  meshes["trophy"] = mesh_trophy_24;
  colliders["trophy"] = {};

  const attachment_rubik_25 = null;
  const endpoint_rubik_25 = makeAttachmentEndpoint(attachment_rubik_25);
  const node_rubik_25 = new THREE.Group();
  node_rubik_25.name = "Rubik's cube__pivot";
  if (endpoint_rubik_25) {
    node_rubik_25.position.copy(endpoint_rubik_25.start);
    node_rubik_25.rotation.set(0, 0, 0);
    node_rubik_25.scale.set(1, 1, 1);
  } else {
    node_rubik_25.position.set(0.72, 2.32, 0.2);
    node_rubik_25.rotation.set(0.0, 0.0, 0.0);
    node_rubik_25.scale.set(0.3, 0.3, 0.3);
  }
  node_rubik_25.userData.sculptComponent = {"id": "rubik", "name": "Rubik's cube", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.3, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.72, 2.32, 0.2], "rotation": [0, 0, 0]}, "material": "rubik"};
  node_rubik_25.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_rubik_25);
  nodes["rubik"] = node_rubik_25;
  const mesh_rubik_25Geometry = endpoint_rubik_25
    ? new THREE.CylinderGeometry(endpoint_rubik_25.endRadius, endpoint_rubik_25.baseRadius, endpoint_rubik_25.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_rubik_25 = new THREE.Mesh(
    mesh_rubik_25Geometry,
    materialMap["rubik"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_rubik_25.name = "Rubik's cube";
  if (endpoint_rubik_25) {
    mesh_rubik_25.position.copy(endpoint_rubik_25.midpoint);
    mesh_rubik_25.quaternion.copy(endpoint_rubik_25.quaternion);
  }
  mesh_rubik_25.castShadow = options.castShadow ?? true;
  mesh_rubik_25.receiveShadow = options.receiveShadow ?? true;
  mesh_rubik_25.userData.sculptComponent = {"id": "rubik", "name": "Rubik's cube", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.3, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.72, 2.32, 0.2], "rotation": [0, 0, 0]}, "material": "rubik"};
  node_rubik_25.add(mesh_rubik_25);
  meshes["rubik"] = mesh_rubik_25;
  colliders["rubik"] = {};

  const attachment_cloth_0_26 = null;
  const endpoint_cloth_0_26 = makeAttachmentEndpoint(attachment_cloth_0_26);
  const node_cloth_0_26 = new THREE.Group();
  node_cloth_0_26.name = "Hanging garment__pivot";
  if (endpoint_cloth_0_26) {
    node_cloth_0_26.position.copy(endpoint_cloth_0_26.start);
    node_cloth_0_26.rotation.set(0, 0, 0);
    node_cloth_0_26.scale.set(1, 1, 1);
  } else {
    node_cloth_0_26.position.set(-1.0, 2.1, 0.0);
    node_cloth_0_26.rotation.set(0.0, 0.0, 0.0);
    node_cloth_0_26.scale.set(0.16, 1.0, 0.28);
  }
  node_cloth_0_26.userData.sculptComponent = {"id": "cloth_0", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.0, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_grey"};
  node_cloth_0_26.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_cloth_0_26);
  nodes["cloth_0"] = node_cloth_0_26;
  const mesh_cloth_0_26Geometry = endpoint_cloth_0_26
    ? new THREE.CylinderGeometry(endpoint_cloth_0_26.endRadius, endpoint_cloth_0_26.baseRadius, endpoint_cloth_0_26.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_cloth_0_26 = new THREE.Mesh(
    mesh_cloth_0_26Geometry,
    materialMap["cloth_grey"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cloth_0_26.name = "Hanging garment";
  if (endpoint_cloth_0_26) {
    mesh_cloth_0_26.position.copy(endpoint_cloth_0_26.midpoint);
    mesh_cloth_0_26.quaternion.copy(endpoint_cloth_0_26.quaternion);
  }
  mesh_cloth_0_26.castShadow = options.castShadow ?? true;
  mesh_cloth_0_26.receiveShadow = options.receiveShadow ?? true;
  mesh_cloth_0_26.userData.sculptComponent = {"id": "cloth_0", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.0, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_grey"};
  node_cloth_0_26.add(mesh_cloth_0_26);
  meshes["cloth_0"] = mesh_cloth_0_26;
  colliders["cloth_0"] = {};

  const attachment_cloth_1_27 = null;
  const endpoint_cloth_1_27 = makeAttachmentEndpoint(attachment_cloth_1_27);
  const node_cloth_1_27 = new THREE.Group();
  node_cloth_1_27.name = "Hanging garment__pivot";
  if (endpoint_cloth_1_27) {
    node_cloth_1_27.position.copy(endpoint_cloth_1_27.start);
    node_cloth_1_27.rotation.set(0, 0, 0);
    node_cloth_1_27.scale.set(1, 1, 1);
  } else {
    node_cloth_1_27.position.set(-0.83, 2.1, 0.0);
    node_cloth_1_27.rotation.set(0.0, 0.0, 0.0);
    node_cloth_1_27.scale.set(0.16, 1.0, 0.28);
  }
  node_cloth_1_27.userData.sculptComponent = {"id": "cloth_1", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.83, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_red"};
  node_cloth_1_27.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_cloth_1_27);
  nodes["cloth_1"] = node_cloth_1_27;
  const mesh_cloth_1_27Geometry = endpoint_cloth_1_27
    ? new THREE.CylinderGeometry(endpoint_cloth_1_27.endRadius, endpoint_cloth_1_27.baseRadius, endpoint_cloth_1_27.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_cloth_1_27 = new THREE.Mesh(
    mesh_cloth_1_27Geometry,
    materialMap["cloth_red"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cloth_1_27.name = "Hanging garment";
  if (endpoint_cloth_1_27) {
    mesh_cloth_1_27.position.copy(endpoint_cloth_1_27.midpoint);
    mesh_cloth_1_27.quaternion.copy(endpoint_cloth_1_27.quaternion);
  }
  mesh_cloth_1_27.castShadow = options.castShadow ?? true;
  mesh_cloth_1_27.receiveShadow = options.receiveShadow ?? true;
  mesh_cloth_1_27.userData.sculptComponent = {"id": "cloth_1", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.83, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_red"};
  node_cloth_1_27.add(mesh_cloth_1_27);
  meshes["cloth_1"] = mesh_cloth_1_27;
  colliders["cloth_1"] = {};

  const attachment_cloth_2_28 = null;
  const endpoint_cloth_2_28 = makeAttachmentEndpoint(attachment_cloth_2_28);
  const node_cloth_2_28 = new THREE.Group();
  node_cloth_2_28.name = "Hanging garment__pivot";
  if (endpoint_cloth_2_28) {
    node_cloth_2_28.position.copy(endpoint_cloth_2_28.start);
    node_cloth_2_28.rotation.set(0, 0, 0);
    node_cloth_2_28.scale.set(1, 1, 1);
  } else {
    node_cloth_2_28.position.set(-0.6599999999999999, 2.1, 0.0);
    node_cloth_2_28.rotation.set(0.0, 0.0, 0.0);
    node_cloth_2_28.scale.set(0.16, 1.0, 0.28);
  }
  node_cloth_2_28.userData.sculptComponent = {"id": "cloth_2", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.6599999999999999, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_grey2"};
  node_cloth_2_28.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_cloth_2_28);
  nodes["cloth_2"] = node_cloth_2_28;
  const mesh_cloth_2_28Geometry = endpoint_cloth_2_28
    ? new THREE.CylinderGeometry(endpoint_cloth_2_28.endRadius, endpoint_cloth_2_28.baseRadius, endpoint_cloth_2_28.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_cloth_2_28 = new THREE.Mesh(
    mesh_cloth_2_28Geometry,
    materialMap["cloth_grey2"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cloth_2_28.name = "Hanging garment";
  if (endpoint_cloth_2_28) {
    mesh_cloth_2_28.position.copy(endpoint_cloth_2_28.midpoint);
    mesh_cloth_2_28.quaternion.copy(endpoint_cloth_2_28.quaternion);
  }
  mesh_cloth_2_28.castShadow = options.castShadow ?? true;
  mesh_cloth_2_28.receiveShadow = options.receiveShadow ?? true;
  mesh_cloth_2_28.userData.sculptComponent = {"id": "cloth_2", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.6599999999999999, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_grey2"};
  node_cloth_2_28.add(mesh_cloth_2_28);
  meshes["cloth_2"] = mesh_cloth_2_28;
  colliders["cloth_2"] = {};

  const attachment_cloth_3_29 = null;
  const endpoint_cloth_3_29 = makeAttachmentEndpoint(attachment_cloth_3_29);
  const node_cloth_3_29 = new THREE.Group();
  node_cloth_3_29.name = "Hanging garment__pivot";
  if (endpoint_cloth_3_29) {
    node_cloth_3_29.position.copy(endpoint_cloth_3_29.start);
    node_cloth_3_29.rotation.set(0, 0, 0);
    node_cloth_3_29.scale.set(1, 1, 1);
  } else {
    node_cloth_3_29.position.set(-0.49, 2.1, 0.0);
    node_cloth_3_29.rotation.set(0.0, 0.0, 0.0);
    node_cloth_3_29.scale.set(0.16, 1.0, 0.28);
  }
  node_cloth_3_29.userData.sculptComponent = {"id": "cloth_3", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.49, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_plaid"};
  node_cloth_3_29.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_cloth_3_29);
  nodes["cloth_3"] = node_cloth_3_29;
  const mesh_cloth_3_29Geometry = endpoint_cloth_3_29
    ? new THREE.CylinderGeometry(endpoint_cloth_3_29.endRadius, endpoint_cloth_3_29.baseRadius, endpoint_cloth_3_29.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_cloth_3_29 = new THREE.Mesh(
    mesh_cloth_3_29Geometry,
    materialMap["cloth_plaid"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cloth_3_29.name = "Hanging garment";
  if (endpoint_cloth_3_29) {
    mesh_cloth_3_29.position.copy(endpoint_cloth_3_29.midpoint);
    mesh_cloth_3_29.quaternion.copy(endpoint_cloth_3_29.quaternion);
  }
  mesh_cloth_3_29.castShadow = options.castShadow ?? true;
  mesh_cloth_3_29.receiveShadow = options.receiveShadow ?? true;
  mesh_cloth_3_29.userData.sculptComponent = {"id": "cloth_3", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.49, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_plaid"};
  node_cloth_3_29.add(mesh_cloth_3_29);
  meshes["cloth_3"] = mesh_cloth_3_29;
  colliders["cloth_3"] = {};

  const attachment_cloth_4_30 = null;
  const endpoint_cloth_4_30 = makeAttachmentEndpoint(attachment_cloth_4_30);
  const node_cloth_4_30 = new THREE.Group();
  node_cloth_4_30.name = "Hanging garment__pivot";
  if (endpoint_cloth_4_30) {
    node_cloth_4_30.position.copy(endpoint_cloth_4_30.start);
    node_cloth_4_30.rotation.set(0, 0, 0);
    node_cloth_4_30.scale.set(1, 1, 1);
  } else {
    node_cloth_4_30.position.set(-0.31999999999999995, 2.1, 0.0);
    node_cloth_4_30.rotation.set(0.0, 0.0, 0.0);
    node_cloth_4_30.scale.set(0.16, 1.0, 0.28);
  }
  node_cloth_4_30.userData.sculptComponent = {"id": "cloth_4", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.31999999999999995, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_brown"};
  node_cloth_4_30.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_cloth_4_30);
  nodes["cloth_4"] = node_cloth_4_30;
  const mesh_cloth_4_30Geometry = endpoint_cloth_4_30
    ? new THREE.CylinderGeometry(endpoint_cloth_4_30.endRadius, endpoint_cloth_4_30.baseRadius, endpoint_cloth_4_30.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_cloth_4_30 = new THREE.Mesh(
    mesh_cloth_4_30Geometry,
    materialMap["cloth_brown"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cloth_4_30.name = "Hanging garment";
  if (endpoint_cloth_4_30) {
    mesh_cloth_4_30.position.copy(endpoint_cloth_4_30.midpoint);
    mesh_cloth_4_30.quaternion.copy(endpoint_cloth_4_30.quaternion);
  }
  mesh_cloth_4_30.castShadow = options.castShadow ?? true;
  mesh_cloth_4_30.receiveShadow = options.receiveShadow ?? true;
  mesh_cloth_4_30.userData.sculptComponent = {"id": "cloth_4", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.31999999999999995, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_brown"};
  node_cloth_4_30.add(mesh_cloth_4_30);
  meshes["cloth_4"] = mesh_cloth_4_30;
  colliders["cloth_4"] = {};

  const attachment_cloth_5_31 = null;
  const endpoint_cloth_5_31 = makeAttachmentEndpoint(attachment_cloth_5_31);
  const node_cloth_5_31 = new THREE.Group();
  node_cloth_5_31.name = "Hanging garment__pivot";
  if (endpoint_cloth_5_31) {
    node_cloth_5_31.position.copy(endpoint_cloth_5_31.start);
    node_cloth_5_31.rotation.set(0, 0, 0);
    node_cloth_5_31.scale.set(1, 1, 1);
  } else {
    node_cloth_5_31.position.set(-0.1499999999999999, 2.1, 0.0);
    node_cloth_5_31.rotation.set(0.0, 0.0, 0.0);
    node_cloth_5_31.scale.set(0.16, 1.0, 0.28);
  }
  node_cloth_5_31.userData.sculptComponent = {"id": "cloth_5", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.1499999999999999, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_dark"};
  node_cloth_5_31.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_cloth_5_31);
  nodes["cloth_5"] = node_cloth_5_31;
  const mesh_cloth_5_31Geometry = endpoint_cloth_5_31
    ? new THREE.CylinderGeometry(endpoint_cloth_5_31.endRadius, endpoint_cloth_5_31.baseRadius, endpoint_cloth_5_31.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_cloth_5_31 = new THREE.Mesh(
    mesh_cloth_5_31Geometry,
    materialMap["cloth_dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cloth_5_31.name = "Hanging garment";
  if (endpoint_cloth_5_31) {
    mesh_cloth_5_31.position.copy(endpoint_cloth_5_31.midpoint);
    mesh_cloth_5_31.quaternion.copy(endpoint_cloth_5_31.quaternion);
  }
  mesh_cloth_5_31.castShadow = options.castShadow ?? true;
  mesh_cloth_5_31.receiveShadow = options.receiveShadow ?? true;
  mesh_cloth_5_31.userData.sculptComponent = {"id": "cloth_5", "name": "Hanging garment", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.16, "height": 1.0, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.1499999999999999, 2.1, 0], "rotation": [0, 0, 0]}, "material": "cloth_dark"};
  node_cloth_5_31.add(mesh_cloth_5_31);
  meshes["cloth_5"] = mesh_cloth_5_31;
  colliders["cloth_5"] = {};

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createWardrobeLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Wardrobe look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}
