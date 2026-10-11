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

// Generated from ObjectSculptSpec target: Skateboard
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createSkateboardModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Skateboard";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["phantom"] = createSculptMaterial(
    "phantom",
    {"id": "phantom", "name": "Hidden anchor", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#000000", "color": "#000000", "albedo": {"dominant": "#000000", "secondary": ["#000000"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#000000", "#000000"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 1.0, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["decktop"] = createSculptMaterial(
    "decktop",
    {"id": "decktop", "name": "Graphic griptape", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#3a2352", "color": "#3a2352", "albedo": {"dominant": "#3a2352", "secondary": ["#5b21b6", "#1e1b2e"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#3a2352", "#5b21b6", "#1e1b2e"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.6, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["maple"] = createSculptMaterial(
    "maple",
    {"id": "maple", "name": "Maple ply", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#c9a36a", "color": "#c9a36a", "albedo": {"dominant": "#c9a36a", "secondary": ["#b08a55"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#c9a36a", "#b08a55"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.6, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["truck"] = createSculptMaterial(
    "truck",
    {"id": "truck", "name": "Silver truck", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#b8bcc4", "color": "#b8bcc4", "albedo": {"dominant": "#b8bcc4", "secondary": ["#b8bcc4"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#b8bcc4", "#b8bcc4"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.35, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.8, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["wheel"] = createSculptMaterial(
    "wheel",
    {"id": "wheel", "name": "Wheel", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#e8e4d8", "color": "#e8e4d8", "albedo": {"dominant": "#e8e4d8", "secondary": ["#e8e4d8"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#e8e4d8", "#e8e4d8"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.5, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
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

  const attachment_deck_ply_1 = null;
  const endpoint_deck_ply_1 = makeAttachmentEndpoint(attachment_deck_ply_1);
  const node_deck_ply_1 = new THREE.Group();
  node_deck_ply_1.name = "Maple ply edge__pivot";
  if (endpoint_deck_ply_1) {
    node_deck_ply_1.position.copy(endpoint_deck_ply_1.start);
    node_deck_ply_1.rotation.set(0, 0, 0);
    node_deck_ply_1.scale.set(1, 1, 1);
  } else {
    node_deck_ply_1.position.set(0.0, 0.31, 0.0);
    node_deck_ply_1.rotation.set(0.0, 0.0, 0.0);
    node_deck_ply_1.scale.set(0.9, 0.06, 3.35);
  }
  node_deck_ply_1.userData.sculptComponent = {"id": "deck_ply", "name": "Maple ply edge", "level": "macro", "role": "body", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.06, "depth": 3.35, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.31, 0], "rotation": [0, 0, 0]}, "material": "maple"};
  node_deck_ply_1.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_deck_ply_1);
  nodes["deck_ply"] = node_deck_ply_1;
  const mesh_deck_ply_1Geometry = endpoint_deck_ply_1
    ? new THREE.CylinderGeometry(endpoint_deck_ply_1.endRadius, endpoint_deck_ply_1.baseRadius, endpoint_deck_ply_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_deck_ply_1 = new THREE.Mesh(
    mesh_deck_ply_1Geometry,
    materialMap["maple"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_deck_ply_1.name = "Maple ply edge";
  if (endpoint_deck_ply_1) {
    mesh_deck_ply_1.position.copy(endpoint_deck_ply_1.midpoint);
    mesh_deck_ply_1.quaternion.copy(endpoint_deck_ply_1.quaternion);
  }
  mesh_deck_ply_1.castShadow = options.castShadow ?? true;
  mesh_deck_ply_1.receiveShadow = options.receiveShadow ?? true;
  mesh_deck_ply_1.userData.sculptComponent = {"id": "deck_ply", "name": "Maple ply edge", "level": "macro", "role": "body", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.06, "depth": 3.35, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.31, 0], "rotation": [0, 0, 0]}, "material": "maple"};
  node_deck_ply_1.add(mesh_deck_ply_1);
  meshes["deck_ply"] = mesh_deck_ply_1;
  colliders["deck_ply"] = {};

  const attachment_deck_2 = null;
  const endpoint_deck_2 = makeAttachmentEndpoint(attachment_deck_2);
  const node_deck_2 = new THREE.Group();
  node_deck_2.name = "Deck graphic top__pivot";
  if (endpoint_deck_2) {
    node_deck_2.position.copy(endpoint_deck_2.start);
    node_deck_2.rotation.set(0, 0, 0);
    node_deck_2.scale.set(1, 1, 1);
  } else {
    node_deck_2.position.set(0.0, 0.35, 0.0);
    node_deck_2.rotation.set(0.0, 0.0, 0.0);
    node_deck_2.scale.set(0.85, 0.05, 3.2);
  }
  node_deck_2.userData.sculptComponent = {"id": "deck", "name": "Deck graphic top", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.85, "height": 0.05, "depth": 3.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.35, 0], "rotation": [0, 0, 0]}, "material": "decktop"};
  node_deck_2.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_deck_2);
  nodes["deck"] = node_deck_2;
  const mesh_deck_2Geometry = endpoint_deck_2
    ? new THREE.CylinderGeometry(endpoint_deck_2.endRadius, endpoint_deck_2.baseRadius, endpoint_deck_2.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_deck_2 = new THREE.Mesh(
    mesh_deck_2Geometry,
    materialMap["decktop"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_deck_2.name = "Deck graphic top";
  if (endpoint_deck_2) {
    mesh_deck_2.position.copy(endpoint_deck_2.midpoint);
    mesh_deck_2.quaternion.copy(endpoint_deck_2.quaternion);
  }
  mesh_deck_2.castShadow = options.castShadow ?? true;
  mesh_deck_2.receiveShadow = options.receiveShadow ?? true;
  mesh_deck_2.userData.sculptComponent = {"id": "deck", "name": "Deck graphic top", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.85, "height": 0.05, "depth": 3.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.35, 0], "rotation": [0, 0, 0]}, "material": "decktop"};
  node_deck_2.add(mesh_deck_2);
  meshes["deck"] = mesh_deck_2;
  colliders["deck"] = {};

  const attachment_truck_f_base_3 = null;
  const endpoint_truck_f_base_3 = makeAttachmentEndpoint(attachment_truck_f_base_3);
  const node_truck_f_base_3 = new THREE.Group();
  node_truck_f_base_3.name = "Front truck baseplate__pivot";
  if (endpoint_truck_f_base_3) {
    node_truck_f_base_3.position.copy(endpoint_truck_f_base_3.start);
    node_truck_f_base_3.rotation.set(0, 0, 0);
    node_truck_f_base_3.scale.set(1, 1, 1);
  } else {
    node_truck_f_base_3.position.set(0.0, 0.28, 1.0);
    node_truck_f_base_3.rotation.set(0.0, 0.0, 0.0);
    node_truck_f_base_3.scale.set(0.35, 0.1, 0.3);
  }
  node_truck_f_base_3.userData.sculptComponent = {"id": "truck_f_base", "name": "Front truck baseplate", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.35, "height": 0.1, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.28, 1.0], "rotation": [0, 0, 0]}, "material": "truck"};
  node_truck_f_base_3.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_truck_f_base_3);
  nodes["truck_f_base"] = node_truck_f_base_3;
  const mesh_truck_f_base_3Geometry = endpoint_truck_f_base_3
    ? new THREE.CylinderGeometry(endpoint_truck_f_base_3.endRadius, endpoint_truck_f_base_3.baseRadius, endpoint_truck_f_base_3.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_truck_f_base_3 = new THREE.Mesh(
    mesh_truck_f_base_3Geometry,
    materialMap["truck"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_truck_f_base_3.name = "Front truck baseplate";
  if (endpoint_truck_f_base_3) {
    mesh_truck_f_base_3.position.copy(endpoint_truck_f_base_3.midpoint);
    mesh_truck_f_base_3.quaternion.copy(endpoint_truck_f_base_3.quaternion);
  }
  mesh_truck_f_base_3.castShadow = options.castShadow ?? true;
  mesh_truck_f_base_3.receiveShadow = options.receiveShadow ?? true;
  mesh_truck_f_base_3.userData.sculptComponent = {"id": "truck_f_base", "name": "Front truck baseplate", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.35, "height": 0.1, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.28, 1.0], "rotation": [0, 0, 0]}, "material": "truck"};
  node_truck_f_base_3.add(mesh_truck_f_base_3);
  meshes["truck_f_base"] = mesh_truck_f_base_3;
  colliders["truck_f_base"] = {};

  const attachment_truck_f_hanger_4 = null;
  const endpoint_truck_f_hanger_4 = makeAttachmentEndpoint(attachment_truck_f_hanger_4);
  const node_truck_f_hanger_4 = new THREE.Group();
  node_truck_f_hanger_4.name = "Front hanger__pivot";
  if (endpoint_truck_f_hanger_4) {
    node_truck_f_hanger_4.position.copy(endpoint_truck_f_hanger_4.start);
    node_truck_f_hanger_4.rotation.set(0, 0, 0);
    node_truck_f_hanger_4.scale.set(1, 1, 1);
  } else {
    node_truck_f_hanger_4.position.set(0.0, 0.2, 1.0);
    node_truck_f_hanger_4.rotation.set(0.0, 0.0, 0.0);
    node_truck_f_hanger_4.scale.set(0.9, 0.12, 0.18);
  }
  node_truck_f_hanger_4.userData.sculptComponent = {"id": "truck_f_hanger", "name": "Front hanger", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.12, "depth": 0.18, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.2, 1.0], "rotation": [0, 0, 0]}, "material": "truck"};
  node_truck_f_hanger_4.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_truck_f_hanger_4);
  nodes["truck_f_hanger"] = node_truck_f_hanger_4;
  const mesh_truck_f_hanger_4Geometry = endpoint_truck_f_hanger_4
    ? new THREE.CylinderGeometry(endpoint_truck_f_hanger_4.endRadius, endpoint_truck_f_hanger_4.baseRadius, endpoint_truck_f_hanger_4.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_truck_f_hanger_4 = new THREE.Mesh(
    mesh_truck_f_hanger_4Geometry,
    materialMap["truck"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_truck_f_hanger_4.name = "Front hanger";
  if (endpoint_truck_f_hanger_4) {
    mesh_truck_f_hanger_4.position.copy(endpoint_truck_f_hanger_4.midpoint);
    mesh_truck_f_hanger_4.quaternion.copy(endpoint_truck_f_hanger_4.quaternion);
  }
  mesh_truck_f_hanger_4.castShadow = options.castShadow ?? true;
  mesh_truck_f_hanger_4.receiveShadow = options.receiveShadow ?? true;
  mesh_truck_f_hanger_4.userData.sculptComponent = {"id": "truck_f_hanger", "name": "Front hanger", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.12, "depth": 0.18, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.2, 1.0], "rotation": [0, 0, 0]}, "material": "truck"};
  node_truck_f_hanger_4.add(mesh_truck_f_hanger_4);
  meshes["truck_f_hanger"] = mesh_truck_f_hanger_4;
  colliders["truck_f_hanger"] = {};

  const attachment_truck_b_base_5 = null;
  const endpoint_truck_b_base_5 = makeAttachmentEndpoint(attachment_truck_b_base_5);
  const node_truck_b_base_5 = new THREE.Group();
  node_truck_b_base_5.name = "Back truck baseplate__pivot";
  if (endpoint_truck_b_base_5) {
    node_truck_b_base_5.position.copy(endpoint_truck_b_base_5.start);
    node_truck_b_base_5.rotation.set(0, 0, 0);
    node_truck_b_base_5.scale.set(1, 1, 1);
  } else {
    node_truck_b_base_5.position.set(0.0, 0.28, -1.0);
    node_truck_b_base_5.rotation.set(0.0, 0.0, 0.0);
    node_truck_b_base_5.scale.set(0.35, 0.1, 0.3);
  }
  node_truck_b_base_5.userData.sculptComponent = {"id": "truck_b_base", "name": "Back truck baseplate", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.35, "height": 0.1, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.28, -1.0], "rotation": [0, 0, 0]}, "material": "truck"};
  node_truck_b_base_5.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_truck_b_base_5);
  nodes["truck_b_base"] = node_truck_b_base_5;
  const mesh_truck_b_base_5Geometry = endpoint_truck_b_base_5
    ? new THREE.CylinderGeometry(endpoint_truck_b_base_5.endRadius, endpoint_truck_b_base_5.baseRadius, endpoint_truck_b_base_5.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_truck_b_base_5 = new THREE.Mesh(
    mesh_truck_b_base_5Geometry,
    materialMap["truck"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_truck_b_base_5.name = "Back truck baseplate";
  if (endpoint_truck_b_base_5) {
    mesh_truck_b_base_5.position.copy(endpoint_truck_b_base_5.midpoint);
    mesh_truck_b_base_5.quaternion.copy(endpoint_truck_b_base_5.quaternion);
  }
  mesh_truck_b_base_5.castShadow = options.castShadow ?? true;
  mesh_truck_b_base_5.receiveShadow = options.receiveShadow ?? true;
  mesh_truck_b_base_5.userData.sculptComponent = {"id": "truck_b_base", "name": "Back truck baseplate", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.35, "height": 0.1, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.28, -1.0], "rotation": [0, 0, 0]}, "material": "truck"};
  node_truck_b_base_5.add(mesh_truck_b_base_5);
  meshes["truck_b_base"] = mesh_truck_b_base_5;
  colliders["truck_b_base"] = {};

  const attachment_truck_b_hanger_6 = null;
  const endpoint_truck_b_hanger_6 = makeAttachmentEndpoint(attachment_truck_b_hanger_6);
  const node_truck_b_hanger_6 = new THREE.Group();
  node_truck_b_hanger_6.name = "Back hanger__pivot";
  if (endpoint_truck_b_hanger_6) {
    node_truck_b_hanger_6.position.copy(endpoint_truck_b_hanger_6.start);
    node_truck_b_hanger_6.rotation.set(0, 0, 0);
    node_truck_b_hanger_6.scale.set(1, 1, 1);
  } else {
    node_truck_b_hanger_6.position.set(0.0, 0.2, -1.0);
    node_truck_b_hanger_6.rotation.set(0.0, 0.0, 0.0);
    node_truck_b_hanger_6.scale.set(0.9, 0.12, 0.18);
  }
  node_truck_b_hanger_6.userData.sculptComponent = {"id": "truck_b_hanger", "name": "Back hanger", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.12, "depth": 0.18, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.2, -1.0], "rotation": [0, 0, 0]}, "material": "truck"};
  node_truck_b_hanger_6.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_truck_b_hanger_6);
  nodes["truck_b_hanger"] = node_truck_b_hanger_6;
  const mesh_truck_b_hanger_6Geometry = endpoint_truck_b_hanger_6
    ? new THREE.CylinderGeometry(endpoint_truck_b_hanger_6.endRadius, endpoint_truck_b_hanger_6.baseRadius, endpoint_truck_b_hanger_6.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_truck_b_hanger_6 = new THREE.Mesh(
    mesh_truck_b_hanger_6Geometry,
    materialMap["truck"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_truck_b_hanger_6.name = "Back hanger";
  if (endpoint_truck_b_hanger_6) {
    mesh_truck_b_hanger_6.position.copy(endpoint_truck_b_hanger_6.midpoint);
    mesh_truck_b_hanger_6.quaternion.copy(endpoint_truck_b_hanger_6.quaternion);
  }
  mesh_truck_b_hanger_6.castShadow = options.castShadow ?? true;
  mesh_truck_b_hanger_6.receiveShadow = options.receiveShadow ?? true;
  mesh_truck_b_hanger_6.userData.sculptComponent = {"id": "truck_b_hanger", "name": "Back hanger", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 0.12, "depth": 0.18, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 0.2, -1.0], "rotation": [0, 0, 0]}, "material": "truck"};
  node_truck_b_hanger_6.add(mesh_truck_b_hanger_6);
  meshes["truck_b_hanger"] = mesh_truck_b_hanger_6;
  colliders["truck_b_hanger"] = {};

  const attachment_wheel_fl_7 = null;
  const endpoint_wheel_fl_7 = makeAttachmentEndpoint(attachment_wheel_fl_7);
  const node_wheel_fl_7 = new THREE.Group();
  node_wheel_fl_7.name = "Wheel__pivot";
  if (endpoint_wheel_fl_7) {
    node_wheel_fl_7.position.copy(endpoint_wheel_fl_7.start);
    node_wheel_fl_7.rotation.set(0, 0, 0);
    node_wheel_fl_7.scale.set(1, 1, 1);
  } else {
    node_wheel_fl_7.position.set(-0.42, 0.15, 1.0);
    node_wheel_fl_7.rotation.set(0.0, 0.0, 1.5708);
    node_wheel_fl_7.scale.set(0.3, 0.16, 0.3);
  }
  node_wheel_fl_7.userData.sculptComponent = {"id": "wheel_fl", "name": "Wheel", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.42, 0.15, 1.0], "rotation": [0, 0, 1.5708]}, "material": "wheel"};
  node_wheel_fl_7.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_wheel_fl_7);
  nodes["wheel_fl"] = node_wheel_fl_7;
  const mesh_wheel_fl_7Geometry = endpoint_wheel_fl_7
    ? new THREE.CylinderGeometry(endpoint_wheel_fl_7.endRadius, endpoint_wheel_fl_7.baseRadius, endpoint_wheel_fl_7.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_wheel_fl_7 = new THREE.Mesh(
    mesh_wheel_fl_7Geometry,
    materialMap["wheel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_fl_7.name = "Wheel";
  if (endpoint_wheel_fl_7) {
    mesh_wheel_fl_7.position.copy(endpoint_wheel_fl_7.midpoint);
    mesh_wheel_fl_7.quaternion.copy(endpoint_wheel_fl_7.quaternion);
  }
  mesh_wheel_fl_7.castShadow = options.castShadow ?? true;
  mesh_wheel_fl_7.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_fl_7.userData.sculptComponent = {"id": "wheel_fl", "name": "Wheel", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.42, 0.15, 1.0], "rotation": [0, 0, 1.5708]}, "material": "wheel"};
  node_wheel_fl_7.add(mesh_wheel_fl_7);
  meshes["wheel_fl"] = mesh_wheel_fl_7;
  colliders["wheel_fl"] = {};

  const attachment_wheel_fr_8 = null;
  const endpoint_wheel_fr_8 = makeAttachmentEndpoint(attachment_wheel_fr_8);
  const node_wheel_fr_8 = new THREE.Group();
  node_wheel_fr_8.name = "Wheel__pivot";
  if (endpoint_wheel_fr_8) {
    node_wheel_fr_8.position.copy(endpoint_wheel_fr_8.start);
    node_wheel_fr_8.rotation.set(0, 0, 0);
    node_wheel_fr_8.scale.set(1, 1, 1);
  } else {
    node_wheel_fr_8.position.set(0.42, 0.15, 1.0);
    node_wheel_fr_8.rotation.set(0.0, 0.0, 1.5708);
    node_wheel_fr_8.scale.set(0.3, 0.16, 0.3);
  }
  node_wheel_fr_8.userData.sculptComponent = {"id": "wheel_fr", "name": "Wheel", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.42, 0.15, 1.0], "rotation": [0, 0, 1.5708]}, "material": "wheel"};
  node_wheel_fr_8.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_wheel_fr_8);
  nodes["wheel_fr"] = node_wheel_fr_8;
  const mesh_wheel_fr_8Geometry = endpoint_wheel_fr_8
    ? new THREE.CylinderGeometry(endpoint_wheel_fr_8.endRadius, endpoint_wheel_fr_8.baseRadius, endpoint_wheel_fr_8.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_wheel_fr_8 = new THREE.Mesh(
    mesh_wheel_fr_8Geometry,
    materialMap["wheel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_fr_8.name = "Wheel";
  if (endpoint_wheel_fr_8) {
    mesh_wheel_fr_8.position.copy(endpoint_wheel_fr_8.midpoint);
    mesh_wheel_fr_8.quaternion.copy(endpoint_wheel_fr_8.quaternion);
  }
  mesh_wheel_fr_8.castShadow = options.castShadow ?? true;
  mesh_wheel_fr_8.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_fr_8.userData.sculptComponent = {"id": "wheel_fr", "name": "Wheel", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.42, 0.15, 1.0], "rotation": [0, 0, 1.5708]}, "material": "wheel"};
  node_wheel_fr_8.add(mesh_wheel_fr_8);
  meshes["wheel_fr"] = mesh_wheel_fr_8;
  colliders["wheel_fr"] = {};

  const attachment_wheel_bl_9 = null;
  const endpoint_wheel_bl_9 = makeAttachmentEndpoint(attachment_wheel_bl_9);
  const node_wheel_bl_9 = new THREE.Group();
  node_wheel_bl_9.name = "Wheel__pivot";
  if (endpoint_wheel_bl_9) {
    node_wheel_bl_9.position.copy(endpoint_wheel_bl_9.start);
    node_wheel_bl_9.rotation.set(0, 0, 0);
    node_wheel_bl_9.scale.set(1, 1, 1);
  } else {
    node_wheel_bl_9.position.set(-0.42, 0.15, -1.0);
    node_wheel_bl_9.rotation.set(0.0, 0.0, 1.5708);
    node_wheel_bl_9.scale.set(0.3, 0.16, 0.3);
  }
  node_wheel_bl_9.userData.sculptComponent = {"id": "wheel_bl", "name": "Wheel", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.42, 0.15, -1.0], "rotation": [0, 0, 1.5708]}, "material": "wheel"};
  node_wheel_bl_9.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_wheel_bl_9);
  nodes["wheel_bl"] = node_wheel_bl_9;
  const mesh_wheel_bl_9Geometry = endpoint_wheel_bl_9
    ? new THREE.CylinderGeometry(endpoint_wheel_bl_9.endRadius, endpoint_wheel_bl_9.baseRadius, endpoint_wheel_bl_9.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_wheel_bl_9 = new THREE.Mesh(
    mesh_wheel_bl_9Geometry,
    materialMap["wheel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_bl_9.name = "Wheel";
  if (endpoint_wheel_bl_9) {
    mesh_wheel_bl_9.position.copy(endpoint_wheel_bl_9.midpoint);
    mesh_wheel_bl_9.quaternion.copy(endpoint_wheel_bl_9.quaternion);
  }
  mesh_wheel_bl_9.castShadow = options.castShadow ?? true;
  mesh_wheel_bl_9.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_bl_9.userData.sculptComponent = {"id": "wheel_bl", "name": "Wheel", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.42, 0.15, -1.0], "rotation": [0, 0, 1.5708]}, "material": "wheel"};
  node_wheel_bl_9.add(mesh_wheel_bl_9);
  meshes["wheel_bl"] = mesh_wheel_bl_9;
  colliders["wheel_bl"] = {};

  const attachment_wheel_br_10 = null;
  const endpoint_wheel_br_10 = makeAttachmentEndpoint(attachment_wheel_br_10);
  const node_wheel_br_10 = new THREE.Group();
  node_wheel_br_10.name = "Wheel__pivot";
  if (endpoint_wheel_br_10) {
    node_wheel_br_10.position.copy(endpoint_wheel_br_10.start);
    node_wheel_br_10.rotation.set(0, 0, 0);
    node_wheel_br_10.scale.set(1, 1, 1);
  } else {
    node_wheel_br_10.position.set(0.42, 0.15, -1.0);
    node_wheel_br_10.rotation.set(0.0, 0.0, 1.5708);
    node_wheel_br_10.scale.set(0.3, 0.16, 0.3);
  }
  node_wheel_br_10.userData.sculptComponent = {"id": "wheel_br", "name": "Wheel", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.42, 0.15, -1.0], "rotation": [0, 0, 1.5708]}, "material": "wheel"};
  node_wheel_br_10.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_wheel_br_10);
  nodes["wheel_br"] = node_wheel_br_10;
  const mesh_wheel_br_10Geometry = endpoint_wheel_br_10
    ? new THREE.CylinderGeometry(endpoint_wheel_br_10.endRadius, endpoint_wheel_br_10.baseRadius, endpoint_wheel_br_10.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_wheel_br_10 = new THREE.Mesh(
    mesh_wheel_br_10Geometry,
    materialMap["wheel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_br_10.name = "Wheel";
  if (endpoint_wheel_br_10) {
    mesh_wheel_br_10.position.copy(endpoint_wheel_br_10.midpoint);
    mesh_wheel_br_10.quaternion.copy(endpoint_wheel_br_10.quaternion);
  }
  mesh_wheel_br_10.castShadow = options.castShadow ?? true;
  mesh_wheel_br_10.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_br_10.userData.sculptComponent = {"id": "wheel_br", "name": "Wheel", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.16, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.42, 0.15, -1.0], "rotation": [0, 0, 1.5708]}, "material": "wheel"};
  node_wheel_br_10.add(mesh_wheel_br_10);
  meshes["wheel_br"] = mesh_wheel_br_10;
  colliders["wheel_br"] = {};

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createSkateboardLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Skateboard look-dev lights";
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
