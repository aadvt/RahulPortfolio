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

// Generated from ObjectSculptSpec target: PCDesk
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createPCDeskModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "PCDesk";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["phantom"] = createSculptMaterial(
    "phantom",
    {"id": "phantom", "name": "Hidden anchor", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#000000", "color": "#000000", "albedo": {"dominant": "#000000", "secondary": ["#000000"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#000000", "#000000"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 1.0, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["walnut"] = createSculptMaterial(
    "walnut",
    {"id": "walnut", "name": "Walnut top", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#6b4a30", "color": "#6b4a30", "albedo": {"dominant": "#6b4a30", "secondary": ["#7a5537", "#4f3622"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#6b4a30", "#7a5537", "#4f3622"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.55, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["walnutdark"] = createSculptMaterial(
    "walnutdark",
    {"id": "walnutdark", "name": "Dark walnut", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#4a3220", "color": "#4a3220", "albedo": {"dominant": "#4a3220", "secondary": ["#4a3220"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#4a3220", "#4a3220"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.7, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["blackmetal"] = createSculptMaterial(
    "blackmetal",
    {"id": "blackmetal", "name": "Black metal", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#1a1a1e", "color": "#1a1a1e", "albedo": {"dominant": "#1a1a1e", "secondary": ["#1a1a1e"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#1a1a1e", "#1a1a1e"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.45, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.6, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["screen"] = createSculptMaterial(
    "screen",
    {"id": "screen", "name": "Screen glow", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#2a4a8e", "color": "#2a4a8e", "albedo": {"dominant": "#2a4a8e", "secondary": ["#22d3ee", "#7c3aed"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#2a4a8e", "#22d3ee", "#7c3aed"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.3, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["spkblack"] = createSculptMaterial(
    "spkblack",
    {"id": "spkblack", "name": "Speaker body", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#141418", "color": "#141418", "albedo": {"dominant": "#141418", "secondary": ["#141418"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#141418", "#141418"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.6, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["cone"] = createSculptMaterial(
    "cone",
    {"id": "cone", "name": "Speaker cone", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#d9b24a", "color": "#d9b24a", "albedo": {"dominant": "#d9b24a", "secondary": ["#d9b24a"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#d9b24a", "#d9b24a"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.5, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["keeb"] = createSculptMaterial(
    "keeb",
    {"id": "keeb", "name": "RGB keyboard", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#1a1a20", "color": "#1a1a20", "albedo": {"dominant": "#1a1a20", "secondary": ["#a855f7", "#22d3ee"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#1a1a20", "#a855f7", "#22d3ee"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.6, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["cloth"] = createSculptMaterial(
    "cloth",
    {"id": "cloth", "name": "Desk mat", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#141418", "color": "#141418", "albedo": {"dominant": "#141418", "secondary": ["#141418"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#141418", "#141418"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.85, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["plastic"] = createSculptMaterial(
    "plastic",
    {"id": "plastic", "name": "Black plastic", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#18181c", "color": "#18181c", "albedo": {"dominant": "#18181c", "secondary": ["#18181c"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#18181c", "#18181c"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.5, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["woodlight"] = createSculptMaterial(
    "woodlight",
    {"id": "woodlight", "name": "Light wood", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#8a5f3d", "color": "#8a5f3d", "albedo": {"dominant": "#8a5f3d", "secondary": ["#8a5f3d"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#8a5f3d", "#8a5f3d"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.7, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["pot"] = createSculptMaterial(
    "pot",
    {"id": "pot", "name": "Ceramic pot", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#3a3a42", "color": "#3a3a42", "albedo": {"dominant": "#3a3a42", "secondary": ["#3a3a42"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#3a3a42", "#3a3a42"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.6, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["green"] = createSculptMaterial(
    "green",
    {"id": "green", "name": "Foliage", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#2f6b45", "color": "#2f6b45", "albedo": {"dominant": "#2f6b45", "secondary": ["#3a8055"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#2f6b45", "#3a8055"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.8, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["mug"] = createSculptMaterial(
    "mug",
    {"id": "mug", "name": "Mug", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#2a2a30", "color": "#2a2a30", "albedo": {"dominant": "#2a2a30", "secondary": ["#2a2a30"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#2a2a30", "#2a2a30"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.5, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["rgb"] = createSculptMaterial(
    "rgb",
    {"id": "rgb", "name": "RGB glow", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#7c3aed", "color": "#7c3aed", "albedo": {"dominant": "#7c3aed", "secondary": ["#3b82f6"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#7c3aed", "#3b82f6"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.3, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["chair"] = createSculptMaterial(
    "chair",
    {"id": "chair", "name": "Chair seat", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#16161a", "color": "#16161a", "albedo": {"dominant": "#16161a", "secondary": ["#16161a"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#16161a", "#16161a"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.7, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
    options
  );
  materialMap["chairmesh"] = createSculptMaterial(
    "chairmesh",
    {"id": "chairmesh", "name": "Chair mesh", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#1c1c22", "color": "#1c1c22", "albedo": {"dominant": "#1c1c22", "secondary": ["#1c1c22"], "samplingNotes": "reference-observed local color zones"}, "colorVariation": {"palette": ["#1c1c22", "#1c1c22"], "pattern": "mottled", "amplitude": 0.12, "heightCorrelation": 0.3}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.4, "role": "broad color/height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.2, "role": "grain, weave, dents, relief"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.07, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.8, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher cavities, smoother worn edges"}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 1.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams"}},
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

  const attachment_desktop_1 = null;
  const endpoint_desktop_1 = makeAttachmentEndpoint(attachment_desktop_1);
  const node_desktop_1 = new THREE.Group();
  node_desktop_1.name = "Walnut desktop__pivot";
  if (endpoint_desktop_1) {
    node_desktop_1.position.copy(endpoint_desktop_1.start);
    node_desktop_1.rotation.set(0, 0, 0);
    node_desktop_1.scale.set(1, 1, 1);
  } else {
    node_desktop_1.position.set(0.0, 1.5, 0.0);
    node_desktop_1.rotation.set(0.0, 0.0, 0.0);
    node_desktop_1.scale.set(4.6, 0.14, 2.2);
  }
  node_desktop_1.userData.sculptComponent = {"id": "desktop", "name": "Walnut desktop", "level": "macro", "role": "body", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 4.6, "height": 0.14, "depth": 2.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 1.5, 0], "rotation": [0, 0, 0]}, "material": "walnut"};
  node_desktop_1.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_desktop_1);
  nodes["desktop"] = node_desktop_1;
  const mesh_desktop_1Geometry = endpoint_desktop_1
    ? new THREE.CylinderGeometry(endpoint_desktop_1.endRadius, endpoint_desktop_1.baseRadius, endpoint_desktop_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_desktop_1 = new THREE.Mesh(
    mesh_desktop_1Geometry,
    materialMap["walnut"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_desktop_1.name = "Walnut desktop";
  if (endpoint_desktop_1) {
    mesh_desktop_1.position.copy(endpoint_desktop_1.midpoint);
    mesh_desktop_1.quaternion.copy(endpoint_desktop_1.quaternion);
  }
  mesh_desktop_1.castShadow = options.castShadow ?? true;
  mesh_desktop_1.receiveShadow = options.receiveShadow ?? true;
  mesh_desktop_1.userData.sculptComponent = {"id": "desktop", "name": "Walnut desktop", "level": "macro", "role": "body", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 4.6, "height": 0.14, "depth": 2.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0, 1.5, 0], "rotation": [0, 0, 0]}, "material": "walnut"};
  node_desktop_1.add(mesh_desktop_1);
  meshes["desktop"] = mesh_desktop_1;
  colliders["desktop"] = {};

  const attachment_leg_fl_2 = null;
  const endpoint_leg_fl_2 = makeAttachmentEndpoint(attachment_leg_fl_2);
  const node_leg_fl_2 = new THREE.Group();
  node_leg_fl_2.name = "Leg front-left__pivot";
  if (endpoint_leg_fl_2) {
    node_leg_fl_2.position.copy(endpoint_leg_fl_2.start);
    node_leg_fl_2.rotation.set(0, 0, 0);
    node_leg_fl_2.scale.set(1, 1, 1);
  } else {
    node_leg_fl_2.position.set(-2.15, 0.75, 0.9);
    node_leg_fl_2.rotation.set(0.0, 0.0, 0.0);
    node_leg_fl_2.scale.set(0.12, 1.5, 0.12);
  }
  node_leg_fl_2.userData.sculptComponent = {"id": "leg_fl", "name": "Leg front-left", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.12, "height": 1.5, "depth": 0.12, "units": "relative", "confidence": 0.7}, "transform": {"position": [-2.15, 0.75, 0.9], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_leg_fl_2.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_leg_fl_2);
  nodes["leg_fl"] = node_leg_fl_2;
  const mesh_leg_fl_2Geometry = endpoint_leg_fl_2
    ? new THREE.CylinderGeometry(endpoint_leg_fl_2.endRadius, endpoint_leg_fl_2.baseRadius, endpoint_leg_fl_2.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_leg_fl_2 = new THREE.Mesh(
    mesh_leg_fl_2Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_fl_2.name = "Leg front-left";
  if (endpoint_leg_fl_2) {
    mesh_leg_fl_2.position.copy(endpoint_leg_fl_2.midpoint);
    mesh_leg_fl_2.quaternion.copy(endpoint_leg_fl_2.quaternion);
  }
  mesh_leg_fl_2.castShadow = options.castShadow ?? true;
  mesh_leg_fl_2.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_fl_2.userData.sculptComponent = {"id": "leg_fl", "name": "Leg front-left", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.12, "height": 1.5, "depth": 0.12, "units": "relative", "confidence": 0.7}, "transform": {"position": [-2.15, 0.75, 0.9], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_leg_fl_2.add(mesh_leg_fl_2);
  meshes["leg_fl"] = mesh_leg_fl_2;
  colliders["leg_fl"] = {};

  const attachment_leg_fr_3 = null;
  const endpoint_leg_fr_3 = makeAttachmentEndpoint(attachment_leg_fr_3);
  const node_leg_fr_3 = new THREE.Group();
  node_leg_fr_3.name = "Leg front-right__pivot";
  if (endpoint_leg_fr_3) {
    node_leg_fr_3.position.copy(endpoint_leg_fr_3.start);
    node_leg_fr_3.rotation.set(0, 0, 0);
    node_leg_fr_3.scale.set(1, 1, 1);
  } else {
    node_leg_fr_3.position.set(2.15, 0.75, 0.9);
    node_leg_fr_3.rotation.set(0.0, 0.0, 0.0);
    node_leg_fr_3.scale.set(0.12, 1.5, 0.12);
  }
  node_leg_fr_3.userData.sculptComponent = {"id": "leg_fr", "name": "Leg front-right", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.12, "height": 1.5, "depth": 0.12, "units": "relative", "confidence": 0.7}, "transform": {"position": [2.15, 0.75, 0.9], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_leg_fr_3.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_leg_fr_3);
  nodes["leg_fr"] = node_leg_fr_3;
  const mesh_leg_fr_3Geometry = endpoint_leg_fr_3
    ? new THREE.CylinderGeometry(endpoint_leg_fr_3.endRadius, endpoint_leg_fr_3.baseRadius, endpoint_leg_fr_3.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_leg_fr_3 = new THREE.Mesh(
    mesh_leg_fr_3Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_fr_3.name = "Leg front-right";
  if (endpoint_leg_fr_3) {
    mesh_leg_fr_3.position.copy(endpoint_leg_fr_3.midpoint);
    mesh_leg_fr_3.quaternion.copy(endpoint_leg_fr_3.quaternion);
  }
  mesh_leg_fr_3.castShadow = options.castShadow ?? true;
  mesh_leg_fr_3.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_fr_3.userData.sculptComponent = {"id": "leg_fr", "name": "Leg front-right", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.12, "height": 1.5, "depth": 0.12, "units": "relative", "confidence": 0.7}, "transform": {"position": [2.15, 0.75, 0.9], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_leg_fr_3.add(mesh_leg_fr_3);
  meshes["leg_fr"] = mesh_leg_fr_3;
  colliders["leg_fr"] = {};

  const attachment_leg_bl_4 = null;
  const endpoint_leg_bl_4 = makeAttachmentEndpoint(attachment_leg_bl_4);
  const node_leg_bl_4 = new THREE.Group();
  node_leg_bl_4.name = "Leg back-left__pivot";
  if (endpoint_leg_bl_4) {
    node_leg_bl_4.position.copy(endpoint_leg_bl_4.start);
    node_leg_bl_4.rotation.set(0, 0, 0);
    node_leg_bl_4.scale.set(1, 1, 1);
  } else {
    node_leg_bl_4.position.set(-2.15, 0.75, -0.9);
    node_leg_bl_4.rotation.set(0.0, 0.0, 0.0);
    node_leg_bl_4.scale.set(0.12, 1.5, 0.12);
  }
  node_leg_bl_4.userData.sculptComponent = {"id": "leg_bl", "name": "Leg back-left", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.12, "height": 1.5, "depth": 0.12, "units": "relative", "confidence": 0.7}, "transform": {"position": [-2.15, 0.75, -0.9], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_leg_bl_4.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_leg_bl_4);
  nodes["leg_bl"] = node_leg_bl_4;
  const mesh_leg_bl_4Geometry = endpoint_leg_bl_4
    ? new THREE.CylinderGeometry(endpoint_leg_bl_4.endRadius, endpoint_leg_bl_4.baseRadius, endpoint_leg_bl_4.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_leg_bl_4 = new THREE.Mesh(
    mesh_leg_bl_4Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_bl_4.name = "Leg back-left";
  if (endpoint_leg_bl_4) {
    mesh_leg_bl_4.position.copy(endpoint_leg_bl_4.midpoint);
    mesh_leg_bl_4.quaternion.copy(endpoint_leg_bl_4.quaternion);
  }
  mesh_leg_bl_4.castShadow = options.castShadow ?? true;
  mesh_leg_bl_4.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_bl_4.userData.sculptComponent = {"id": "leg_bl", "name": "Leg back-left", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.12, "height": 1.5, "depth": 0.12, "units": "relative", "confidence": 0.7}, "transform": {"position": [-2.15, 0.75, -0.9], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_leg_bl_4.add(mesh_leg_bl_4);
  meshes["leg_bl"] = mesh_leg_bl_4;
  colliders["leg_bl"] = {};

  const attachment_leg_br_5 = null;
  const endpoint_leg_br_5 = makeAttachmentEndpoint(attachment_leg_br_5);
  const node_leg_br_5 = new THREE.Group();
  node_leg_br_5.name = "Leg back-right__pivot";
  if (endpoint_leg_br_5) {
    node_leg_br_5.position.copy(endpoint_leg_br_5.start);
    node_leg_br_5.rotation.set(0, 0, 0);
    node_leg_br_5.scale.set(1, 1, 1);
  } else {
    node_leg_br_5.position.set(2.15, 0.75, -0.9);
    node_leg_br_5.rotation.set(0.0, 0.0, 0.0);
    node_leg_br_5.scale.set(0.12, 1.5, 0.12);
  }
  node_leg_br_5.userData.sculptComponent = {"id": "leg_br", "name": "Leg back-right", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.12, "height": 1.5, "depth": 0.12, "units": "relative", "confidence": 0.7}, "transform": {"position": [2.15, 0.75, -0.9], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_leg_br_5.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_leg_br_5);
  nodes["leg_br"] = node_leg_br_5;
  const mesh_leg_br_5Geometry = endpoint_leg_br_5
    ? new THREE.CylinderGeometry(endpoint_leg_br_5.endRadius, endpoint_leg_br_5.baseRadius, endpoint_leg_br_5.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_leg_br_5 = new THREE.Mesh(
    mesh_leg_br_5Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_leg_br_5.name = "Leg back-right";
  if (endpoint_leg_br_5) {
    mesh_leg_br_5.position.copy(endpoint_leg_br_5.midpoint);
    mesh_leg_br_5.quaternion.copy(endpoint_leg_br_5.quaternion);
  }
  mesh_leg_br_5.castShadow = options.castShadow ?? true;
  mesh_leg_br_5.receiveShadow = options.receiveShadow ?? true;
  mesh_leg_br_5.userData.sculptComponent = {"id": "leg_br", "name": "Leg back-right", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.12, "height": 1.5, "depth": 0.12, "units": "relative", "confidence": 0.7}, "transform": {"position": [2.15, 0.75, -0.9], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_leg_br_5.add(mesh_leg_br_5);
  meshes["leg_br"] = mesh_leg_br_5;
  colliders["leg_br"] = {};

  const attachment_drawers_6 = null;
  const endpoint_drawers_6 = makeAttachmentEndpoint(attachment_drawers_6);
  const node_drawers_6 = new THREE.Group();
  node_drawers_6.name = "Drawer unit__pivot";
  if (endpoint_drawers_6) {
    node_drawers_6.position.copy(endpoint_drawers_6.start);
    node_drawers_6.rotation.set(0, 0, 0);
    node_drawers_6.scale.set(1, 1, 1);
  } else {
    node_drawers_6.position.set(-1.5, 0.9, 0.0);
    node_drawers_6.rotation.set(0.0, 0.0, 0.0);
    node_drawers_6.scale.set(1.1, 1.2, 1.9);
  }
  node_drawers_6.userData.sculptComponent = {"id": "drawers", "name": "Drawer unit", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.1, "height": 1.2, "depth": 1.9, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.5, 0.9, 0], "rotation": [0, 0, 0]}, "material": "walnutdark"};
  node_drawers_6.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_drawers_6);
  nodes["drawers"] = node_drawers_6;
  const mesh_drawers_6Geometry = endpoint_drawers_6
    ? new THREE.CylinderGeometry(endpoint_drawers_6.endRadius, endpoint_drawers_6.baseRadius, endpoint_drawers_6.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_drawers_6 = new THREE.Mesh(
    mesh_drawers_6Geometry,
    materialMap["walnutdark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_drawers_6.name = "Drawer unit";
  if (endpoint_drawers_6) {
    mesh_drawers_6.position.copy(endpoint_drawers_6.midpoint);
    mesh_drawers_6.quaternion.copy(endpoint_drawers_6.quaternion);
  }
  mesh_drawers_6.castShadow = options.castShadow ?? true;
  mesh_drawers_6.receiveShadow = options.receiveShadow ?? true;
  mesh_drawers_6.userData.sculptComponent = {"id": "drawers", "name": "Drawer unit", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.1, "height": 1.2, "depth": 1.9, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.5, 0.9, 0], "rotation": [0, 0, 0]}, "material": "walnutdark"};
  node_drawers_6.add(mesh_drawers_6);
  meshes["drawers"] = mesh_drawers_6;
  colliders["drawers"] = {};

  const attachment_mon_stand_7 = null;
  const endpoint_mon_stand_7 = makeAttachmentEndpoint(attachment_mon_stand_7);
  const node_mon_stand_7 = new THREE.Group();
  node_mon_stand_7.name = "Monitor stand__pivot";
  if (endpoint_mon_stand_7) {
    node_mon_stand_7.position.copy(endpoint_mon_stand_7.start);
    node_mon_stand_7.rotation.set(0, 0, 0);
    node_mon_stand_7.scale.set(1, 1, 1);
  } else {
    node_mon_stand_7.position.set(0.2, 1.85, -0.7);
    node_mon_stand_7.rotation.set(0.0, 0.0, 0.0);
    node_mon_stand_7.scale.set(0.3, 0.5, 0.2);
  }
  node_mon_stand_7.userData.sculptComponent = {"id": "mon_stand", "name": "Monitor stand", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.5, "depth": 0.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.2, 1.85, -0.7], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_mon_stand_7.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_mon_stand_7);
  nodes["mon_stand"] = node_mon_stand_7;
  const mesh_mon_stand_7Geometry = endpoint_mon_stand_7
    ? new THREE.CylinderGeometry(endpoint_mon_stand_7.endRadius, endpoint_mon_stand_7.baseRadius, endpoint_mon_stand_7.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_mon_stand_7 = new THREE.Mesh(
    mesh_mon_stand_7Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mon_stand_7.name = "Monitor stand";
  if (endpoint_mon_stand_7) {
    mesh_mon_stand_7.position.copy(endpoint_mon_stand_7.midpoint);
    mesh_mon_stand_7.quaternion.copy(endpoint_mon_stand_7.quaternion);
  }
  mesh_mon_stand_7.castShadow = options.castShadow ?? true;
  mesh_mon_stand_7.receiveShadow = options.receiveShadow ?? true;
  mesh_mon_stand_7.userData.sculptComponent = {"id": "mon_stand", "name": "Monitor stand", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.5, "depth": 0.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.2, 1.85, -0.7], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_mon_stand_7.add(mesh_mon_stand_7);
  meshes["mon_stand"] = mesh_mon_stand_7;
  colliders["mon_stand"] = {};

  const attachment_mon_screen_8 = null;
  const endpoint_mon_screen_8 = makeAttachmentEndpoint(attachment_mon_screen_8);
  const node_mon_screen_8 = new THREE.Group();
  node_mon_screen_8.name = "Monitor (editing timeline)__pivot";
  if (endpoint_mon_screen_8) {
    node_mon_screen_8.position.copy(endpoint_mon_screen_8.start);
    node_mon_screen_8.rotation.set(0, 0, 0);
    node_mon_screen_8.scale.set(1, 1, 1);
  } else {
    node_mon_screen_8.position.set(0.2, 2.5, -0.75);
    node_mon_screen_8.rotation.set(0.0, 0.0, 0.0);
    node_mon_screen_8.scale.set(2.6, 1.5, 0.1);
  }
  node_mon_screen_8.userData.sculptComponent = {"id": "mon_screen", "name": "Monitor (editing timeline)", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 2.6, "height": 1.5, "depth": 0.1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.2, 2.5, -0.75], "rotation": [0, 0, 0]}, "material": "screen"};
  node_mon_screen_8.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_mon_screen_8);
  nodes["mon_screen"] = node_mon_screen_8;
  const mesh_mon_screen_8Geometry = endpoint_mon_screen_8
    ? new THREE.CylinderGeometry(endpoint_mon_screen_8.endRadius, endpoint_mon_screen_8.baseRadius, endpoint_mon_screen_8.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_mon_screen_8 = new THREE.Mesh(
    mesh_mon_screen_8Geometry,
    materialMap["screen"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mon_screen_8.name = "Monitor (editing timeline)";
  if (endpoint_mon_screen_8) {
    mesh_mon_screen_8.position.copy(endpoint_mon_screen_8.midpoint);
    mesh_mon_screen_8.quaternion.copy(endpoint_mon_screen_8.quaternion);
  }
  mesh_mon_screen_8.castShadow = options.castShadow ?? true;
  mesh_mon_screen_8.receiveShadow = options.receiveShadow ?? true;
  mesh_mon_screen_8.userData.sculptComponent = {"id": "mon_screen", "name": "Monitor (editing timeline)", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 2.6, "height": 1.5, "depth": 0.1, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.2, 2.5, -0.75], "rotation": [0, 0, 0]}, "material": "screen"};
  node_mon_screen_8.add(mesh_mon_screen_8);
  meshes["mon_screen"] = mesh_mon_screen_8;
  colliders["mon_screen"] = {};

  const attachment_spk_l_9 = null;
  const endpoint_spk_l_9 = makeAttachmentEndpoint(attachment_spk_l_9);
  const node_spk_l_9 = new THREE.Group();
  node_spk_l_9.name = "Speaker left__pivot";
  if (endpoint_spk_l_9) {
    node_spk_l_9.position.copy(endpoint_spk_l_9.start);
    node_spk_l_9.rotation.set(0, 0, 0);
    node_spk_l_9.scale.set(1, 1, 1);
  } else {
    node_spk_l_9.position.set(-1.4, 1.95, -0.5);
    node_spk_l_9.rotation.set(0.0, 0.0, 0.0);
    node_spk_l_9.scale.set(0.5, 0.8, 0.5);
  }
  node_spk_l_9.userData.sculptComponent = {"id": "spk_l", "name": "Speaker left", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.8, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.4, 1.95, -0.5], "rotation": [0, 0, 0]}, "material": "spkblack"};
  node_spk_l_9.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_spk_l_9);
  nodes["spk_l"] = node_spk_l_9;
  const mesh_spk_l_9Geometry = endpoint_spk_l_9
    ? new THREE.CylinderGeometry(endpoint_spk_l_9.endRadius, endpoint_spk_l_9.baseRadius, endpoint_spk_l_9.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_spk_l_9 = new THREE.Mesh(
    mesh_spk_l_9Geometry,
    materialMap["spkblack"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_spk_l_9.name = "Speaker left";
  if (endpoint_spk_l_9) {
    mesh_spk_l_9.position.copy(endpoint_spk_l_9.midpoint);
    mesh_spk_l_9.quaternion.copy(endpoint_spk_l_9.quaternion);
  }
  mesh_spk_l_9.castShadow = options.castShadow ?? true;
  mesh_spk_l_9.receiveShadow = options.receiveShadow ?? true;
  mesh_spk_l_9.userData.sculptComponent = {"id": "spk_l", "name": "Speaker left", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.8, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.4, 1.95, -0.5], "rotation": [0, 0, 0]}, "material": "spkblack"};
  node_spk_l_9.add(mesh_spk_l_9);
  meshes["spk_l"] = mesh_spk_l_9;
  colliders["spk_l"] = {};

  const attachment_spk_l_cone_10 = null;
  const endpoint_spk_l_cone_10 = makeAttachmentEndpoint(attachment_spk_l_cone_10);
  const node_spk_l_cone_10 = new THREE.Group();
  node_spk_l_cone_10.name = "Speaker cone left__pivot";
  if (endpoint_spk_l_cone_10) {
    node_spk_l_cone_10.position.copy(endpoint_spk_l_cone_10.start);
    node_spk_l_cone_10.rotation.set(0, 0, 0);
    node_spk_l_cone_10.scale.set(1, 1, 1);
  } else {
    node_spk_l_cone_10.position.set(-1.4, 1.85, -0.23);
    node_spk_l_cone_10.rotation.set(1.5708, 0.0, 0.0);
    node_spk_l_cone_10.scale.set(0.28, 0.1, 0.28);
  }
  node_spk_l_cone_10.userData.sculptComponent = {"id": "spk_l_cone", "name": "Speaker cone left", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.28, "height": 0.1, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.4, 1.85, -0.23], "rotation": [1.5708, 0, 0]}, "material": "cone"};
  node_spk_l_cone_10.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_spk_l_cone_10);
  nodes["spk_l_cone"] = node_spk_l_cone_10;
  const mesh_spk_l_cone_10Geometry = endpoint_spk_l_cone_10
    ? new THREE.CylinderGeometry(endpoint_spk_l_cone_10.endRadius, endpoint_spk_l_cone_10.baseRadius, endpoint_spk_l_cone_10.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_spk_l_cone_10 = new THREE.Mesh(
    mesh_spk_l_cone_10Geometry,
    materialMap["cone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_spk_l_cone_10.name = "Speaker cone left";
  if (endpoint_spk_l_cone_10) {
    mesh_spk_l_cone_10.position.copy(endpoint_spk_l_cone_10.midpoint);
    mesh_spk_l_cone_10.quaternion.copy(endpoint_spk_l_cone_10.quaternion);
  }
  mesh_spk_l_cone_10.castShadow = options.castShadow ?? true;
  mesh_spk_l_cone_10.receiveShadow = options.receiveShadow ?? true;
  mesh_spk_l_cone_10.userData.sculptComponent = {"id": "spk_l_cone", "name": "Speaker cone left", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.28, "height": 0.1, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.4, 1.85, -0.23], "rotation": [1.5708, 0, 0]}, "material": "cone"};
  node_spk_l_cone_10.add(mesh_spk_l_cone_10);
  meshes["spk_l_cone"] = mesh_spk_l_cone_10;
  colliders["spk_l_cone"] = {};

  const attachment_spk_r_11 = null;
  const endpoint_spk_r_11 = makeAttachmentEndpoint(attachment_spk_r_11);
  const node_spk_r_11 = new THREE.Group();
  node_spk_r_11.name = "Speaker right__pivot";
  if (endpoint_spk_r_11) {
    node_spk_r_11.position.copy(endpoint_spk_r_11.start);
    node_spk_r_11.rotation.set(0, 0, 0);
    node_spk_r_11.scale.set(1, 1, 1);
  } else {
    node_spk_r_11.position.set(1.7, 1.95, -0.5);
    node_spk_r_11.rotation.set(0.0, 0.0, 0.0);
    node_spk_r_11.scale.set(0.5, 0.8, 0.5);
  }
  node_spk_r_11.userData.sculptComponent = {"id": "spk_r", "name": "Speaker right", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.8, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.7, 1.95, -0.5], "rotation": [0, 0, 0]}, "material": "spkblack"};
  node_spk_r_11.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_spk_r_11);
  nodes["spk_r"] = node_spk_r_11;
  const mesh_spk_r_11Geometry = endpoint_spk_r_11
    ? new THREE.CylinderGeometry(endpoint_spk_r_11.endRadius, endpoint_spk_r_11.baseRadius, endpoint_spk_r_11.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_spk_r_11 = new THREE.Mesh(
    mesh_spk_r_11Geometry,
    materialMap["spkblack"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_spk_r_11.name = "Speaker right";
  if (endpoint_spk_r_11) {
    mesh_spk_r_11.position.copy(endpoint_spk_r_11.midpoint);
    mesh_spk_r_11.quaternion.copy(endpoint_spk_r_11.quaternion);
  }
  mesh_spk_r_11.castShadow = options.castShadow ?? true;
  mesh_spk_r_11.receiveShadow = options.receiveShadow ?? true;
  mesh_spk_r_11.userData.sculptComponent = {"id": "spk_r", "name": "Speaker right", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.8, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.7, 1.95, -0.5], "rotation": [0, 0, 0]}, "material": "spkblack"};
  node_spk_r_11.add(mesh_spk_r_11);
  meshes["spk_r"] = mesh_spk_r_11;
  colliders["spk_r"] = {};

  const attachment_spk_r_cone_12 = null;
  const endpoint_spk_r_cone_12 = makeAttachmentEndpoint(attachment_spk_r_cone_12);
  const node_spk_r_cone_12 = new THREE.Group();
  node_spk_r_cone_12.name = "Speaker cone right__pivot";
  if (endpoint_spk_r_cone_12) {
    node_spk_r_cone_12.position.copy(endpoint_spk_r_cone_12.start);
    node_spk_r_cone_12.rotation.set(0, 0, 0);
    node_spk_r_cone_12.scale.set(1, 1, 1);
  } else {
    node_spk_r_cone_12.position.set(1.7, 1.85, -0.23);
    node_spk_r_cone_12.rotation.set(1.5708, 0.0, 0.0);
    node_spk_r_cone_12.scale.set(0.28, 0.1, 0.28);
  }
  node_spk_r_cone_12.userData.sculptComponent = {"id": "spk_r_cone", "name": "Speaker cone right", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.28, "height": 0.1, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.7, 1.85, -0.23], "rotation": [1.5708, 0, 0]}, "material": "cone"};
  node_spk_r_cone_12.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_spk_r_cone_12);
  nodes["spk_r_cone"] = node_spk_r_cone_12;
  const mesh_spk_r_cone_12Geometry = endpoint_spk_r_cone_12
    ? new THREE.CylinderGeometry(endpoint_spk_r_cone_12.endRadius, endpoint_spk_r_cone_12.baseRadius, endpoint_spk_r_cone_12.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_spk_r_cone_12 = new THREE.Mesh(
    mesh_spk_r_cone_12Geometry,
    materialMap["cone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_spk_r_cone_12.name = "Speaker cone right";
  if (endpoint_spk_r_cone_12) {
    mesh_spk_r_cone_12.position.copy(endpoint_spk_r_cone_12.midpoint);
    mesh_spk_r_cone_12.quaternion.copy(endpoint_spk_r_cone_12.quaternion);
  }
  mesh_spk_r_cone_12.castShadow = options.castShadow ?? true;
  mesh_spk_r_cone_12.receiveShadow = options.receiveShadow ?? true;
  mesh_spk_r_cone_12.userData.sculptComponent = {"id": "spk_r_cone", "name": "Speaker cone right", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.28, "height": 0.1, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.7, 1.85, -0.23], "rotation": [1.5708, 0, 0]}, "material": "cone"};
  node_spk_r_cone_12.add(mesh_spk_r_cone_12);
  meshes["spk_r_cone"] = mesh_spk_r_cone_12;
  colliders["spk_r_cone"] = {};

  const attachment_keyboard_13 = null;
  const endpoint_keyboard_13 = makeAttachmentEndpoint(attachment_keyboard_13);
  const node_keyboard_13 = new THREE.Group();
  node_keyboard_13.name = "RGB keyboard__pivot";
  if (endpoint_keyboard_13) {
    node_keyboard_13.position.copy(endpoint_keyboard_13.start);
    node_keyboard_13.rotation.set(0, 0, 0);
    node_keyboard_13.scale.set(1, 1, 1);
  } else {
    node_keyboard_13.position.set(0.1, 1.6, 0.5);
    node_keyboard_13.rotation.set(0.0, 0.0, 0.0);
    node_keyboard_13.scale.set(1.6, 0.08, 0.5);
  }
  node_keyboard_13.userData.sculptComponent = {"id": "keyboard", "name": "RGB keyboard", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.6, "height": 0.08, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1, 1.6, 0.5], "rotation": [0, 0, 0]}, "material": "keeb"};
  node_keyboard_13.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_keyboard_13);
  nodes["keyboard"] = node_keyboard_13;
  const mesh_keyboard_13Geometry = endpoint_keyboard_13
    ? new THREE.CylinderGeometry(endpoint_keyboard_13.endRadius, endpoint_keyboard_13.baseRadius, endpoint_keyboard_13.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_keyboard_13 = new THREE.Mesh(
    mesh_keyboard_13Geometry,
    materialMap["keeb"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_keyboard_13.name = "RGB keyboard";
  if (endpoint_keyboard_13) {
    mesh_keyboard_13.position.copy(endpoint_keyboard_13.midpoint);
    mesh_keyboard_13.quaternion.copy(endpoint_keyboard_13.quaternion);
  }
  mesh_keyboard_13.castShadow = options.castShadow ?? true;
  mesh_keyboard_13.receiveShadow = options.receiveShadow ?? true;
  mesh_keyboard_13.userData.sculptComponent = {"id": "keyboard", "name": "RGB keyboard", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.6, "height": 0.08, "depth": 0.5, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1, 1.6, 0.5], "rotation": [0, 0, 0]}, "material": "keeb"};
  node_keyboard_13.add(mesh_keyboard_13);
  meshes["keyboard"] = mesh_keyboard_13;
  colliders["keyboard"] = {};

  const attachment_mousepad_14 = null;
  const endpoint_mousepad_14 = makeAttachmentEndpoint(attachment_mousepad_14);
  const node_mousepad_14 = new THREE.Group();
  node_mousepad_14.name = "Mouse pad__pivot";
  if (endpoint_mousepad_14) {
    node_mousepad_14.position.copy(endpoint_mousepad_14.start);
    node_mousepad_14.rotation.set(0, 0, 0);
    node_mousepad_14.scale.set(1, 1, 1);
  } else {
    node_mousepad_14.position.set(1.2, 1.575, 0.55);
    node_mousepad_14.rotation.set(0.0, 0.0, 0.0);
    node_mousepad_14.scale.set(1.2, 0.02, 0.85);
  }
  node_mousepad_14.userData.sculptComponent = {"id": "mousepad", "name": "Mouse pad", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.2, "height": 0.02, "depth": 0.85, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.2, 1.575, 0.55], "rotation": [0, 0, 0]}, "material": "cloth"};
  node_mousepad_14.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_mousepad_14);
  nodes["mousepad"] = node_mousepad_14;
  const mesh_mousepad_14Geometry = endpoint_mousepad_14
    ? new THREE.CylinderGeometry(endpoint_mousepad_14.endRadius, endpoint_mousepad_14.baseRadius, endpoint_mousepad_14.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_mousepad_14 = new THREE.Mesh(
    mesh_mousepad_14Geometry,
    materialMap["cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mousepad_14.name = "Mouse pad";
  if (endpoint_mousepad_14) {
    mesh_mousepad_14.position.copy(endpoint_mousepad_14.midpoint);
    mesh_mousepad_14.quaternion.copy(endpoint_mousepad_14.quaternion);
  }
  mesh_mousepad_14.castShadow = options.castShadow ?? true;
  mesh_mousepad_14.receiveShadow = options.receiveShadow ?? true;
  mesh_mousepad_14.userData.sculptComponent = {"id": "mousepad", "name": "Mouse pad", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.2, "height": 0.02, "depth": 0.85, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.2, 1.575, 0.55], "rotation": [0, 0, 0]}, "material": "cloth"};
  node_mousepad_14.add(mesh_mousepad_14);
  meshes["mousepad"] = mesh_mousepad_14;
  colliders["mousepad"] = {};

  const attachment_mouse_15 = null;
  const endpoint_mouse_15 = makeAttachmentEndpoint(attachment_mouse_15);
  const node_mouse_15 = new THREE.Group();
  node_mouse_15.name = "Mouse__pivot";
  if (endpoint_mouse_15) {
    node_mouse_15.position.copy(endpoint_mouse_15.start);
    node_mouse_15.rotation.set(0, 0, 0);
    node_mouse_15.scale.set(1, 1, 1);
  } else {
    node_mouse_15.position.set(1.2, 1.63, 0.55);
    node_mouse_15.rotation.set(0.0, 0.0, 0.0);
    node_mouse_15.scale.set(0.22, 0.08, 0.36);
  }
  node_mouse_15.userData.sculptComponent = {"id": "mouse", "name": "Mouse", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.22, "height": 0.08, "depth": 0.36, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.2, 1.63, 0.55], "rotation": [0, 0, 0]}, "material": "plastic"};
  node_mouse_15.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_mouse_15);
  nodes["mouse"] = node_mouse_15;
  const mesh_mouse_15Geometry = endpoint_mouse_15
    ? new THREE.CylinderGeometry(endpoint_mouse_15.endRadius, endpoint_mouse_15.baseRadius, endpoint_mouse_15.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_mouse_15 = new THREE.Mesh(
    mesh_mouse_15Geometry,
    materialMap["plastic"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mouse_15.name = "Mouse";
  if (endpoint_mouse_15) {
    mesh_mouse_15.position.copy(endpoint_mouse_15.midpoint);
    mesh_mouse_15.quaternion.copy(endpoint_mouse_15.quaternion);
  }
  mesh_mouse_15.castShadow = options.castShadow ?? true;
  mesh_mouse_15.receiveShadow = options.receiveShadow ?? true;
  mesh_mouse_15.userData.sculptComponent = {"id": "mouse", "name": "Mouse", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.22, "height": 0.08, "depth": 0.36, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.2, 1.63, 0.55], "rotation": [0, 0, 0]}, "material": "plastic"};
  node_mouse_15.add(mesh_mouse_15);
  meshes["mouse"] = mesh_mouse_15;
  colliders["mouse"] = {};

  const attachment_lamp_base_16 = null;
  const endpoint_lamp_base_16 = makeAttachmentEndpoint(attachment_lamp_base_16);
  const node_lamp_base_16 = new THREE.Group();
  node_lamp_base_16.name = "Lamp base__pivot";
  if (endpoint_lamp_base_16) {
    node_lamp_base_16.position.copy(endpoint_lamp_base_16.start);
    node_lamp_base_16.rotation.set(0, 0, 0);
    node_lamp_base_16.scale.set(1, 1, 1);
  } else {
    node_lamp_base_16.position.set(-2.0, 1.6, -0.3);
    node_lamp_base_16.rotation.set(0.0, 0.0, 0.0);
    node_lamp_base_16.scale.set(0.32, 0.08, 0.32);
  }
  node_lamp_base_16.userData.sculptComponent = {"id": "lamp_base", "name": "Lamp base", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.32, "height": 0.08, "depth": 0.32, "units": "relative", "confidence": 0.7}, "transform": {"position": [-2.0, 1.6, -0.3], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_lamp_base_16.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_lamp_base_16);
  nodes["lamp_base"] = node_lamp_base_16;
  const mesh_lamp_base_16Geometry = endpoint_lamp_base_16
    ? new THREE.CylinderGeometry(endpoint_lamp_base_16.endRadius, endpoint_lamp_base_16.baseRadius, endpoint_lamp_base_16.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_lamp_base_16 = new THREE.Mesh(
    mesh_lamp_base_16Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lamp_base_16.name = "Lamp base";
  if (endpoint_lamp_base_16) {
    mesh_lamp_base_16.position.copy(endpoint_lamp_base_16.midpoint);
    mesh_lamp_base_16.quaternion.copy(endpoint_lamp_base_16.quaternion);
  }
  mesh_lamp_base_16.castShadow = options.castShadow ?? true;
  mesh_lamp_base_16.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_base_16.userData.sculptComponent = {"id": "lamp_base", "name": "Lamp base", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.32, "height": 0.08, "depth": 0.32, "units": "relative", "confidence": 0.7}, "transform": {"position": [-2.0, 1.6, -0.3], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_lamp_base_16.add(mesh_lamp_base_16);
  meshes["lamp_base"] = mesh_lamp_base_16;
  colliders["lamp_base"] = {};

  const attachment_lamp_arm_17 = null;
  const endpoint_lamp_arm_17 = makeAttachmentEndpoint(attachment_lamp_arm_17);
  const node_lamp_arm_17 = new THREE.Group();
  node_lamp_arm_17.name = "Lamp arm__pivot";
  if (endpoint_lamp_arm_17) {
    node_lamp_arm_17.position.copy(endpoint_lamp_arm_17.start);
    node_lamp_arm_17.rotation.set(0, 0, 0);
    node_lamp_arm_17.scale.set(1, 1, 1);
  } else {
    node_lamp_arm_17.position.set(-1.9, 1.95, -0.2);
    node_lamp_arm_17.rotation.set(0.0, 0.0, -0.5);
    node_lamp_arm_17.scale.set(0.06, 0.9, 0.06);
  }
  node_lamp_arm_17.userData.sculptComponent = {"id": "lamp_arm", "name": "Lamp arm", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.06, "height": 0.9, "depth": 0.06, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.9, 1.95, -0.2], "rotation": [0, 0, -0.5]}, "material": "blackmetal"};
  node_lamp_arm_17.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_lamp_arm_17);
  nodes["lamp_arm"] = node_lamp_arm_17;
  const mesh_lamp_arm_17Geometry = endpoint_lamp_arm_17
    ? new THREE.CylinderGeometry(endpoint_lamp_arm_17.endRadius, endpoint_lamp_arm_17.baseRadius, endpoint_lamp_arm_17.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_lamp_arm_17 = new THREE.Mesh(
    mesh_lamp_arm_17Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lamp_arm_17.name = "Lamp arm";
  if (endpoint_lamp_arm_17) {
    mesh_lamp_arm_17.position.copy(endpoint_lamp_arm_17.midpoint);
    mesh_lamp_arm_17.quaternion.copy(endpoint_lamp_arm_17.quaternion);
  }
  mesh_lamp_arm_17.castShadow = options.castShadow ?? true;
  mesh_lamp_arm_17.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_arm_17.userData.sculptComponent = {"id": "lamp_arm", "name": "Lamp arm", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.06, "height": 0.9, "depth": 0.06, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.9, 1.95, -0.2], "rotation": [0, 0, -0.5]}, "material": "blackmetal"};
  node_lamp_arm_17.add(mesh_lamp_arm_17);
  meshes["lamp_arm"] = mesh_lamp_arm_17;
  colliders["lamp_arm"] = {};

  const attachment_lamp_head_18 = null;
  const endpoint_lamp_head_18 = makeAttachmentEndpoint(attachment_lamp_head_18);
  const node_lamp_head_18 = new THREE.Group();
  node_lamp_head_18.name = "Lamp head__pivot";
  if (endpoint_lamp_head_18) {
    node_lamp_head_18.position.copy(endpoint_lamp_head_18.start);
    node_lamp_head_18.rotation.set(0, 0, 0);
    node_lamp_head_18.scale.set(1, 1, 1);
  } else {
    node_lamp_head_18.position.set(-1.7, 2.2, 0.1);
    node_lamp_head_18.rotation.set(1.0, 0.0, 0.0);
    node_lamp_head_18.scale.set(0.36, 0.4, 0.36);
  }
  node_lamp_head_18.userData.sculptComponent = {"id": "lamp_head", "name": "Lamp head", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.36, "height": 0.4, "depth": 0.36, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.7, 2.2, 0.1], "rotation": [1.0, 0, 0]}, "material": "blackmetal"};
  node_lamp_head_18.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_lamp_head_18);
  nodes["lamp_head"] = node_lamp_head_18;
  const mesh_lamp_head_18Geometry = endpoint_lamp_head_18
    ? new THREE.CylinderGeometry(endpoint_lamp_head_18.endRadius, endpoint_lamp_head_18.baseRadius, endpoint_lamp_head_18.length, 32, 12)
    : new THREE.ConeGeometry(0.5, 1, 48, 16);
  const mesh_lamp_head_18 = new THREE.Mesh(
    mesh_lamp_head_18Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lamp_head_18.name = "Lamp head";
  if (endpoint_lamp_head_18) {
    mesh_lamp_head_18.position.copy(endpoint_lamp_head_18.midpoint);
    mesh_lamp_head_18.quaternion.copy(endpoint_lamp_head_18.quaternion);
  }
  mesh_lamp_head_18.castShadow = options.castShadow ?? true;
  mesh_lamp_head_18.receiveShadow = options.receiveShadow ?? true;
  mesh_lamp_head_18.userData.sculptComponent = {"id": "lamp_head", "name": "Lamp head", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.36, "height": 0.4, "depth": 0.36, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.7, 2.2, 0.1], "rotation": [1.0, 0, 0]}, "material": "blackmetal"};
  node_lamp_head_18.add(mesh_lamp_head_18);
  meshes["lamp_head"] = mesh_lamp_head_18;
  colliders["lamp_head"] = {};

  const attachment_penholder_19 = null;
  const endpoint_penholder_19 = makeAttachmentEndpoint(attachment_penholder_19);
  const node_penholder_19 = new THREE.Group();
  node_penholder_19.name = "Pen holder__pivot";
  if (endpoint_penholder_19) {
    node_penholder_19.position.copy(endpoint_penholder_19.start);
    node_penholder_19.rotation.set(0, 0, 0);
    node_penholder_19.scale.set(1, 1, 1);
  } else {
    node_penholder_19.position.set(-1.95, 1.68, 0.42);
    node_penholder_19.rotation.set(0.0, 0.0, 0.0);
    node_penholder_19.scale.set(0.3, 0.3, 0.3);
  }
  node_penholder_19.userData.sculptComponent = {"id": "penholder", "name": "Pen holder", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.3, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.95, 1.68, 0.42], "rotation": [0, 0, 0]}, "material": "woodlight"};
  node_penholder_19.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_penholder_19);
  nodes["penholder"] = node_penholder_19;
  const mesh_penholder_19Geometry = endpoint_penholder_19
    ? new THREE.CylinderGeometry(endpoint_penholder_19.endRadius, endpoint_penholder_19.baseRadius, endpoint_penholder_19.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_penholder_19 = new THREE.Mesh(
    mesh_penholder_19Geometry,
    materialMap["woodlight"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_penholder_19.name = "Pen holder";
  if (endpoint_penholder_19) {
    mesh_penholder_19.position.copy(endpoint_penholder_19.midpoint);
    mesh_penholder_19.quaternion.copy(endpoint_penholder_19.quaternion);
  }
  mesh_penholder_19.castShadow = options.castShadow ?? true;
  mesh_penholder_19.receiveShadow = options.receiveShadow ?? true;
  mesh_penholder_19.userData.sculptComponent = {"id": "penholder", "name": "Pen holder", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.3, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.95, 1.68, 0.42], "rotation": [0, 0, 0]}, "material": "woodlight"};
  node_penholder_19.add(mesh_penholder_19);
  meshes["penholder"] = mesh_penholder_19;
  colliders["penholder"] = {};

  const attachment_plant_pot_20 = null;
  const endpoint_plant_pot_20 = makeAttachmentEndpoint(attachment_plant_pot_20);
  const node_plant_pot_20 = new THREE.Group();
  node_plant_pot_20.name = "Plant pot__pivot";
  if (endpoint_plant_pot_20) {
    node_plant_pot_20.position.copy(endpoint_plant_pot_20.start);
    node_plant_pot_20.rotation.set(0, 0, 0);
    node_plant_pot_20.scale.set(1, 1, 1);
  } else {
    node_plant_pot_20.position.set(1.35, 1.72, -0.6);
    node_plant_pot_20.rotation.set(0.0, 0.0, 0.0);
    node_plant_pot_20.scale.set(0.34, 0.35, 0.34);
  }
  node_plant_pot_20.userData.sculptComponent = {"id": "plant_pot", "name": "Plant pot", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.34, "height": 0.35, "depth": 0.34, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.35, 1.72, -0.6], "rotation": [0, 0, 0]}, "material": "pot"};
  node_plant_pot_20.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_plant_pot_20);
  nodes["plant_pot"] = node_plant_pot_20;
  const mesh_plant_pot_20Geometry = endpoint_plant_pot_20
    ? new THREE.CylinderGeometry(endpoint_plant_pot_20.endRadius, endpoint_plant_pot_20.baseRadius, endpoint_plant_pot_20.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_plant_pot_20 = new THREE.Mesh(
    mesh_plant_pot_20Geometry,
    materialMap["pot"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_plant_pot_20.name = "Plant pot";
  if (endpoint_plant_pot_20) {
    mesh_plant_pot_20.position.copy(endpoint_plant_pot_20.midpoint);
    mesh_plant_pot_20.quaternion.copy(endpoint_plant_pot_20.quaternion);
  }
  mesh_plant_pot_20.castShadow = options.castShadow ?? true;
  mesh_plant_pot_20.receiveShadow = options.receiveShadow ?? true;
  mesh_plant_pot_20.userData.sculptComponent = {"id": "plant_pot", "name": "Plant pot", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.34, "height": 0.35, "depth": 0.34, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.35, 1.72, -0.6], "rotation": [0, 0, 0]}, "material": "pot"};
  node_plant_pot_20.add(mesh_plant_pot_20);
  meshes["plant_pot"] = mesh_plant_pot_20;
  colliders["plant_pot"] = {};

  const attachment_plant_leaf_21 = null;
  const endpoint_plant_leaf_21 = makeAttachmentEndpoint(attachment_plant_leaf_21);
  const node_plant_leaf_21 = new THREE.Group();
  node_plant_leaf_21.name = "Plant foliage__pivot";
  if (endpoint_plant_leaf_21) {
    node_plant_leaf_21.position.copy(endpoint_plant_leaf_21.start);
    node_plant_leaf_21.rotation.set(0, 0, 0);
    node_plant_leaf_21.scale.set(1, 1, 1);
  } else {
    node_plant_leaf_21.position.set(1.35, 2.05, -0.6);
    node_plant_leaf_21.rotation.set(0.0, 0.0, 0.0);
    node_plant_leaf_21.scale.set(0.6, 0.55, 0.6);
  }
  node_plant_leaf_21.userData.sculptComponent = {"id": "plant_leaf", "name": "Plant foliage", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "sphere", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.6, "height": 0.55, "depth": 0.6, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.35, 2.05, -0.6], "rotation": [0, 0, 0]}, "material": "green"};
  node_plant_leaf_21.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_plant_leaf_21);
  nodes["plant_leaf"] = node_plant_leaf_21;
  const mesh_plant_leaf_21Geometry = endpoint_plant_leaf_21
    ? new THREE.CylinderGeometry(endpoint_plant_leaf_21.endRadius, endpoint_plant_leaf_21.baseRadius, endpoint_plant_leaf_21.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  const mesh_plant_leaf_21 = new THREE.Mesh(
    mesh_plant_leaf_21Geometry,
    materialMap["green"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_plant_leaf_21.name = "Plant foliage";
  if (endpoint_plant_leaf_21) {
    mesh_plant_leaf_21.position.copy(endpoint_plant_leaf_21.midpoint);
    mesh_plant_leaf_21.quaternion.copy(endpoint_plant_leaf_21.quaternion);
  }
  mesh_plant_leaf_21.castShadow = options.castShadow ?? true;
  mesh_plant_leaf_21.receiveShadow = options.receiveShadow ?? true;
  mesh_plant_leaf_21.userData.sculptComponent = {"id": "plant_leaf", "name": "Plant foliage", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "sphere", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.6, "height": 0.55, "depth": 0.6, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.35, 2.05, -0.6], "rotation": [0, 0, 0]}, "material": "green"};
  node_plant_leaf_21.add(mesh_plant_leaf_21);
  meshes["plant_leaf"] = mesh_plant_leaf_21;
  colliders["plant_leaf"] = {};

  const attachment_cam_body_22 = null;
  const endpoint_cam_body_22 = makeAttachmentEndpoint(attachment_cam_body_22);
  const node_cam_body_22 = new THREE.Group();
  node_cam_body_22.name = "DSLR body__pivot";
  if (endpoint_cam_body_22) {
    node_cam_body_22.position.copy(endpoint_cam_body_22.start);
    node_cam_body_22.rotation.set(0, 0, 0);
    node_cam_body_22.scale.set(1, 1, 1);
  } else {
    node_cam_body_22.position.set(-1.0, 1.63, 0.6);
    node_cam_body_22.rotation.set(0.0, 0.5, 0.0);
    node_cam_body_22.scale.set(0.5, 0.35, 0.28);
  }
  node_cam_body_22.userData.sculptComponent = {"id": "cam_body", "name": "DSLR body", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.35, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.0, 1.63, 0.6], "rotation": [0, 0.5, 0]}, "material": "plastic"};
  node_cam_body_22.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_cam_body_22);
  nodes["cam_body"] = node_cam_body_22;
  const mesh_cam_body_22Geometry = endpoint_cam_body_22
    ? new THREE.CylinderGeometry(endpoint_cam_body_22.endRadius, endpoint_cam_body_22.baseRadius, endpoint_cam_body_22.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_cam_body_22 = new THREE.Mesh(
    mesh_cam_body_22Geometry,
    materialMap["plastic"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cam_body_22.name = "DSLR body";
  if (endpoint_cam_body_22) {
    mesh_cam_body_22.position.copy(endpoint_cam_body_22.midpoint);
    mesh_cam_body_22.quaternion.copy(endpoint_cam_body_22.quaternion);
  }
  mesh_cam_body_22.castShadow = options.castShadow ?? true;
  mesh_cam_body_22.receiveShadow = options.receiveShadow ?? true;
  mesh_cam_body_22.userData.sculptComponent = {"id": "cam_body", "name": "DSLR body", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.35, "depth": 0.28, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.0, 1.63, 0.6], "rotation": [0, 0.5, 0]}, "material": "plastic"};
  node_cam_body_22.add(mesh_cam_body_22);
  meshes["cam_body"] = mesh_cam_body_22;
  colliders["cam_body"] = {};

  const attachment_cam_lens_23 = null;
  const endpoint_cam_lens_23 = makeAttachmentEndpoint(attachment_cam_lens_23);
  const node_cam_lens_23 = new THREE.Group();
  node_cam_lens_23.name = "DSLR lens__pivot";
  if (endpoint_cam_lens_23) {
    node_cam_lens_23.position.copy(endpoint_cam_lens_23.start);
    node_cam_lens_23.rotation.set(0, 0, 0);
    node_cam_lens_23.scale.set(1, 1, 1);
  } else {
    node_cam_lens_23.position.set(-0.78, 1.63, 0.78);
    node_cam_lens_23.rotation.set(1.5708, 0.0, 0.0);
    node_cam_lens_23.scale.set(0.26, 0.32, 0.26);
  }
  node_cam_lens_23.userData.sculptComponent = {"id": "cam_lens", "name": "DSLR lens", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.26, "height": 0.32, "depth": 0.26, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.78, 1.63, 0.78], "rotation": [1.5708, 0, 0]}, "material": "blackmetal"};
  node_cam_lens_23.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_cam_lens_23);
  nodes["cam_lens"] = node_cam_lens_23;
  const mesh_cam_lens_23Geometry = endpoint_cam_lens_23
    ? new THREE.CylinderGeometry(endpoint_cam_lens_23.endRadius, endpoint_cam_lens_23.baseRadius, endpoint_cam_lens_23.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_cam_lens_23 = new THREE.Mesh(
    mesh_cam_lens_23Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cam_lens_23.name = "DSLR lens";
  if (endpoint_cam_lens_23) {
    mesh_cam_lens_23.position.copy(endpoint_cam_lens_23.midpoint);
    mesh_cam_lens_23.quaternion.copy(endpoint_cam_lens_23.quaternion);
  }
  mesh_cam_lens_23.castShadow = options.castShadow ?? true;
  mesh_cam_lens_23.receiveShadow = options.receiveShadow ?? true;
  mesh_cam_lens_23.userData.sculptComponent = {"id": "cam_lens", "name": "DSLR lens", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.26, "height": 0.32, "depth": 0.26, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.78, 1.63, 0.78], "rotation": [1.5708, 0, 0]}, "material": "blackmetal"};
  node_cam_lens_23.add(mesh_cam_lens_23);
  meshes["cam_lens"] = mesh_cam_lens_23;
  colliders["cam_lens"] = {};

  const attachment_mug_24 = null;
  const endpoint_mug_24 = makeAttachmentEndpoint(attachment_mug_24);
  const node_mug_24 = new THREE.Group();
  node_mug_24.name = "Coffee mug__pivot";
  if (endpoint_mug_24) {
    node_mug_24.position.copy(endpoint_mug_24.start);
    node_mug_24.rotation.set(0, 0, 0);
    node_mug_24.scale.set(1, 1, 1);
  } else {
    node_mug_24.position.set(-1.55, 1.72, 0.5);
    node_mug_24.rotation.set(0.0, 0.0, 0.0);
    node_mug_24.scale.set(0.3, 0.35, 0.3);
  }
  node_mug_24.userData.sculptComponent = {"id": "mug", "name": "Coffee mug", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.35, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.55, 1.72, 0.5], "rotation": [0, 0, 0]}, "material": "mug"};
  node_mug_24.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_mug_24);
  nodes["mug"] = node_mug_24;
  const mesh_mug_24Geometry = endpoint_mug_24
    ? new THREE.CylinderGeometry(endpoint_mug_24.endRadius, endpoint_mug_24.baseRadius, endpoint_mug_24.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_mug_24 = new THREE.Mesh(
    mesh_mug_24Geometry,
    materialMap["mug"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mug_24.name = "Coffee mug";
  if (endpoint_mug_24) {
    mesh_mug_24.position.copy(endpoint_mug_24.midpoint);
    mesh_mug_24.quaternion.copy(endpoint_mug_24.quaternion);
  }
  mesh_mug_24.castShadow = options.castShadow ?? true;
  mesh_mug_24.receiveShadow = options.receiveShadow ?? true;
  mesh_mug_24.userData.sculptComponent = {"id": "mug", "name": "Coffee mug", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.35, "depth": 0.3, "units": "relative", "confidence": 0.7}, "transform": {"position": [-1.55, 1.72, 0.5], "rotation": [0, 0, 0]}, "material": "mug"};
  node_mug_24.add(mesh_mug_24);
  meshes["mug"] = mesh_mug_24;
  colliders["mug"] = {};

  const attachment_interface_25 = null;
  const endpoint_interface_25 = makeAttachmentEndpoint(attachment_interface_25);
  const node_interface_25 = new THREE.Group();
  node_interface_25.name = "Audio interface__pivot";
  if (endpoint_interface_25) {
    node_interface_25.position.copy(endpoint_interface_25.start);
    node_interface_25.rotation.set(0, 0, 0);
    node_interface_25.scale.set(1, 1, 1);
  } else {
    node_interface_25.position.set(0.78, 1.6, -0.2);
    node_interface_25.rotation.set(0.0, 0.0, 0.0);
    node_interface_25.scale.set(0.5, 0.15, 0.4);
  }
  node_interface_25.userData.sculptComponent = {"id": "interface", "name": "Audio interface", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.15, "depth": 0.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.78, 1.6, -0.2], "rotation": [0, 0, 0]}, "material": "plastic"};
  node_interface_25.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_interface_25);
  nodes["interface"] = node_interface_25;
  const mesh_interface_25Geometry = endpoint_interface_25
    ? new THREE.CylinderGeometry(endpoint_interface_25.endRadius, endpoint_interface_25.baseRadius, endpoint_interface_25.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_interface_25 = new THREE.Mesh(
    mesh_interface_25Geometry,
    materialMap["plastic"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_interface_25.name = "Audio interface";
  if (endpoint_interface_25) {
    mesh_interface_25.position.copy(endpoint_interface_25.midpoint);
    mesh_interface_25.quaternion.copy(endpoint_interface_25.quaternion);
  }
  mesh_interface_25.castShadow = options.castShadow ?? true;
  mesh_interface_25.receiveShadow = options.receiveShadow ?? true;
  mesh_interface_25.userData.sculptComponent = {"id": "interface", "name": "Audio interface", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.5, "height": 0.15, "depth": 0.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.78, 1.6, -0.2], "rotation": [0, 0, 0]}, "material": "plastic"};
  node_interface_25.add(mesh_interface_25);
  meshes["interface"] = mesh_interface_25;
  colliders["interface"] = {};

  const attachment_phone_26 = null;
  const endpoint_phone_26 = makeAttachmentEndpoint(attachment_phone_26);
  const node_phone_26 = new THREE.Group();
  node_phone_26.name = "Phone__pivot";
  if (endpoint_phone_26) {
    node_phone_26.position.copy(endpoint_phone_26.start);
    node_phone_26.rotation.set(0, 0, 0);
    node_phone_26.scale.set(1, 1, 1);
  } else {
    node_phone_26.position.set(1.0, 1.58, 0.1);
    node_phone_26.rotation.set(0.0, 0.0, 0.0);
    node_phone_26.scale.set(0.3, 0.03, 0.6);
  }
  node_phone_26.userData.sculptComponent = {"id": "phone", "name": "Phone", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.03, "depth": 0.6, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.0, 1.58, 0.1], "rotation": [0, 0, 0]}, "material": "screen"};
  node_phone_26.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_phone_26);
  nodes["phone"] = node_phone_26;
  const mesh_phone_26Geometry = endpoint_phone_26
    ? new THREE.CylinderGeometry(endpoint_phone_26.endRadius, endpoint_phone_26.baseRadius, endpoint_phone_26.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_phone_26 = new THREE.Mesh(
    mesh_phone_26Geometry,
    materialMap["screen"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_phone_26.name = "Phone";
  if (endpoint_phone_26) {
    mesh_phone_26.position.copy(endpoint_phone_26.midpoint);
    mesh_phone_26.quaternion.copy(endpoint_phone_26.quaternion);
  }
  mesh_phone_26.castShadow = options.castShadow ?? true;
  mesh_phone_26.receiveShadow = options.receiveShadow ?? true;
  mesh_phone_26.userData.sculptComponent = {"id": "phone", "name": "Phone", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.3, "height": 0.03, "depth": 0.6, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.0, 1.58, 0.1], "rotation": [0, 0, 0]}, "material": "screen"};
  node_phone_26.add(mesh_phone_26);
  meshes["phone"] = mesh_phone_26;
  colliders["phone"] = {};

  const attachment_tower_27 = null;
  const endpoint_tower_27 = makeAttachmentEndpoint(attachment_tower_27);
  const node_tower_27 = new THREE.Group();
  node_tower_27.name = "PC tower__pivot";
  if (endpoint_tower_27) {
    node_tower_27.position.copy(endpoint_tower_27.start);
    node_tower_27.rotation.set(0, 0, 0);
    node_tower_27.scale.set(1, 1, 1);
  } else {
    node_tower_27.position.set(2.0, 0.9, 0.3);
    node_tower_27.rotation.set(0.0, 0.0, 0.0);
    node_tower_27.scale.set(0.9, 1.7, 1.8);
  }
  node_tower_27.userData.sculptComponent = {"id": "tower", "name": "PC tower", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 1.7, "depth": 1.8, "units": "relative", "confidence": 0.7}, "transform": {"position": [2.0, 0.9, 0.3], "rotation": [0, 0, 0]}, "material": "plastic"};
  node_tower_27.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_tower_27);
  nodes["tower"] = node_tower_27;
  const mesh_tower_27Geometry = endpoint_tower_27
    ? new THREE.CylinderGeometry(endpoint_tower_27.endRadius, endpoint_tower_27.baseRadius, endpoint_tower_27.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_tower_27 = new THREE.Mesh(
    mesh_tower_27Geometry,
    materialMap["plastic"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tower_27.name = "PC tower";
  if (endpoint_tower_27) {
    mesh_tower_27.position.copy(endpoint_tower_27.midpoint);
    mesh_tower_27.quaternion.copy(endpoint_tower_27.quaternion);
  }
  mesh_tower_27.castShadow = options.castShadow ?? true;
  mesh_tower_27.receiveShadow = options.receiveShadow ?? true;
  mesh_tower_27.userData.sculptComponent = {"id": "tower", "name": "PC tower", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.9, "height": 1.7, "depth": 1.8, "units": "relative", "confidence": 0.7}, "transform": {"position": [2.0, 0.9, 0.3], "rotation": [0, 0, 0]}, "material": "plastic"};
  node_tower_27.add(mesh_tower_27);
  meshes["tower"] = mesh_tower_27;
  colliders["tower"] = {};

  const attachment_tower_glow_28 = null;
  const endpoint_tower_glow_28 = makeAttachmentEndpoint(attachment_tower_glow_28);
  const node_tower_glow_28 = new THREE.Group();
  node_tower_glow_28.name = "PC RGB panel__pivot";
  if (endpoint_tower_glow_28) {
    node_tower_glow_28.position.copy(endpoint_tower_glow_28.start);
    node_tower_glow_28.rotation.set(0, 0, 0);
    node_tower_glow_28.scale.set(1, 1, 1);
  } else {
    node_tower_glow_28.position.set(1.54, 0.9, 0.3);
    node_tower_glow_28.rotation.set(0.0, 0.0, 0.0);
    node_tower_glow_28.scale.set(0.05, 1.4, 1.4);
  }
  node_tower_glow_28.userData.sculptComponent = {"id": "tower_glow", "name": "PC RGB panel", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.05, "height": 1.4, "depth": 1.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.54, 0.9, 0.3], "rotation": [0, 0, 0]}, "material": "rgb"};
  node_tower_glow_28.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_tower_glow_28);
  nodes["tower_glow"] = node_tower_glow_28;
  const mesh_tower_glow_28Geometry = endpoint_tower_glow_28
    ? new THREE.CylinderGeometry(endpoint_tower_glow_28.endRadius, endpoint_tower_glow_28.baseRadius, endpoint_tower_glow_28.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_tower_glow_28 = new THREE.Mesh(
    mesh_tower_glow_28Geometry,
    materialMap["rgb"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tower_glow_28.name = "PC RGB panel";
  if (endpoint_tower_glow_28) {
    mesh_tower_glow_28.position.copy(endpoint_tower_glow_28.midpoint);
    mesh_tower_glow_28.quaternion.copy(endpoint_tower_glow_28.quaternion);
  }
  mesh_tower_glow_28.castShadow = options.castShadow ?? true;
  mesh_tower_glow_28.receiveShadow = options.receiveShadow ?? true;
  mesh_tower_glow_28.userData.sculptComponent = {"id": "tower_glow", "name": "PC RGB panel", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.05, "height": 1.4, "depth": 1.4, "units": "relative", "confidence": 0.7}, "transform": {"position": [1.54, 0.9, 0.3], "rotation": [0, 0, 0]}, "material": "rgb"};
  node_tower_glow_28.add(mesh_tower_glow_28);
  meshes["tower_glow"] = mesh_tower_glow_28;
  colliders["tower_glow"] = {};

  const attachment_chair_seat_29 = null;
  const endpoint_chair_seat_29 = makeAttachmentEndpoint(attachment_chair_seat_29);
  const node_chair_seat_29 = new THREE.Group();
  node_chair_seat_29.name = "Chair seat__pivot";
  if (endpoint_chair_seat_29) {
    node_chair_seat_29.position.copy(endpoint_chair_seat_29.start);
    node_chair_seat_29.rotation.set(0, 0, 0);
    node_chair_seat_29.scale.set(1, 1, 1);
  } else {
    node_chair_seat_29.position.set(0.1, 1.05, 1.7);
    node_chair_seat_29.rotation.set(0.0, 0.0, 0.0);
    node_chair_seat_29.scale.set(1.3, 0.25, 1.2);
  }
  node_chair_seat_29.userData.sculptComponent = {"id": "chair_seat", "name": "Chair seat", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.3, "height": 0.25, "depth": 1.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1, 1.05, 1.7], "rotation": [0, 0, 0]}, "material": "chair"};
  node_chair_seat_29.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_chair_seat_29);
  nodes["chair_seat"] = node_chair_seat_29;
  const mesh_chair_seat_29Geometry = endpoint_chair_seat_29
    ? new THREE.CylinderGeometry(endpoint_chair_seat_29.endRadius, endpoint_chair_seat_29.baseRadius, endpoint_chair_seat_29.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_chair_seat_29 = new THREE.Mesh(
    mesh_chair_seat_29Geometry,
    materialMap["chair"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_chair_seat_29.name = "Chair seat";
  if (endpoint_chair_seat_29) {
    mesh_chair_seat_29.position.copy(endpoint_chair_seat_29.midpoint);
    mesh_chair_seat_29.quaternion.copy(endpoint_chair_seat_29.quaternion);
  }
  mesh_chair_seat_29.castShadow = options.castShadow ?? true;
  mesh_chair_seat_29.receiveShadow = options.receiveShadow ?? true;
  mesh_chair_seat_29.userData.sculptComponent = {"id": "chair_seat", "name": "Chair seat", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.3, "height": 0.25, "depth": 1.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1, 1.05, 1.7], "rotation": [0, 0, 0]}, "material": "chair"};
  node_chair_seat_29.add(mesh_chair_seat_29);
  meshes["chair_seat"] = mesh_chair_seat_29;
  colliders["chair_seat"] = {};

  const attachment_chair_back_30 = null;
  const endpoint_chair_back_30 = makeAttachmentEndpoint(attachment_chair_back_30);
  const node_chair_back_30 = new THREE.Group();
  node_chair_back_30.name = "Chair backrest__pivot";
  if (endpoint_chair_back_30) {
    node_chair_back_30.position.copy(endpoint_chair_back_30.start);
    node_chair_back_30.rotation.set(0, 0, 0);
    node_chair_back_30.scale.set(1, 1, 1);
  } else {
    node_chair_back_30.position.set(0.1, 2.0, 2.2);
    node_chair_back_30.rotation.set(0.18, 0.0, 0.0);
    node_chair_back_30.scale.set(1.25, 1.8, 0.2);
  }
  node_chair_back_30.userData.sculptComponent = {"id": "chair_back", "name": "Chair backrest", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.25, "height": 1.8, "depth": 0.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1, 2.0, 2.2], "rotation": [0.18, 0, 0]}, "material": "chairmesh"};
  node_chair_back_30.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_chair_back_30);
  nodes["chair_back"] = node_chair_back_30;
  const mesh_chair_back_30Geometry = endpoint_chair_back_30
    ? new THREE.CylinderGeometry(endpoint_chair_back_30.endRadius, endpoint_chair_back_30.baseRadius, endpoint_chair_back_30.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_chair_back_30 = new THREE.Mesh(
    mesh_chair_back_30Geometry,
    materialMap["chairmesh"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_chair_back_30.name = "Chair backrest";
  if (endpoint_chair_back_30) {
    mesh_chair_back_30.position.copy(endpoint_chair_back_30.midpoint);
    mesh_chair_back_30.quaternion.copy(endpoint_chair_back_30.quaternion);
  }
  mesh_chair_back_30.castShadow = options.castShadow ?? true;
  mesh_chair_back_30.receiveShadow = options.receiveShadow ?? true;
  mesh_chair_back_30.userData.sculptComponent = {"id": "chair_back", "name": "Chair backrest", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.25, "height": 1.8, "depth": 0.2, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1, 2.0, 2.2], "rotation": [0.18, 0, 0]}, "material": "chairmesh"};
  node_chair_back_30.add(mesh_chair_back_30);
  meshes["chair_back"] = mesh_chair_back_30;
  colliders["chair_back"] = {};

  const attachment_chair_post_31 = null;
  const endpoint_chair_post_31 = makeAttachmentEndpoint(attachment_chair_post_31);
  const node_chair_post_31 = new THREE.Group();
  node_chair_post_31.name = "Chair post__pivot";
  if (endpoint_chair_post_31) {
    node_chair_post_31.position.copy(endpoint_chair_post_31.start);
    node_chair_post_31.rotation.set(0, 0, 0);
    node_chair_post_31.scale.set(1, 1, 1);
  } else {
    node_chair_post_31.position.set(0.1, 0.6, 1.7);
    node_chair_post_31.rotation.set(0.0, 0.0, 0.0);
    node_chair_post_31.scale.set(0.18, 0.9, 0.18);
  }
  node_chair_post_31.userData.sculptComponent = {"id": "chair_post", "name": "Chair post", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.18, "height": 0.9, "depth": 0.18, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1, 0.6, 1.7], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_chair_post_31.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_chair_post_31);
  nodes["chair_post"] = node_chair_post_31;
  const mesh_chair_post_31Geometry = endpoint_chair_post_31
    ? new THREE.CylinderGeometry(endpoint_chair_post_31.endRadius, endpoint_chair_post_31.baseRadius, endpoint_chair_post_31.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_chair_post_31 = new THREE.Mesh(
    mesh_chair_post_31Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_chair_post_31.name = "Chair post";
  if (endpoint_chair_post_31) {
    mesh_chair_post_31.position.copy(endpoint_chair_post_31.midpoint);
    mesh_chair_post_31.quaternion.copy(endpoint_chair_post_31.quaternion);
  }
  mesh_chair_post_31.castShadow = options.castShadow ?? true;
  mesh_chair_post_31.receiveShadow = options.receiveShadow ?? true;
  mesh_chair_post_31.userData.sculptComponent = {"id": "chair_post", "name": "Chair post", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.18, "height": 0.9, "depth": 0.18, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1, 0.6, 1.7], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_chair_post_31.add(mesh_chair_post_31);
  meshes["chair_post"] = mesh_chair_post_31;
  colliders["chair_post"] = {};

  const attachment_chair_base_32 = null;
  const endpoint_chair_base_32 = makeAttachmentEndpoint(attachment_chair_base_32);
  const node_chair_base_32 = new THREE.Group();
  node_chair_base_32.name = "Chair base__pivot";
  if (endpoint_chair_base_32) {
    node_chair_base_32.position.copy(endpoint_chair_base_32.start);
    node_chair_base_32.rotation.set(0, 0, 0);
    node_chair_base_32.scale.set(1, 1, 1);
  } else {
    node_chair_base_32.position.set(0.1, 0.15, 1.7);
    node_chair_base_32.rotation.set(0.0, 0.0, 0.0);
    node_chair_base_32.scale.set(1.0, 0.1, 1.0);
  }
  node_chair_base_32.userData.sculptComponent = {"id": "chair_base", "name": "Chair base", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.1, "depth": 1.0, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1, 0.15, 1.7], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_chair_base_32.userData.actionProfile = {};
  (nodes["root"] ?? root).add(node_chair_base_32);
  nodes["chair_base"] = node_chair_base_32;
  const mesh_chair_base_32Geometry = endpoint_chair_base_32
    ? new THREE.CylinderGeometry(endpoint_chair_base_32.endRadius, endpoint_chair_base_32.baseRadius, endpoint_chair_base_32.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_chair_base_32 = new THREE.Mesh(
    mesh_chair_base_32Geometry,
    materialMap["blackmetal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_chair_base_32.name = "Chair base";
  if (endpoint_chair_base_32) {
    mesh_chair_base_32.position.copy(endpoint_chair_base_32.midpoint);
    mesh_chair_base_32.quaternion.copy(endpoint_chair_base_32.quaternion);
  }
  mesh_chair_base_32.castShadow = options.castShadow ?? true;
  mesh_chair_base_32.receiveShadow = options.receiveShadow ?? true;
  mesh_chair_base_32.userData.sculptComponent = {"id": "chair_base", "name": "Chair base", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated", "normalStrategy": "vertex"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.1, "depth": 1.0, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1, 0.15, 1.7], "rotation": [0, 0, 0]}, "material": "blackmetal"};
  node_chair_base_32.add(mesh_chair_base_32);
  meshes["chair_base"] = mesh_chair_base_32;
  colliders["chair_base"] = {};

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createPCDeskLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "PCDesk look-dev lights";
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
