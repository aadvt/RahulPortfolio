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
  materialMap["maple-ply"] = createSculptMaterial(
    "maple-ply",
    {"id": "maple-ply", "name": "Hard-rock maple laminate", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#C6AD95", "color": "#C6AD95", "albedo": {"dominant": "#C6AD95", "secondary": ["#403732", "#211B15", "#998171"], "samplingNotes": "baseColor sampled from lit material pixels in the reference; secondary palette is the extractor's de-lit frequency palette, which includes surrounding shadow tones.", "map": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\maple-ply\\maple-ply_albedo.png", "url": "maple-ply_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#C6AD95", "#403732", "#211B15", "#998171", "#C6AD95", "#695653"], "pattern": "reference-derived pixel palette", "amplitude": 0.15, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "stable object-scale detail"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad colour and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "grain, pits, splatter edges, chip boundaries"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.62, "variation": 0.18, "map": "independent-procedural-field", "localResponse": "rougher in cavities, smoother on worn high points"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "longitudinal grain, fine and straight", "strength": 0.4, "scale": 90.0, "space": "tangent"}, "bump": {"pattern": "grain-ticks", "amplitude": 0.02, "scale": 120.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams and recesses"}, "wear": {"edgeWear": 0.55, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "rail-laminations", "region": "deck rail band through the full 0.0138 thickness", "changes": {"albedo": "alternating #E2C79B / #A5814F stripes, 7 bands", "roughness": "+0.05 on the darker glue lines"}, "strength": 0.8, "evidenceRefs": ["zone-r1c1"], "notes": "The ply banding is the single clearest wood cue in the reference."}, {"id": "exposed-chip-wood", "region": "inside every rim chip and tail scrape", "changes": {"albedo": "#C9A472 raw maple, slightly bleached at the very edge", "roughness": "0.72, rougher than the painted surround"}, "strength": 0.9, "evidenceRefs": ["zone-r3c2"], "notes": ""}], "shaderNotes": ["Wood: brown base, vertical grain normal, roughness variation, darker glue lines, lighter worn edges."], "referencePbr": {"version": "1.0", "sourceImage": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\skateboard-crops\\maple-ply.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\maple-ply\\maple-ply_albedo.png", "url": "maple-ply_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\maple-ply\\maple-ply_roughness.png", "url": "maple-ply_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\maple-ply\\maple-ply_height.png", "url": "maple-ply_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\maple-ply\\maple-ply_normal.png", "url": "maple-ply_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\maple-ply\\maple-ply_ao.png", "url": "maple-ply_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "palette": ["#403732", "#211B15", "#998171", "#C6AD95", "#695653"], "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}},
    options
  );
  materialMap["deck-graphic"] = createSculptMaterial(
    "deck-graphic",
    {"id": "deck-graphic", "name": "Painted deck graphic", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#100E12", "color": "#100E12", "albedo": {"dominant": "#100E12", "secondary": ["#1E1716", "#765B68", "#5D3F45"], "samplingNotes": "baseColor sampled from lit material pixels in the reference; secondary palette is the extractor's de-lit frequency palette, which includes surrounding shadow tones.", "map": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\deck-graphic\\deck-graphic_albedo.png", "url": "deck-graphic_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#100E12", "#1E1716", "#765B68", "#5D3F45", "#3A2827", "#B5A295"], "pattern": "reference-derived pixel palette", "amplitude": 0.3, "heightCorrelation": 0.3}, "textureResolution": 2048, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "stable object-scale detail"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad colour and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "grain, pits, splatter edges, chip boundaries"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.7, "variation": 0.2, "map": "independent-procedural-field", "localResponse": "rougher in cavities, smoother on worn high points"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "paint-chip edge relief only", "strength": 0.18, "scale": 140.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.18, "contactShadowBias": 0.3, "notes": "faint darkening inside chip craters"}, "wear": {"edgeWear": 0.85, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "violet-splatter", "region": "mid-deck and around both truck mounts, ~6 clusters", "changes": {"albedo": "#5B2E8C at 0.55 opacity over the black base", "roughness": "-0.06, spray paint sits slightly glossier"}, "strength": 0.85, "evidenceRefs": ["zone-r2c2"], "notes": "Hard speckle edges with satellite dots, not a soft gradient."}, {"id": "gold-linework", "region": "lettering, sparkles and crowns", "changes": {"albedo": "#C9A24A with dry-brush dropout", "roughness": "+0.04, chalky marker"}, "strength": 0.9, "evidenceRefs": ["zone-r1c1"], "notes": ""}, {"id": "magenta-linework", "region": "'DISCIPLINE' block at x=-0.20", "changes": {"albedo": "#D14F8C"}, "strength": 0.85, "evidenceRefs": ["zone-r2c2"], "notes": ""}, {"id": "red-linework", "region": "X-eye smiley on the nose", "changes": {"albedo": "#D6552F"}, "strength": 0.9, "evidenceRefs": ["zone-r0c1"], "notes": ""}, {"id": "cream-linework", "region": "skeleton figure at deck centre", "changes": {"albedo": "#E8DCCB, thin single weight"}, "strength": 0.8, "evidenceRefs": ["zone-r1c2"], "notes": ""}, {"id": "rim-chip-mask", "region": "0.004-0.014 band around the whole perimeter", "changes": {"albedo": "punch through to maple-ply", "roughness": "+0.08"}, "strength": 0.9, "evidenceRefs": ["zone-r0c1"], "notes": "Widest at nose and tail; this band carries the worn read."}], "shaderNotes": ["Layer order is load-bearing: black base -> violet splatter -> gold/magenta/red/cream linework. Compositing out of order loses the reference look.", "Lettering is procedurally approximated in stroke character, weight and placement. Glyph outlines are not traced from the reference.", "Generate albedo, roughness, height and AO independently."], "referencePbr": {"version": "1.0", "sourceImage": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\skateboard-crops\\deck-graphic.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\deck-graphic\\deck-graphic_albedo.png", "url": "deck-graphic_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\deck-graphic\\deck-graphic_roughness.png", "url": "deck-graphic_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\deck-graphic\\deck-graphic_height.png", "url": "deck-graphic_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\deck-graphic\\deck-graphic_normal.png", "url": "deck-graphic_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\deck-graphic\\deck-graphic_ao.png", "url": "deck-graphic_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "palette": ["#1E1716", "#765B68", "#5D3F45", "#3A2827", "#B5A295"], "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}},
    options
  );
  materialMap["griptape"] = createSculptMaterial(
    "griptape",
    {"id": "griptape", "name": "Grip tape", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#0A0A0B", "color": "#0A0A0B", "albedo": {"dominant": "#0A0A0B", "secondary": ["#141416"], "samplingNotes": "reference-observed local colour zones"}, "colorVariation": {"palette": ["#0A0A0B", "#141416"], "pattern": "mottled", "amplitude": 0.15, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "stable object-scale detail"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad colour and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "grain, pits, splatter edges, chip boundaries"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.94, "variation": 0.05, "map": "independent-procedural-field", "localResponse": "rougher in cavities, smoother on worn high points"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "dense angular mineral grit", "strength": 0.65, "scale": 260.0, "space": "tangent"}, "bump": {"pattern": "grit", "amplitude": 0.05, "scale": 300.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams and recesses"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Inferred - never visible in the reference (confidence 0.5).", "Near-total light absorption; almost no specular lobe."], "referencePbr": {"version": "1.0", "sourceImage": "", "extractor": "not-run", "method": "none - surface is not present in the reference image", "usable": false, "verdict": "not-extractable", "confidence": 0.0, "estimatedFidelity": 0.0, "targetThreshold": 0.7, "hardLimit": "The deck top face is never visible in the reference. Verified by magnifying the far rail, which shows only the exposed ply edge. Nothing can be extracted from pixels that do not exist.", "maps": {}, "palette": [], "warnings": ["griptape is inferred, not observed. Strict quality will flag it. Fabricating extraction maps for it would be worse than carrying the flag."]}},
    options
  );
  materialMap["cast-aluminium"] = createSculptMaterial(
    "cast-aluminium",
    {"id": "cast-aluminium", "name": "Raw cast aluminium", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#9A9DA1", "color": "#9A9DA1", "albedo": {"dominant": "#9A9DA1", "secondary": ["#211D19", "#0E0C09", "#96918D"], "samplingNotes": "baseColor sampled from lit material pixels in the reference; secondary palette is the extractor's de-lit frequency palette, which includes surrounding shadow tones.", "map": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\cast-aluminium\\cast-aluminium_albedo.png", "url": "cast-aluminium_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#9A9DA1", "#211D19", "#0E0C09", "#96918D", "#D1CCC8", "#3B3039"], "pattern": "reference-derived pixel palette", "amplitude": 0.15, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "stable object-scale detail"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad colour and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "grain, pits, splatter edges, chip boundaries"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.52, "variation": 0.16, "map": "independent-procedural-field", "localResponse": "rougher in cavities, smoother on worn high points"}, "metalness": {"base": 0.92, "variation": 0.0}, "normal": {"pattern": "irregular casting pits, poisson-scattered", "strength": 0.5, "scale": 110.0, "space": "tangent"}, "bump": {"pattern": "casting-pits", "amplitude": 0.035, "scale": 130.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.42, "contactShadowBias": 0.4, "notes": "strong darkening in the hanger yoke and pivot recess"}, "wear": {"edgeWear": 0.5, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "grind-polish", "region": "hanger outer faces and baseplate corners", "changes": {"roughness": "0.22, polished by grinding", "albedo": "+8% brightness"}, "strength": 0.7, "evidenceRefs": ["zone-r2c2"], "notes": ""}, {"id": "casting-cavity-dirt", "region": "yoke interior and around the pivot cup", "changes": {"albedo": "#4A4D50", "roughness": "+0.12"}, "strength": 0.6, "evidenceRefs": ["zone-r2c2"], "notes": ""}], "shaderNotes": ["Satin sand-cast finish. High metalness but roughness ~0.5 so it never reads as chrome.", "Casting pits belong in the normal/height field, not the albedo."], "referencePbr": {"version": "1.0", "sourceImage": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\skateboard-crops\\cast-aluminium.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\cast-aluminium\\cast-aluminium_albedo.png", "url": "cast-aluminium_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\cast-aluminium\\cast-aluminium_roughness.png", "url": "cast-aluminium_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\cast-aluminium\\cast-aluminium_height.png", "url": "cast-aluminium_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\cast-aluminium\\cast-aluminium_normal.png", "url": "cast-aluminium_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\cast-aluminium\\cast-aluminium_ao.png", "url": "cast-aluminium_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "palette": ["#211D19", "#0E0C09", "#96918D", "#D1CCC8", "#3B3039"], "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}},
    options
  );
  materialMap["wheel-urethane"] = createSculptMaterial(
    "wheel-urethane",
    {"id": "wheel-urethane", "name": "Wheel urethane", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#E4DED2", "color": "#E4DED2", "albedo": {"dominant": "#E4DED2", "secondary": ["#DCD1C8", "#5C524A", "#85796E"], "samplingNotes": "baseColor sampled from lit material pixels in the reference; secondary palette is the extractor's de-lit frequency palette, which includes surrounding shadow tones.", "map": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\wheel-urethane\\wheel-urethane_albedo.png", "url": "wheel-urethane_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#E4DED2", "#DCD1C8", "#5C524A", "#85796E", "#B7AA9E", "#1D1817"], "pattern": "reference-derived pixel palette", "amplitude": 0.15, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "stable object-scale detail"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad colour and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "grain, pits, splatter edges, chip boundaries"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.42, "variation": 0.12, "map": "independent-procedural-field", "localResponse": "rougher in cavities, smoother on worn high points"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "fine mould-release stipple", "strength": 0.22, "scale": 180.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.5, "contactShadowBias": 0.35, "notes": "deep darkening in the bearing seat"}, "wear": {"edgeWear": 0.3, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "bearing-seat-recess", "region": "centre of each outer wheel face", "changes": {"albedo": "#5A2E26 dark maroon-brown", "roughness": "0.35", "ao": "strong, this is the deepest cavity on the wheel"}, "strength": 0.9, "evidenceRefs": ["zone-r1c1"], "notes": ""}, {"id": "rolling-surface-scuff", "region": "outer 60% of the rolling band", "changes": {"roughness": "+0.1", "albedo": "-6% brightness"}, "strength": 0.5, "evidenceRefs": ["zone-r2c2"], "notes": ""}], "shaderNotes": ["Bone-cream, soft sheen. Not white, not glossy plastic."], "referencePbr": {"version": "1.0", "sourceImage": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\skateboard-crops\\wheel-urethane.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.86, "estimatedFidelity": 0.86, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\wheel-urethane\\wheel-urethane_albedo.png", "url": "wheel-urethane_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\wheel-urethane\\wheel-urethane_roughness.png", "url": "wheel-urethane_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\wheel-urethane\\wheel-urethane_height.png", "url": "wheel-urethane_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\wheel-urethane\\wheel-urethane_normal.png", "url": "wheel-urethane_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\wheel-urethane\\wheel-urethane_ao.png", "url": "wheel-urethane_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "palette": ["#DCD1C8", "#5C524A", "#85796E", "#B7AA9E", "#1D1817"], "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}},
    options
  );
  materialMap["hardware-steel"] = createSculptMaterial(
    "hardware-steel",
    {"id": "hardware-steel", "name": "Hardware steel", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#3E3F42", "color": "#3E3F42", "albedo": {"dominant": "#3E3F42", "secondary": ["#110F0C", "#1C1A16", "#070604"], "samplingNotes": "baseColor sampled from lit material pixels in the reference; secondary palette is the extractor's de-lit frequency palette, which includes surrounding shadow tones.", "map": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\hardware-steel\\hardware-steel_albedo.png", "url": "hardware-steel_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}}, "colorVariation": {"palette": ["#3E3F42", "#110F0C", "#1C1A16", "#070604", "#2B2723", "#EFEBE5"], "pattern": "reference-derived pixel palette", "amplitude": 0.15, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "stable object-scale detail"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad colour and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "grain, pits, splatter edges, chip boundaries"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.38, "variation": 0.14, "map": "independent-procedural-field", "localResponse": "rougher in cavities, smoother on worn high points"}, "metalness": {"base": 0.85, "variation": 0.0}, "normal": {"pattern": "fine machining lines", "strength": 0.25, "scale": 200.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams and recesses"}, "wear": {"edgeWear": 0.4, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "bolt-head-wear-ring", "region": "rim of each countersunk bolt head", "changes": {"roughness": "0.2", "albedo": "#8A8C90 bright worn steel"}, "strength": 0.8, "evidenceRefs": ["zone-r1c1"], "notes": ""}], "shaderNotes": ["Darker and smoother than the cast aluminium it sits against."], "referencePbr": {"version": "1.0", "sourceImage": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\skateboard-crops\\hardware-steel.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.836, "estimatedFidelity": 0.836, "targetThreshold": 0.7, "hardLimit": "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", "maps": {"albedo": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\hardware-steel\\hardware-steel_albedo.png", "url": "hardware-steel_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\hardware-steel\\hardware-steel_roughness.png", "url": "hardware-steel_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\hardware-steel\\hardware-steel_height.png", "url": "hardware-steel_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\hardware-steel\\hardware-steel_normal.png", "url": "hardware-steel_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "D:\\portfolio\\website\\RahulPortfolio\\.img2threejs\\pbr\\hardware-steel\\hardware-steel_ao.png", "url": "hardware-steel_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "palette": ["#110F0C", "#1C1A16", "#070604", "#2B2723", "#EFEBE5"], "warnings": ["single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low value range weakens height/roughness inference"]}},
    options
  );
  materialMap["bushing-urethane"] = createSculptMaterial(
    "bushing-urethane",
    {"id": "bushing-urethane", "name": "Bushing urethane", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#8A6A2E", "color": "#8A6A2E", "albedo": {"dominant": "#8A6A2E", "secondary": ["#A88440", "#5C4720"], "samplingNotes": "reference-observed local colour zones"}, "colorVariation": {"palette": ["#8A6A2E", "#A88440", "#5C4720"], "pattern": "mottled", "amplitude": 0.15, "heightCorrelation": 0.3}, "textureResolution": 1024, "textureProjection": {"mode": "uv", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "stable object-scale detail"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 2.0, "amplitude": 0.42, "role": "broad colour and height breakup"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.22, "role": "grain, pits, splatter edges, chip boundaries"}, {"id": "micro", "frequency": 56.0, "amplitude": 0.08, "role": "grazing-light highlight breakup"}], "roughness": {"base": 0.55, "variation": 0.1, "map": "independent-procedural-field", "localResponse": "rougher in cavities, smoother on worn high points"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "derived-from-independent-height-field", "strength": 0.35, "scale": 24.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "darken seams and recesses"}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Inferred - hidden inside the hanger yoke (confidence 0.5).", "Standard amber urethane assumed."], "referencePbr": {"version": "1.0", "sourceImage": "", "extractor": "not-run", "method": "none - surface is not present in the reference image", "usable": false, "verdict": "not-extractable", "confidence": 0.0, "estimatedFidelity": 0.0, "targetThreshold": 0.7, "hardLimit": "Bushings are fully occluded by the hanger yoke in the only available view.", "maps": {}, "palette": [], "warnings": ["bushing-urethane is inferred, not observed. Strict quality will flag it. Fabricating extraction maps for it would be worse than carrying the flag."]}},
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
  node_root_0.name = "Skateboard__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
    node_root_0.scale.set(1.0, 1.0, 1.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Skateboard", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.9, "primitive": "box", "geometryDescriptor": {"topologyIntent": "hidden anchor; carries no visible surface", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 1.0, "height": 0.1458, "depth": 0.258, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1.0, 1.0, 1.0]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-mount-front", "localPosition": [0.2265, -0.0069, 0], "localNormal": [0, -1, 0], "purpose": "front truck baseplate"}, {"id": "socket-mount-rear", "localPosition": [-0.2265, -0.0069, 0], "localNormal": [0, -1, 0], "purpose": "rear truck baseplate"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "maple-ply", "materialLayers": ["maple-ply"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "isContainer": true};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-mount-front", "localPosition": [0.2265, -0.0069, 0], "localNormal": [0, -1, 0], "purpose": "front truck baseplate"}, {"id": "socket-mount-rear", "localPosition": [-0.2265, -0.0069, 0], "localNormal": [0, -1, 0], "purpose": "rear truck baseplate"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["maple-ply"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Skateboard";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Skateboard", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.9, "primitive": "box", "geometryDescriptor": {"topologyIntent": "hidden anchor; carries no visible surface", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 1.0, "height": 0.1458, "depth": 0.258, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1.0, 1.0, 1.0]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-mount-front", "localPosition": [0.2265, -0.0069, 0], "localNormal": [0, -1, 0], "purpose": "front truck baseplate"}, {"id": "socket-mount-rear", "localPosition": [-0.2265, -0.0069, 0], "localNormal": [0, -1, 0], "purpose": "rear truck baseplate"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "maple-ply", "materialLayers": ["maple-ply"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "isContainer": true};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);
  const socket_root_socket_mount_front_0 = new THREE.Object3D();
  socket_root_socket_mount_front_0.name = "socket-mount-front";
  socket_root_socket_mount_front_0.position.set(0.2265, -0.0069, 0.0);
  socket_root_socket_mount_front_0.rotation.set(0, 0, 0);
  socket_root_socket_mount_front_0.userData.socket = {"id": "socket-mount-front", "localPosition": [0.2265, -0.0069, 0], "localNormal": [0, -1, 0], "purpose": "front truck baseplate"};
  node_root_0.add(socket_root_socket_mount_front_0);
  sockets["root:socket-mount-front"] = socket_root_socket_mount_front_0;
  const socket_root_socket_mount_rear_1 = new THREE.Object3D();
  socket_root_socket_mount_rear_1.name = "socket-mount-rear";
  socket_root_socket_mount_rear_1.position.set(-0.2265, -0.0069, 0.0);
  socket_root_socket_mount_rear_1.rotation.set(0, 0, 0);
  socket_root_socket_mount_rear_1.userData.socket = {"id": "socket-mount-rear", "localPosition": [-0.2265, -0.0069, 0], "localNormal": [0, -1, 0], "purpose": "rear truck baseplate"};
  node_root_0.add(socket_root_socket_mount_rear_1);
  sockets["root:socket-mount-rear"] = socket_root_socket_mount_rear_1;

  const attachment_deck_core_1 = null;
  const endpoint_deck_core_1 = makeAttachmentEndpoint(attachment_deck_core_1);
  const node_deck_core_1 = new THREE.Group();
  node_deck_core_1.name = "Deck__pivot";
  if (endpoint_deck_core_1) {
    node_deck_core_1.position.copy(endpoint_deck_core_1.start);
    node_deck_core_1.rotation.set(0, 0, 0);
    node_deck_core_1.scale.set(1, 1, 1);
  } else {
    node_deck_core_1.position.set(0.0, 0.0, 0.0);
    node_deck_core_1.rotation.set(0.0, 0.0, 0.0);
    node_deck_core_1.scale.set(1.0, 0.0138, 0.258);
  }
  node_deck_core_1.userData.sculptComponent = {"id": "deck-core", "name": "Deck", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.9, "primitive": "box", "geometryDescriptor": {"topologyIntent": "box for blockout. form-refinement must replace this with an extruded popsicle outline (rounded nose/tail, mild waist taper) lofted with a transverse concave and an upward kick past x=+-0.29", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.0035, "segments": 3}, "deformationStack": [{"id": "popsicle-outline", "type": "profile-extrude", "axis": "y", "amount": 1.0, "notes": "Symmetric rounded ends, waist narrowing ~4% at the wheelbase centre."}, {"id": "transverse-concave", "type": "bend", "axis": "x", "amount": 0.0156, "notes": "Cross-section dishes upward 0.0156 at the rails."}, {"id": "nose-tail-kick", "type": "bend", "axis": "z", "amount": 0.314, "notes": "18 degrees upward past x=+-0.29, eased over 0.06."}], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.0138, "depth": 0.258, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1.0, 0.0138, 0.258]}, "actionProfile": {"animationRole": "deck", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-deck", "localPosition": [0, 0, 0], "localNormal": [0, 1, 0], "purpose": "board origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "maple-ply", "materialLayers": ["maple-ply"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "ply-laminate-rail", "type": "seam line", "placement": "continuous around the deck rail through its full thickness", "approximateSize": "7 stripes across 0.0138", "orientation": "follows surface", "materialEffect": "alternating cream / warm tan stripes, subtle roughness shift", "geometryEffect": "no relief; laminations are a colour banding only", "confidence": 0.85, "evidenceRefs": ["zone-r1c1"]}, {"id": "rim-chip-wear-band", "type": "chip", "placement": "entire deck perimeter, widening at nose and tail", "approximateSize": "0.004-0.014 wide band", "orientation": "follows surface", "materialEffect": "bare tan maple exposed under the chipped black base", "geometryEffect": "irregular ragged boundary, slight paint-edge relief", "confidence": 0.9, "evidenceRefs": ["zone-r0c1"]}, {"id": "tail-scrape-speckle", "type": "scratch cluster", "placement": "outer 15% of the tail, radiating toward the edge", "approximateSize": "0.001-0.006 marks", "orientation": "follows surface", "materialEffect": "gold-tan speckle, roughness raised where paint is ground off", "geometryEffect": "none", "confidence": 0.9, "evidenceRefs": ["zone-r3c2"]}, {"id": "nose-scrape-speckle", "type": "scratch cluster", "placement": "outer 12% of the nose", "approximateSize": "0.001-0.005 marks", "orientation": "follows surface", "materialEffect": "lighter version of the tail wear", "geometryEffect": "none", "confidence": 0.85, "evidenceRefs": ["zone-r0c1"]}], "surfaceDetail": {"macroRoughness": 0.62, "microRoughness": 0.44, "bumpAmplitude": 0.004, "normalPattern": "longitudinal maple grain plus paint-chip edges", "displacementPattern": "concave cross-section and nose/tail kick", "occlusionPattern": "darkening inside the concave and under the trucks", "edgeWearPattern": "paint chipped to bare wood along the whole rim", "notes": "7-ply cross-laminated maple; the rail banding is the tell."}, "evidenceRefs": ["zone-r0c1", "zone-r1c1", "zone-r3c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_deck_core_1.userData.actionProfile = {"animationRole": "deck", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-deck", "localPosition": [0, 0, 0], "localNormal": [0, 1, 0], "purpose": "board origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["root"] ?? root).add(node_deck_core_1);
  nodes["deck-core"] = node_deck_core_1;
  const mesh_deck_core_1Geometry = endpoint_deck_core_1
    ? new THREE.CylinderGeometry(endpoint_deck_core_1.endRadius, endpoint_deck_core_1.baseRadius, endpoint_deck_core_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_deck_core_1 = new THREE.Mesh(
    mesh_deck_core_1Geometry,
    materialMap["maple-ply"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_deck_core_1.name = "Deck";
  if (endpoint_deck_core_1) {
    mesh_deck_core_1.position.copy(endpoint_deck_core_1.midpoint);
    mesh_deck_core_1.quaternion.copy(endpoint_deck_core_1.quaternion);
  }
  mesh_deck_core_1.castShadow = options.castShadow ?? true;
  mesh_deck_core_1.receiveShadow = options.receiveShadow ?? true;
  mesh_deck_core_1.userData.sculptComponent = {"id": "deck-core", "name": "Deck", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.9, "primitive": "box", "geometryDescriptor": {"topologyIntent": "box for blockout. form-refinement must replace this with an extruded popsicle outline (rounded nose/tail, mild waist taper) lofted with a transverse concave and an upward kick past x=+-0.29", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.0035, "segments": 3}, "deformationStack": [{"id": "popsicle-outline", "type": "profile-extrude", "axis": "y", "amount": 1.0, "notes": "Symmetric rounded ends, waist narrowing ~4% at the wheelbase centre."}, {"id": "transverse-concave", "type": "bend", "axis": "x", "amount": 0.0156, "notes": "Cross-section dishes upward 0.0156 at the rails."}, {"id": "nose-tail-kick", "type": "bend", "axis": "z", "amount": 0.314, "notes": "18 degrees upward past x=+-0.29, eased over 0.06."}], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.0138, "depth": 0.258, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1.0, 0.0138, 0.258]}, "actionProfile": {"animationRole": "deck", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-deck", "localPosition": [0, 0, 0], "localNormal": [0, 1, 0], "purpose": "board origin"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "maple-ply", "materialLayers": ["maple-ply"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "ply-laminate-rail", "type": "seam line", "placement": "continuous around the deck rail through its full thickness", "approximateSize": "7 stripes across 0.0138", "orientation": "follows surface", "materialEffect": "alternating cream / warm tan stripes, subtle roughness shift", "geometryEffect": "no relief; laminations are a colour banding only", "confidence": 0.85, "evidenceRefs": ["zone-r1c1"]}, {"id": "rim-chip-wear-band", "type": "chip", "placement": "entire deck perimeter, widening at nose and tail", "approximateSize": "0.004-0.014 wide band", "orientation": "follows surface", "materialEffect": "bare tan maple exposed under the chipped black base", "geometryEffect": "irregular ragged boundary, slight paint-edge relief", "confidence": 0.9, "evidenceRefs": ["zone-r0c1"]}, {"id": "tail-scrape-speckle", "type": "scratch cluster", "placement": "outer 15% of the tail, radiating toward the edge", "approximateSize": "0.001-0.006 marks", "orientation": "follows surface", "materialEffect": "gold-tan speckle, roughness raised where paint is ground off", "geometryEffect": "none", "confidence": 0.9, "evidenceRefs": ["zone-r3c2"]}, {"id": "nose-scrape-speckle", "type": "scratch cluster", "placement": "outer 12% of the nose", "approximateSize": "0.001-0.005 marks", "orientation": "follows surface", "materialEffect": "lighter version of the tail wear", "geometryEffect": "none", "confidence": 0.85, "evidenceRefs": ["zone-r0c1"]}], "surfaceDetail": {"macroRoughness": 0.62, "microRoughness": 0.44, "bumpAmplitude": 0.004, "normalPattern": "longitudinal maple grain plus paint-chip edges", "displacementPattern": "concave cross-section and nose/tail kick", "occlusionPattern": "darkening inside the concave and under the trucks", "edgeWearPattern": "paint chipped to bare wood along the whole rim", "notes": "7-ply cross-laminated maple; the rail banding is the tell."}, "evidenceRefs": ["zone-r0c1", "zone-r1c1", "zone-r3c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_deck_core_1.add(mesh_deck_core_1);
  meshes["deck-core"] = mesh_deck_core_1;
  colliders["deck-core"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_deck_core_1);
  const socket_deck_core_socket_deck_0 = new THREE.Object3D();
  socket_deck_core_socket_deck_0.name = "socket-deck";
  socket_deck_core_socket_deck_0.position.set(0.0, 0.0, 0.0);
  socket_deck_core_socket_deck_0.rotation.set(0, 0, 0);
  socket_deck_core_socket_deck_0.userData.socket = {"id": "socket-deck", "localPosition": [0, 0, 0], "localNormal": [0, 1, 0], "purpose": "board origin"};
  node_deck_core_1.add(socket_deck_core_socket_deck_0);
  sockets["deck-core:socket-deck"] = socket_deck_core_socket_deck_0;

  const attachment_griptape_2 = null;
  const endpoint_griptape_2 = makeAttachmentEndpoint(attachment_griptape_2);
  const node_griptape_2 = new THREE.Group();
  node_griptape_2.name = "Grip tape__pivot";
  if (endpoint_griptape_2) {
    node_griptape_2.position.copy(endpoint_griptape_2.start);
    node_griptape_2.rotation.set(0, 0, 0);
    node_griptape_2.scale.set(1, 1, 1);
  } else {
    node_griptape_2.position.set(0.0, 0.0070999999999999995, 0.0);
    node_griptape_2.rotation.set(-1.5707963, 0.0, 0.0);
    node_griptape_2.scale.set(1.0, 0.258, 1.0);
  }
  node_griptape_2.userData.sculptComponent = {"id": "griptape", "name": "Grip tape", "level": "meso", "role": "surface", "importance": 0.4, "confidence": 0.5, "primitive": "plane-card", "geometryDescriptor": {"topologyIntent": "Inferred, not observed - the reference never shows the top face. Follows the deck outline and concave.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.0004, "depth": 0.258, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0.0070999999999999995, 0], "rotation": [-1.5707963, 0, 0], "scale": [1.0, 0.258, 1.0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "griptape", "materialLayers": ["griptape"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "griptape-grit", "type": "raised ridge", "placement": "entire top face", "approximateSize": "0.0002 grain", "orientation": "follows surface", "materialEffect": "near-black, very high roughness, almost no specular", "geometryEffect": "dense micro stipple", "confidence": 0.5, "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_griptape_2.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["root"] ?? root).add(node_griptape_2);
  nodes["griptape"] = node_griptape_2;
  const mesh_griptape_2Geometry = endpoint_griptape_2
    ? new THREE.CylinderGeometry(endpoint_griptape_2.endRadius, endpoint_griptape_2.baseRadius, endpoint_griptape_2.length, 32, 12)
    : new THREE.PlaneGeometry(1, 1, 24, 24);
  const mesh_griptape_2 = new THREE.Mesh(
    mesh_griptape_2Geometry,
    materialMap["griptape"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_griptape_2.name = "Grip tape";
  if (endpoint_griptape_2) {
    mesh_griptape_2.position.copy(endpoint_griptape_2.midpoint);
    mesh_griptape_2.quaternion.copy(endpoint_griptape_2.quaternion);
  }
  mesh_griptape_2.castShadow = options.castShadow ?? true;
  mesh_griptape_2.receiveShadow = options.receiveShadow ?? true;
  mesh_griptape_2.userData.sculptComponent = {"id": "griptape", "name": "Grip tape", "level": "meso", "role": "surface", "importance": 0.4, "confidence": 0.5, "primitive": "plane-card", "geometryDescriptor": {"topologyIntent": "Inferred, not observed - the reference never shows the top face. Follows the deck outline and concave.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.0004, "depth": 0.258, "units": "relative", "confidence": 0.5}, "transform": {"position": [0, 0.0070999999999999995, 0], "rotation": [-1.5707963, 0, 0], "scale": [1.0, 0.258, 1.0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "griptape", "materialLayers": ["griptape"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "griptape-grit", "type": "raised ridge", "placement": "entire top face", "approximateSize": "0.0002 grain", "orientation": "follows surface", "materialEffect": "near-black, very high roughness, almost no specular", "geometryEffect": "dense micro stipple", "confidence": 0.5, "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_griptape_2.add(mesh_griptape_2);
  meshes["griptape"] = mesh_griptape_2;
  colliders["griptape"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_griptape_2);

  const attachment_deck_graphic_3 = null;
  const endpoint_deck_graphic_3 = makeAttachmentEndpoint(attachment_deck_graphic_3);
  const node_deck_graphic_3 = new THREE.Group();
  node_deck_graphic_3.name = "Deck bottom graphic__pivot";
  if (endpoint_deck_graphic_3) {
    node_deck_graphic_3.position.copy(endpoint_deck_graphic_3.start);
    node_deck_graphic_3.rotation.set(0, 0, 0);
    node_deck_graphic_3.scale.set(1, 1, 1);
  } else {
    node_deck_graphic_3.position.set(0.0, -0.00705, 0.0);
    node_deck_graphic_3.rotation.set(1.5707936999999998, 0.0, 0.0);
    node_deck_graphic_3.scale.set(1.0, 0.258, 1.0);
  }
  node_deck_graphic_3.userData.sculptComponent = {"id": "deck-graphic", "name": "Deck bottom graphic", "level": "meso", "role": "surface", "importance": 1.0, "confidence": 0.9, "primitive": "plane-card", "geometryDescriptor": {"topologyIntent": "follows the deck bottom surface including concave and kick", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.0003, "depth": 0.258, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, -0.00705, 0], "rotation": [1.5707936999999998, 0, 0], "scale": [1.0, 0.258, 1.0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "deck-graphic", "materialLayers": ["deck-graphic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "purple-splatter-clusters", "type": "stain or dirt patch", "placement": "mid-deck and around both truck mounts", "approximateSize": "0.04-0.16 clusters", "orientation": "follows surface", "materialEffect": "semi-transparent violet with hard speckle edges, not soft airbrush", "geometryEffect": "none", "confidence": 0.9, "evidenceRefs": ["zone-r2c2"]}, {"id": "gold-marker-lettering", "type": "decal or label area", "placement": "'NO RULES' at x=+0.14, 'STAY FOCUSED' at x=-0.14, 'GROW' ringed at x=-0.40", "approximateSize": "cap height 0.022-0.030", "orientation": "follows surface", "materialEffect": "gold-tan brush-pen stroke, variable width, dry-brush breakup", "geometryEffect": "none", "confidence": 0.85, "evidenceRefs": ["zone-r1c1"]}, {"id": "magenta-discipline-text", "type": "decal or label area", "placement": "x=-0.20, offset to the +Z rail", "approximateSize": "cap height 0.018", "orientation": "follows surface", "materialEffect": "clean magenta caps with a scratchier dark duplicate overlapping above", "geometryEffect": "none", "confidence": 0.85, "evidenceRefs": ["zone-r2c2"]}, {"id": "xx-smiley", "type": "decal or label area", "placement": "nose, x=+0.34, centred on Z", "approximateSize": "0.031 diameter", "orientation": "follows surface", "materialEffect": "red-orange hand-drawn ring with X eyes and a curved mouth", "geometryEffect": "none", "confidence": 0.9, "evidenceRefs": ["zone-r0c1"]}, {"id": "skeleton-figure-lineart", "type": "decal or label area", "placement": "deck centre, x=0", "approximateSize": "0.20 tall", "orientation": "follows surface", "materialEffect": "cream single-weight ribcage-and-spine line inside a loose sketch circle", "geometryEffect": "none", "confidence": 0.8, "evidenceRefs": ["zone-r1c2"]}, {"id": "gold-sparkle-scatter", "type": "decal or label area", "placement": "scattered across the whole graphic", "approximateSize": "0.008-0.018 each, 8-14 instances", "orientation": "follows surface", "materialEffect": "four- and six-point gold asterisks, varied rotation", "geometryEffect": "none", "confidence": 0.85, "evidenceRefs": ["zone-r0c1"]}, {"id": "crown-doodles", "type": "decal or label area", "placement": "paired with the lettering clusters", "approximateSize": "0.012 each, 3-5 instances", "orientation": "follows surface", "materialEffect": "three-point gold crown squiggle", "geometryEffect": "none", "confidence": 0.8, "evidenceRefs": ["zone-r0c1"]}], "surfaceDetail": {"macroRoughness": 0.7, "microRoughness": 0.5, "bumpAmplitude": 0.0008, "normalPattern": "paint-chip edge relief only", "displacementPattern": "none", "occlusionPattern": "faint darkening in chip craters", "edgeWearPattern": "chipped to bare maple along the rim", "notes": "Strict layer order: near-black base, then violet splatter, then gold/magenta/red linework on top. Lettering is a procedural approximation of stroke character and placement - glyphs are NOT copied."}, "evidenceRefs": ["zone-r0c1", "zone-r1c1", "zone-r2c2", "zone-r3c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_deck_graphic_3.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["root"] ?? root).add(node_deck_graphic_3);
  nodes["deck-graphic"] = node_deck_graphic_3;
  const mesh_deck_graphic_3Geometry = endpoint_deck_graphic_3
    ? new THREE.CylinderGeometry(endpoint_deck_graphic_3.endRadius, endpoint_deck_graphic_3.baseRadius, endpoint_deck_graphic_3.length, 32, 12)
    : new THREE.PlaneGeometry(1, 1, 24, 24);
  const mesh_deck_graphic_3 = new THREE.Mesh(
    mesh_deck_graphic_3Geometry,
    materialMap["deck-graphic"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_deck_graphic_3.name = "Deck bottom graphic";
  if (endpoint_deck_graphic_3) {
    mesh_deck_graphic_3.position.copy(endpoint_deck_graphic_3.midpoint);
    mesh_deck_graphic_3.quaternion.copy(endpoint_deck_graphic_3.quaternion);
  }
  mesh_deck_graphic_3.castShadow = options.castShadow ?? true;
  mesh_deck_graphic_3.receiveShadow = options.receiveShadow ?? true;
  mesh_deck_graphic_3.userData.sculptComponent = {"id": "deck-graphic", "name": "Deck bottom graphic", "level": "meso", "role": "surface", "importance": 1.0, "confidence": 0.9, "primitive": "plane-card", "geometryDescriptor": {"topologyIntent": "follows the deck bottom surface including concave and kick", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 1.0, "height": 0.0003, "depth": 0.258, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, -0.00705, 0], "rotation": [1.5707936999999998, 0, 0], "scale": [1.0, 0.258, 1.0]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "deck-graphic", "materialLayers": ["deck-graphic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "purple-splatter-clusters", "type": "stain or dirt patch", "placement": "mid-deck and around both truck mounts", "approximateSize": "0.04-0.16 clusters", "orientation": "follows surface", "materialEffect": "semi-transparent violet with hard speckle edges, not soft airbrush", "geometryEffect": "none", "confidence": 0.9, "evidenceRefs": ["zone-r2c2"]}, {"id": "gold-marker-lettering", "type": "decal or label area", "placement": "'NO RULES' at x=+0.14, 'STAY FOCUSED' at x=-0.14, 'GROW' ringed at x=-0.40", "approximateSize": "cap height 0.022-0.030", "orientation": "follows surface", "materialEffect": "gold-tan brush-pen stroke, variable width, dry-brush breakup", "geometryEffect": "none", "confidence": 0.85, "evidenceRefs": ["zone-r1c1"]}, {"id": "magenta-discipline-text", "type": "decal or label area", "placement": "x=-0.20, offset to the +Z rail", "approximateSize": "cap height 0.018", "orientation": "follows surface", "materialEffect": "clean magenta caps with a scratchier dark duplicate overlapping above", "geometryEffect": "none", "confidence": 0.85, "evidenceRefs": ["zone-r2c2"]}, {"id": "xx-smiley", "type": "decal or label area", "placement": "nose, x=+0.34, centred on Z", "approximateSize": "0.031 diameter", "orientation": "follows surface", "materialEffect": "red-orange hand-drawn ring with X eyes and a curved mouth", "geometryEffect": "none", "confidence": 0.9, "evidenceRefs": ["zone-r0c1"]}, {"id": "skeleton-figure-lineart", "type": "decal or label area", "placement": "deck centre, x=0", "approximateSize": "0.20 tall", "orientation": "follows surface", "materialEffect": "cream single-weight ribcage-and-spine line inside a loose sketch circle", "geometryEffect": "none", "confidence": 0.8, "evidenceRefs": ["zone-r1c2"]}, {"id": "gold-sparkle-scatter", "type": "decal or label area", "placement": "scattered across the whole graphic", "approximateSize": "0.008-0.018 each, 8-14 instances", "orientation": "follows surface", "materialEffect": "four- and six-point gold asterisks, varied rotation", "geometryEffect": "none", "confidence": 0.85, "evidenceRefs": ["zone-r0c1"]}, {"id": "crown-doodles", "type": "decal or label area", "placement": "paired with the lettering clusters", "approximateSize": "0.012 each, 3-5 instances", "orientation": "follows surface", "materialEffect": "three-point gold crown squiggle", "geometryEffect": "none", "confidence": 0.8, "evidenceRefs": ["zone-r0c1"]}], "surfaceDetail": {"macroRoughness": 0.7, "microRoughness": 0.5, "bumpAmplitude": 0.0008, "normalPattern": "paint-chip edge relief only", "displacementPattern": "none", "occlusionPattern": "faint darkening in chip craters", "edgeWearPattern": "chipped to bare maple along the rim", "notes": "Strict layer order: near-black base, then violet splatter, then gold/magenta/red linework on top. Lettering is a procedural approximation of stroke character and placement - glyphs are NOT copied."}, "evidenceRefs": ["zone-r0c1", "zone-r1c1", "zone-r2c2", "zone-r3c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_deck_graphic_3.add(mesh_deck_graphic_3);
  meshes["deck-graphic"] = mesh_deck_graphic_3;
  colliders["deck-graphic"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_deck_graphic_3);

  const attachment_truck_front_4 = null;
  const endpoint_truck_front_4 = makeAttachmentEndpoint(attachment_truck_front_4);
  const node_truck_front_4 = new THREE.Group();
  node_truck_front_4.name = "Front truck assembly__pivot";
  if (endpoint_truck_front_4) {
    node_truck_front_4.position.copy(endpoint_truck_front_4.start);
    node_truck_front_4.rotation.set(0, 0, 0);
    node_truck_front_4.scale.set(1, 1, 1);
  } else {
    node_truck_front_4.position.set(0.2265, -0.0069, 0.0);
    node_truck_front_4.rotation.set(0.0, 0.0, 0.0);
    node_truck_front_4.scale.set(1.0, 1.0, 1.0);
  }
  node_truck_front_4.userData.sculptComponent = {"id": "truck-front", "name": "Front truck assembly", "level": "macro", "role": "structure", "importance": 0.95, "confidence": 0.85, "primitive": "box", "geometryDescriptor": {"topologyIntent": "turning assembly pivoting about the kingpin axis", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.075, "height": 0.0746, "depth": 0.258, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.2265, -0.0069, 0], "rotation": [0, 0, 0], "scale": [1.0, 1.0, 1.0]}, "actionProfile": {"animationRole": "front-truck", "pivot": {"mode": "custom", "localPosition": [0, -0.012, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-axle-front", "localPosition": [0, -0.0656, 0], "localNormal": [0, 0, 1], "purpose": "wheel axle line"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "truck-front", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1", "zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": true};
  node_truck_front_4.userData.actionProfile = {"animationRole": "front-truck", "pivot": {"mode": "custom", "localPosition": [0, -0.012, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-axle-front", "localPosition": [0, -0.0656, 0], "localNormal": [0, 0, 1], "purpose": "wheel axle line"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "truck-front", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["root"] ?? root).add(node_truck_front_4);
  nodes["truck-front"] = node_truck_front_4;
  const mesh_truck_front_4Geometry = endpoint_truck_front_4
    ? new THREE.CylinderGeometry(endpoint_truck_front_4.endRadius, endpoint_truck_front_4.baseRadius, endpoint_truck_front_4.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_truck_front_4 = new THREE.Mesh(
    mesh_truck_front_4Geometry,
    materialMap["cast-aluminium"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_truck_front_4.name = "Front truck assembly";
  if (endpoint_truck_front_4) {
    mesh_truck_front_4.position.copy(endpoint_truck_front_4.midpoint);
    mesh_truck_front_4.quaternion.copy(endpoint_truck_front_4.quaternion);
  }
  mesh_truck_front_4.castShadow = options.castShadow ?? true;
  mesh_truck_front_4.receiveShadow = options.receiveShadow ?? true;
  mesh_truck_front_4.userData.sculptComponent = {"id": "truck-front", "name": "Front truck assembly", "level": "macro", "role": "structure", "importance": 0.95, "confidence": 0.85, "primitive": "box", "geometryDescriptor": {"topologyIntent": "turning assembly pivoting about the kingpin axis", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.075, "height": 0.0746, "depth": 0.258, "units": "relative", "confidence": 0.85}, "transform": {"position": [0.2265, -0.0069, 0], "rotation": [0, 0, 0], "scale": [1.0, 1.0, 1.0]}, "actionProfile": {"animationRole": "front-truck", "pivot": {"mode": "custom", "localPosition": [0, -0.012, 0], "axis": [1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-axle-front", "localPosition": [0, -0.0656, 0], "localNormal": [0, 0, 1], "purpose": "wheel axle line"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "truck-front", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1", "zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": true};
  node_truck_front_4.add(mesh_truck_front_4);
  meshes["truck-front"] = mesh_truck_front_4;
  colliders["truck-front"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["truck-front"] ??= [];
  destructionGroups["truck-front"].push(node_truck_front_4);
  const socket_truck_front_socket_axle_front_0 = new THREE.Object3D();
  socket_truck_front_socket_axle_front_0.name = "socket-axle-front";
  socket_truck_front_socket_axle_front_0.position.set(0.0, -0.0656, 0.0);
  socket_truck_front_socket_axle_front_0.rotation.set(0, 0, 0);
  socket_truck_front_socket_axle_front_0.userData.socket = {"id": "socket-axle-front", "localPosition": [0, -0.0656, 0], "localNormal": [0, 0, 1], "purpose": "wheel axle line"};
  node_truck_front_4.add(socket_truck_front_socket_axle_front_0);
  sockets["truck-front:socket-axle-front"] = socket_truck_front_socket_axle_front_0;

  const attachment_baseplate_front_5 = null;
  const endpoint_baseplate_front_5 = makeAttachmentEndpoint(attachment_baseplate_front_5);
  const node_baseplate_front_5 = new THREE.Group();
  node_baseplate_front_5.name = "Front baseplate__pivot";
  if (endpoint_baseplate_front_5) {
    node_baseplate_front_5.position.copy(endpoint_baseplate_front_5.start);
    node_baseplate_front_5.rotation.set(0, 0, 0);
    node_baseplate_front_5.scale.set(1, 1, 1);
  } else {
    node_baseplate_front_5.position.set(0.0, -0.0045, 0.0);
    node_baseplate_front_5.rotation.set(0.0, 0.0, 0.0);
    node_baseplate_front_5.scale.set(0.075, 0.009, 0.062);
  }
  node_baseplate_front_5.userData.sculptComponent = {"id": "baseplate-front", "name": "Front baseplate", "level": "meso", "role": "structure", "importance": 0.8, "confidence": 0.85, "primitive": "box", "geometryDescriptor": {"topologyIntent": "box blockout", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.006, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": null, "dimensions": {"width": 0.075, "height": 0.009, "depth": 0.062, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.0045, 0], "rotation": [0, 0, 0], "scale": [0.075, 0.009, 0.062]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "baseplate-corner-radius-front", "type": "bevel highlight", "placement": "all four baseplate corners", "approximateSize": "0.006 radius", "orientation": "follows surface", "materialEffect": "slightly polished vs the cast face", "geometryEffect": "rounded corner catches the key light as a bright arc", "confidence": 0.85, "evidenceRefs": ["zone-r2c2"]}, {"id": "pivot-cup-recess-front", "type": "hole or socket", "placement": "outboard end of the baseplate, on the deck-facing side", "approximateSize": "0.014 diameter", "orientation": "follows surface", "materialEffect": "darker cavity AO", "geometryEffect": "cylindrical recess receiving the hanger pivot", "confidence": 0.75, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_baseplate_front_5.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-front"] ?? root).add(node_baseplate_front_5);
  nodes["baseplate-front"] = node_baseplate_front_5;
  const mesh_baseplate_front_5Geometry = endpoint_baseplate_front_5
    ? new THREE.CylinderGeometry(endpoint_baseplate_front_5.endRadius, endpoint_baseplate_front_5.baseRadius, endpoint_baseplate_front_5.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_baseplate_front_5 = new THREE.Mesh(
    mesh_baseplate_front_5Geometry,
    materialMap["cast-aluminium"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_baseplate_front_5.name = "Front baseplate";
  if (endpoint_baseplate_front_5) {
    mesh_baseplate_front_5.position.copy(endpoint_baseplate_front_5.midpoint);
    mesh_baseplate_front_5.quaternion.copy(endpoint_baseplate_front_5.quaternion);
  }
  mesh_baseplate_front_5.castShadow = options.castShadow ?? true;
  mesh_baseplate_front_5.receiveShadow = options.receiveShadow ?? true;
  mesh_baseplate_front_5.userData.sculptComponent = {"id": "baseplate-front", "name": "Front baseplate", "level": "meso", "role": "structure", "importance": 0.8, "confidence": 0.85, "primitive": "box", "geometryDescriptor": {"topologyIntent": "box blockout", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.006, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": null, "dimensions": {"width": 0.075, "height": 0.009, "depth": 0.062, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.0045, 0], "rotation": [0, 0, 0], "scale": [0.075, 0.009, 0.062]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "baseplate-corner-radius-front", "type": "bevel highlight", "placement": "all four baseplate corners", "approximateSize": "0.006 radius", "orientation": "follows surface", "materialEffect": "slightly polished vs the cast face", "geometryEffect": "rounded corner catches the key light as a bright arc", "confidence": 0.85, "evidenceRefs": ["zone-r2c2"]}, {"id": "pivot-cup-recess-front", "type": "hole or socket", "placement": "outboard end of the baseplate, on the deck-facing side", "approximateSize": "0.014 diameter", "orientation": "follows surface", "materialEffect": "darker cavity AO", "geometryEffect": "cylindrical recess receiving the hanger pivot", "confidence": 0.75, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_baseplate_front_5.add(mesh_baseplate_front_5);
  meshes["baseplate-front"] = mesh_baseplate_front_5;
  colliders["baseplate-front"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_baseplate_front_5);

  const attachment_hanger_front_6 = null;
  const endpoint_hanger_front_6 = makeAttachmentEndpoint(attachment_hanger_front_6);
  const node_hanger_front_6 = new THREE.Group();
  node_hanger_front_6.name = "Front hanger__pivot";
  if (endpoint_hanger_front_6) {
    node_hanger_front_6.position.copy(endpoint_hanger_front_6.start);
    node_hanger_front_6.rotation.set(0, 0, 0);
    node_hanger_front_6.scale.set(1, 1, 1);
  } else {
    node_hanger_front_6.position.set(0.0, -0.0616, 0.0);
    node_hanger_front_6.rotation.set(0.0, 0.0, 0.0);
    node_hanger_front_6.scale.set(0.055, 0.026, 0.105);
  }
  node_hanger_front_6.userData.sculptComponent = {"id": "hanger-front", "name": "Front hanger", "level": "meso", "role": "structure", "importance": 0.9, "confidence": 0.8, "primitive": "box", "geometryDescriptor": {"topologyIntent": "tapered cast arm; form-refinement lofts it from the yoke out to the axle boss", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.004, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": null, "dimensions": {"width": 0.055, "height": 0.026, "depth": 0.105, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.0616, 0], "rotation": [0, 0, 0], "scale": [0.055, 0.026, 0.105]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "hanger-yoke-front", "type": "recessed groove", "placement": "centre of the hanger where the kingpin passes through", "approximateSize": "0.018 wide slot", "orientation": "follows surface", "materialEffect": "deep cavity occlusion", "geometryEffect": "V-shaped yoke opening toward the baseplate", "confidence": 0.8, "evidenceRefs": ["zone-r2c2"]}, {"id": "hanger-casting-parting-line-front", "type": "seam line", "placement": "horizontal line around the hanger mid-height", "approximateSize": "0.0015 wide", "orientation": "follows surface", "materialEffect": "slightly rougher, catches dirt", "geometryEffect": "shallow raised ridge from the casting mould split", "confidence": 0.7, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.38, "bumpAmplitude": 0.02, "normalPattern": "irregular casting pits, poisson-scattered", "displacementPattern": "none", "occlusionPattern": "cavity-darkened yoke and pivot recess", "edgeWearPattern": "polished bright along grind edges", "notes": "Raw sand-cast aluminium: satin, never mirror."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_hanger_front_6.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-front"] ?? root).add(node_hanger_front_6);
  nodes["hanger-front"] = node_hanger_front_6;
  const mesh_hanger_front_6Geometry = endpoint_hanger_front_6
    ? new THREE.CylinderGeometry(endpoint_hanger_front_6.endRadius, endpoint_hanger_front_6.baseRadius, endpoint_hanger_front_6.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_hanger_front_6 = new THREE.Mesh(
    mesh_hanger_front_6Geometry,
    materialMap["cast-aluminium"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hanger_front_6.name = "Front hanger";
  if (endpoint_hanger_front_6) {
    mesh_hanger_front_6.position.copy(endpoint_hanger_front_6.midpoint);
    mesh_hanger_front_6.quaternion.copy(endpoint_hanger_front_6.quaternion);
  }
  mesh_hanger_front_6.castShadow = options.castShadow ?? true;
  mesh_hanger_front_6.receiveShadow = options.receiveShadow ?? true;
  mesh_hanger_front_6.userData.sculptComponent = {"id": "hanger-front", "name": "Front hanger", "level": "meso", "role": "structure", "importance": 0.9, "confidence": 0.8, "primitive": "box", "geometryDescriptor": {"topologyIntent": "tapered cast arm; form-refinement lofts it from the yoke out to the axle boss", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.004, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": null, "dimensions": {"width": 0.055, "height": 0.026, "depth": 0.105, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.0616, 0], "rotation": [0, 0, 0], "scale": [0.055, 0.026, 0.105]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "hanger-yoke-front", "type": "recessed groove", "placement": "centre of the hanger where the kingpin passes through", "approximateSize": "0.018 wide slot", "orientation": "follows surface", "materialEffect": "deep cavity occlusion", "geometryEffect": "V-shaped yoke opening toward the baseplate", "confidence": 0.8, "evidenceRefs": ["zone-r2c2"]}, {"id": "hanger-casting-parting-line-front", "type": "seam line", "placement": "horizontal line around the hanger mid-height", "approximateSize": "0.0015 wide", "orientation": "follows surface", "materialEffect": "slightly rougher, catches dirt", "geometryEffect": "shallow raised ridge from the casting mould split", "confidence": 0.7, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.38, "bumpAmplitude": 0.02, "normalPattern": "irregular casting pits, poisson-scattered", "displacementPattern": "none", "occlusionPattern": "cavity-darkened yoke and pivot recess", "edgeWearPattern": "polished bright along grind edges", "notes": "Raw sand-cast aluminium: satin, never mirror."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_hanger_front_6.add(mesh_hanger_front_6);
  meshes["hanger-front"] = mesh_hanger_front_6;
  colliders["hanger-front"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_hanger_front_6);

  const attachment_kingpin_front_7 = {"parentId": "truck-front", "parentSocket": "socket-kingpin", "localStart": [0.004, -0.009, 0], "localEnd": [0.02, -0.042, 0], "contactNormal": [0, -1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.006, "baseRadius": 0.004, "endRadius": 0.004};
  const endpoint_kingpin_front_7 = makeAttachmentEndpoint(attachment_kingpin_front_7);
  const node_kingpin_front_7 = new THREE.Group();
  node_kingpin_front_7.name = "Front kingpin__pivot";
  if (endpoint_kingpin_front_7) {
    node_kingpin_front_7.position.copy(endpoint_kingpin_front_7.start);
    node_kingpin_front_7.rotation.set(0, 0, 0);
    node_kingpin_front_7.scale.set(1, 1, 1);
  } else {
    node_kingpin_front_7.position.set(0.012, -0.024, 0.0);
    node_kingpin_front_7.rotation.set(0.0, 0.0, 0.62);
    node_kingpin_front_7.scale.set(0.008, 0.04, 0.008);
  }
  node_kingpin_front_7.userData.sculptComponent = {"id": "kingpin-front", "name": "Front kingpin", "level": "meso", "role": "hardware", "importance": 0.6, "confidence": 0.75, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-kingpin", "localStart": [0.004, -0.009, 0], "localEnd": [0.02, -0.042, 0], "contactNormal": [0, -1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.006, "baseRadius": 0.004, "endRadius": 0.004}, "dimensions": {"width": 0.008, "height": 0.04, "depth": 0.008, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.012, -0.024, 0], "rotation": [0, 0, 0.62], "scale": [0.008, 0.04, 0.008]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_kingpin_front_7.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-front"] ?? root).add(node_kingpin_front_7);
  nodes["kingpin-front"] = node_kingpin_front_7;
  const mesh_kingpin_front_7Geometry = endpoint_kingpin_front_7
    ? new THREE.CylinderGeometry(endpoint_kingpin_front_7.endRadius, endpoint_kingpin_front_7.baseRadius, endpoint_kingpin_front_7.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_kingpin_front_7 = new THREE.Mesh(
    mesh_kingpin_front_7Geometry,
    materialMap["hardware-steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_kingpin_front_7.name = "Front kingpin";
  if (endpoint_kingpin_front_7) {
    mesh_kingpin_front_7.position.copy(endpoint_kingpin_front_7.midpoint);
    mesh_kingpin_front_7.quaternion.copy(endpoint_kingpin_front_7.quaternion);
  }
  mesh_kingpin_front_7.castShadow = options.castShadow ?? true;
  mesh_kingpin_front_7.receiveShadow = options.receiveShadow ?? true;
  mesh_kingpin_front_7.userData.sculptComponent = {"id": "kingpin-front", "name": "Front kingpin", "level": "meso", "role": "hardware", "importance": 0.6, "confidence": 0.75, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-kingpin", "localStart": [0.004, -0.009, 0], "localEnd": [0.02, -0.042, 0], "contactNormal": [0, -1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.006, "baseRadius": 0.004, "endRadius": 0.004}, "dimensions": {"width": 0.008, "height": 0.04, "depth": 0.008, "units": "relative", "confidence": 0.75}, "transform": {"position": [0.012, -0.024, 0], "rotation": [0, 0, 0.62], "scale": [0.008, 0.04, 0.008]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_kingpin_front_7.add(mesh_kingpin_front_7);
  meshes["kingpin-front"] = mesh_kingpin_front_7;
  colliders["kingpin-front"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_kingpin_front_7);

  const attachment_kingpin_nut_front_8 = {"parentId": "truck-front", "parentSocket": "socket-nut", "localStart": [0.02, -0.042, 0], "localEnd": [0.0228, -0.0478, 0], "contactNormal": [0, 1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.004, "baseRadius": 0.006, "endRadius": 0.006};
  const endpoint_kingpin_nut_front_8 = makeAttachmentEndpoint(attachment_kingpin_nut_front_8);
  const node_kingpin_nut_front_8 = new THREE.Group();
  node_kingpin_nut_front_8.name = "Front kingpin nut__pivot";
  if (endpoint_kingpin_nut_front_8) {
    node_kingpin_nut_front_8.position.copy(endpoint_kingpin_nut_front_8.start);
    node_kingpin_nut_front_8.rotation.set(0, 0, 0);
    node_kingpin_nut_front_8.scale.set(1, 1, 1);
  } else {
    node_kingpin_nut_front_8.position.set(0.021, -0.043, 0.0);
    node_kingpin_nut_front_8.rotation.set(0.0, 0.0, 0.62);
    node_kingpin_nut_front_8.scale.set(0.012, 0.006, 0.012);
  }
  node_kingpin_nut_front_8.userData.sculptComponent = {"id": "kingpin-nut-front", "name": "Front kingpin nut", "level": "micro", "role": "hardware", "importance": 0.45, "confidence": 0.8, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-nut", "localStart": [0.02, -0.042, 0], "localEnd": [0.0228, -0.0478, 0], "contactNormal": [0, 1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.004, "baseRadius": 0.006, "endRadius": 0.006}, "dimensions": {"width": 0.012, "height": 0.006, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.021, -0.043, 0], "rotation": [0, 0, 0.62], "scale": [0.012, 0.006, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "kingpin-nut-facets-front", "type": "bevel highlight", "placement": "six flats around the nut", "approximateSize": "0.012 across flats", "orientation": "follows surface", "materialEffect": "smoother and darker than the raw casting", "geometryEffect": "hex prism, not a smooth cylinder", "confidence": 0.85, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_kingpin_nut_front_8.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-front"] ?? root).add(node_kingpin_nut_front_8);
  nodes["kingpin-nut-front"] = node_kingpin_nut_front_8;
  const mesh_kingpin_nut_front_8Geometry = endpoint_kingpin_nut_front_8
    ? new THREE.CylinderGeometry(endpoint_kingpin_nut_front_8.endRadius, endpoint_kingpin_nut_front_8.baseRadius, endpoint_kingpin_nut_front_8.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_kingpin_nut_front_8 = new THREE.Mesh(
    mesh_kingpin_nut_front_8Geometry,
    materialMap["hardware-steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_kingpin_nut_front_8.name = "Front kingpin nut";
  if (endpoint_kingpin_nut_front_8) {
    mesh_kingpin_nut_front_8.position.copy(endpoint_kingpin_nut_front_8.midpoint);
    mesh_kingpin_nut_front_8.quaternion.copy(endpoint_kingpin_nut_front_8.quaternion);
  }
  mesh_kingpin_nut_front_8.castShadow = options.castShadow ?? true;
  mesh_kingpin_nut_front_8.receiveShadow = options.receiveShadow ?? true;
  mesh_kingpin_nut_front_8.userData.sculptComponent = {"id": "kingpin-nut-front", "name": "Front kingpin nut", "level": "micro", "role": "hardware", "importance": 0.45, "confidence": 0.8, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-nut", "localStart": [0.02, -0.042, 0], "localEnd": [0.0228, -0.0478, 0], "contactNormal": [0, 1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.004, "baseRadius": 0.006, "endRadius": 0.006}, "dimensions": {"width": 0.012, "height": 0.006, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [0.021, -0.043, 0], "rotation": [0, 0, 0.62], "scale": [0.012, 0.006, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "kingpin-nut-facets-front", "type": "bevel highlight", "placement": "six flats around the nut", "approximateSize": "0.012 across flats", "orientation": "follows surface", "materialEffect": "smoother and darker than the raw casting", "geometryEffect": "hex prism, not a smooth cylinder", "confidence": 0.85, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_kingpin_nut_front_8.add(mesh_kingpin_nut_front_8);
  meshes["kingpin-nut-front"] = mesh_kingpin_nut_front_8;
  colliders["kingpin-nut-front"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_kingpin_nut_front_8);

  const attachment_bushing_front_top_9 = {"parentId": "truck-front", "parentSocket": "socket-kingpin", "localStart": [0.008, -0.017, 0], "localEnd": [0.014, -0.029, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.011, "endRadius": 0.006};
  const endpoint_bushing_front_top_9 = makeAttachmentEndpoint(attachment_bushing_front_top_9);
  const node_bushing_front_top_9 = new THREE.Group();
  node_bushing_front_top_9.name = "Front top bushing__pivot";
  if (endpoint_bushing_front_top_9) {
    node_bushing_front_top_9.position.copy(endpoint_bushing_front_top_9.start);
    node_bushing_front_top_9.rotation.set(0, 0, 0);
    node_bushing_front_top_9.scale.set(1, 1, 1);
  } else {
    node_bushing_front_top_9.position.set(0.014, -0.018, 0.0);
    node_bushing_front_top_9.rotation.set(0.0, 0.0, 0.62);
    node_bushing_front_top_9.scale.set(0.022, 0.012, 0.022);
  }
  node_bushing_front_top_9.userData.sculptComponent = {"id": "bushing-front-top", "name": "Front top bushing", "level": "meso", "role": "hardware", "importance": 0.35, "confidence": 0.5, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "truncated cone; colour and durometer inferred, hidden in the reference", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-kingpin", "localStart": [0.008, -0.017, 0], "localEnd": [0.014, -0.029, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.011, "endRadius": 0.006}, "dimensions": {"width": 0.022, "height": 0.012, "depth": 0.022, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.014, -0.018, 0], "rotation": [0, 0, 0.62], "scale": [0.022, 0.012, 0.022]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "bushing-urethane", "materialLayers": ["bushing-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_bushing_front_top_9.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-front"] ?? root).add(node_bushing_front_top_9);
  nodes["bushing-front-top"] = node_bushing_front_top_9;
  const mesh_bushing_front_top_9Geometry = endpoint_bushing_front_top_9
    ? new THREE.CylinderGeometry(endpoint_bushing_front_top_9.endRadius, endpoint_bushing_front_top_9.baseRadius, endpoint_bushing_front_top_9.length, 32, 12)
    : new THREE.ConeGeometry(0.5, 1, 48, 16);
  const mesh_bushing_front_top_9 = new THREE.Mesh(
    mesh_bushing_front_top_9Geometry,
    materialMap["bushing-urethane"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bushing_front_top_9.name = "Front top bushing";
  if (endpoint_bushing_front_top_9) {
    mesh_bushing_front_top_9.position.copy(endpoint_bushing_front_top_9.midpoint);
    mesh_bushing_front_top_9.quaternion.copy(endpoint_bushing_front_top_9.quaternion);
  }
  mesh_bushing_front_top_9.castShadow = options.castShadow ?? true;
  mesh_bushing_front_top_9.receiveShadow = options.receiveShadow ?? true;
  mesh_bushing_front_top_9.userData.sculptComponent = {"id": "bushing-front-top", "name": "Front top bushing", "level": "meso", "role": "hardware", "importance": 0.35, "confidence": 0.5, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "truncated cone; colour and durometer inferred, hidden in the reference", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-kingpin", "localStart": [0.008, -0.017, 0], "localEnd": [0.014, -0.029, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.011, "endRadius": 0.006}, "dimensions": {"width": 0.022, "height": 0.012, "depth": 0.022, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.014, -0.018, 0], "rotation": [0, 0, 0.62], "scale": [0.022, 0.012, 0.022]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "bushing-urethane", "materialLayers": ["bushing-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_bushing_front_top_9.add(mesh_bushing_front_top_9);
  meshes["bushing-front-top"] = mesh_bushing_front_top_9;
  colliders["bushing-front-top"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_bushing_front_top_9);

  const attachment_bushing_front_bot_10 = {"parentId": "truck-front", "parentSocket": "socket-kingpin", "localStart": [0.014, -0.029, 0], "localEnd": [0.0195, -0.04, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.006, "endRadius": 0.011};
  const endpoint_bushing_front_bot_10 = makeAttachmentEndpoint(attachment_bushing_front_bot_10);
  const node_bushing_front_bot_10 = new THREE.Group();
  node_bushing_front_bot_10.name = "Front bottom bushing__pivot";
  if (endpoint_bushing_front_bot_10) {
    node_bushing_front_bot_10.position.copy(endpoint_bushing_front_bot_10.start);
    node_bushing_front_bot_10.rotation.set(0, 0, 0);
    node_bushing_front_bot_10.scale.set(1, 1, 1);
  } else {
    node_bushing_front_bot_10.position.set(0.02, -0.032, 0.0);
    node_bushing_front_bot_10.rotation.set(0.0, 0.0, 0.62);
    node_bushing_front_bot_10.scale.set(0.022, 0.012, 0.022);
  }
  node_bushing_front_bot_10.userData.sculptComponent = {"id": "bushing-front-bot", "name": "Front bottom bushing", "level": "meso", "role": "hardware", "importance": 0.35, "confidence": 0.5, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "truncated cone; colour and durometer inferred, hidden in the reference", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-kingpin", "localStart": [0.014, -0.029, 0], "localEnd": [0.0195, -0.04, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.006, "endRadius": 0.011}, "dimensions": {"width": 0.022, "height": 0.012, "depth": 0.022, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.02, -0.032, 0], "rotation": [0, 0, 0.62], "scale": [0.022, 0.012, 0.022]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "bushing-urethane", "materialLayers": ["bushing-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_bushing_front_bot_10.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-front"] ?? root).add(node_bushing_front_bot_10);
  nodes["bushing-front-bot"] = node_bushing_front_bot_10;
  const mesh_bushing_front_bot_10Geometry = endpoint_bushing_front_bot_10
    ? new THREE.CylinderGeometry(endpoint_bushing_front_bot_10.endRadius, endpoint_bushing_front_bot_10.baseRadius, endpoint_bushing_front_bot_10.length, 32, 12)
    : new THREE.ConeGeometry(0.5, 1, 48, 16);
  const mesh_bushing_front_bot_10 = new THREE.Mesh(
    mesh_bushing_front_bot_10Geometry,
    materialMap["bushing-urethane"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bushing_front_bot_10.name = "Front bottom bushing";
  if (endpoint_bushing_front_bot_10) {
    mesh_bushing_front_bot_10.position.copy(endpoint_bushing_front_bot_10.midpoint);
    mesh_bushing_front_bot_10.quaternion.copy(endpoint_bushing_front_bot_10.quaternion);
  }
  mesh_bushing_front_bot_10.castShadow = options.castShadow ?? true;
  mesh_bushing_front_bot_10.receiveShadow = options.receiveShadow ?? true;
  mesh_bushing_front_bot_10.userData.sculptComponent = {"id": "bushing-front-bot", "name": "Front bottom bushing", "level": "meso", "role": "hardware", "importance": 0.35, "confidence": 0.5, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "truncated cone; colour and durometer inferred, hidden in the reference", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-kingpin", "localStart": [0.014, -0.029, 0], "localEnd": [0.0195, -0.04, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.006, "endRadius": 0.011}, "dimensions": {"width": 0.022, "height": 0.012, "depth": 0.022, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.02, -0.032, 0], "rotation": [0, 0, 0.62], "scale": [0.022, 0.012, 0.022]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "bushing-urethane", "materialLayers": ["bushing-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_bushing_front_bot_10.add(mesh_bushing_front_bot_10);
  meshes["bushing-front-bot"] = mesh_bushing_front_bot_10;
  colliders["bushing-front-bot"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_bushing_front_bot_10);

  const attachment_axle_front_11 = {"parentId": "truck-front", "parentSocket": "socket-axle-front", "localStart": [0, -0.0656, -0.129], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "press-fit", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r1c1"], "embedDepth": 0.012, "baseRadius": 0.0049, "endRadius": 0.0049};
  const endpoint_axle_front_11 = makeAttachmentEndpoint(attachment_axle_front_11);
  const node_axle_front_11 = new THREE.Group();
  node_axle_front_11.name = "Front axle__pivot";
  if (endpoint_axle_front_11) {
    node_axle_front_11.position.copy(endpoint_axle_front_11.start);
    node_axle_front_11.rotation.set(0, 0, 0);
    node_axle_front_11.scale.set(1, 1, 1);
  } else {
    node_axle_front_11.position.set(0.0, -0.0656, 0.0);
    node_axle_front_11.rotation.set(1.5708, 0.0, 0.0);
    node_axle_front_11.scale.set(0.0098, 0.258, 0.0098);
  }
  node_axle_front_11.userData.sculptComponent = {"id": "axle-front", "name": "Front axle", "level": "meso", "role": "hardware", "importance": 0.6, "confidence": 0.85, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-axle-front", "localStart": [0, -0.0656, -0.129], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "press-fit", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r1c1"], "embedDepth": 0.012, "baseRadius": 0.0049, "endRadius": 0.0049}, "dimensions": {"width": 0.0098, "height": 0.258, "depth": 0.0098, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.0656, 0], "rotation": [1.5708, 0, 0], "scale": [0.0098, 0.258, 0.0098]}, "actionProfile": {"animationRole": "axle", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_axle_front_11.userData.actionProfile = {"animationRole": "axle", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-front"] ?? root).add(node_axle_front_11);
  nodes["axle-front"] = node_axle_front_11;
  const mesh_axle_front_11Geometry = endpoint_axle_front_11
    ? new THREE.CylinderGeometry(endpoint_axle_front_11.endRadius, endpoint_axle_front_11.baseRadius, endpoint_axle_front_11.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_axle_front_11 = new THREE.Mesh(
    mesh_axle_front_11Geometry,
    materialMap["hardware-steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_axle_front_11.name = "Front axle";
  if (endpoint_axle_front_11) {
    mesh_axle_front_11.position.copy(endpoint_axle_front_11.midpoint);
    mesh_axle_front_11.quaternion.copy(endpoint_axle_front_11.quaternion);
  }
  mesh_axle_front_11.castShadow = options.castShadow ?? true;
  mesh_axle_front_11.receiveShadow = options.receiveShadow ?? true;
  mesh_axle_front_11.userData.sculptComponent = {"id": "axle-front", "name": "Front axle", "level": "meso", "role": "hardware", "importance": 0.6, "confidence": 0.85, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-axle-front", "localStart": [0, -0.0656, -0.129], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "press-fit", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r1c1"], "embedDepth": 0.012, "baseRadius": 0.0049, "endRadius": 0.0049}, "dimensions": {"width": 0.0098, "height": 0.258, "depth": 0.0098, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.0656, 0], "rotation": [1.5708, 0, 0], "scale": [0.0098, 0.258, 0.0098]}, "actionProfile": {"animationRole": "axle", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_axle_front_11.add(mesh_axle_front_11);
  meshes["axle-front"] = mesh_axle_front_11;
  colliders["axle-front"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_axle_front_11);

  const attachment_wheel_front_left_12 = {"parentId": "truck-front", "parentSocket": "socket-axle-front", "localStart": [0, -0.0656, -0.08710000000000001], "localEnd": [0, -0.0656, -0.129], "contactNormal": [0, 0, -1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332};
  const endpoint_wheel_front_left_12 = makeAttachmentEndpoint(attachment_wheel_front_left_12);
  const node_wheel_front_left_12 = new THREE.Group();
  node_wheel_front_left_12.name = "Front left wheel__pivot";
  if (endpoint_wheel_front_left_12) {
    node_wheel_front_left_12.position.copy(endpoint_wheel_front_left_12.start);
    node_wheel_front_left_12.rotation.set(0, 0, 0);
    node_wheel_front_left_12.scale.set(1, 1, 1);
  } else {
    node_wheel_front_left_12.position.set(0.0, -0.0656, -0.10805000000000001);
    node_wheel_front_left_12.rotation.set(1.5708, 0.0, 0.0);
    node_wheel_front_left_12.scale.set(0.0664, 0.0419, 0.0664);
  }
  node_wheel_front_left_12.userData.sculptComponent = {"id": "wheel-front-left", "name": "Front left wheel", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.9, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder for blockout; form-refinement lathes the rounded shoulder profile", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.008, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-axle-front", "localStart": [0, -0.0656, -0.08710000000000001], "localEnd": [0, -0.0656, -0.129], "contactNormal": [0, 0, -1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332}, "dimensions": {"width": 0.0664, "height": 0.0419, "depth": 0.0664, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, -0.0656, -0.10805000000000001], "rotation": [1.5708, 0, 0], "scale": [0.0664, 0.0419, 0.0664]}, "actionProfile": {"animationRole": "front-left-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-front-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}}, "material": "wheel-urethane", "materialLayers": ["wheel-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-shoulder-front-left", "type": "bevel highlight", "placement": "outer rim where the flat face meets the rolling surface", "approximateSize": "0.008 radius", "orientation": "follows surface", "materialEffect": "brighter specular band along the round", "geometryEffect": "generous rounded shoulder, park-wheel profile", "confidence": 0.9, "evidenceRefs": ["zone-r2c2"]}, {"id": "bearing-seat-front-left", "type": "hole or socket", "placement": "centred on the outer wheel face", "approximateSize": "0.022 diameter x 0.007 deep", "orientation": "follows surface", "materialEffect": "dark maroon-brown, strong cavity AO, bright axle nut at centre", "geometryEffect": "cylindrical recess with a concentric shield ring", "confidence": 0.9, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.3, "bumpAmplitude": 0.006, "normalPattern": "fine mould-release stipple", "displacementPattern": "none", "occlusionPattern": "bearing recess darkening", "edgeWearPattern": "flat-spot scuffing on the rolling surface", "notes": "Bone-cream urethane, soft sheen, not glossy plastic."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_wheel_front_left_12.userData.actionProfile = {"animationRole": "front-left-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-front-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-front"] ?? root).add(node_wheel_front_left_12);
  nodes["wheel-front-left"] = node_wheel_front_left_12;
  const mesh_wheel_front_left_12Geometry = endpoint_wheel_front_left_12
    ? new THREE.CylinderGeometry(endpoint_wheel_front_left_12.endRadius, endpoint_wheel_front_left_12.baseRadius, endpoint_wheel_front_left_12.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_wheel_front_left_12 = new THREE.Mesh(
    mesh_wheel_front_left_12Geometry,
    materialMap["wheel-urethane"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_front_left_12.name = "Front left wheel";
  if (endpoint_wheel_front_left_12) {
    mesh_wheel_front_left_12.position.copy(endpoint_wheel_front_left_12.midpoint);
    mesh_wheel_front_left_12.quaternion.copy(endpoint_wheel_front_left_12.quaternion);
  }
  mesh_wheel_front_left_12.castShadow = options.castShadow ?? true;
  mesh_wheel_front_left_12.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_front_left_12.userData.sculptComponent = {"id": "wheel-front-left", "name": "Front left wheel", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.9, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder for blockout; form-refinement lathes the rounded shoulder profile", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.008, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-axle-front", "localStart": [0, -0.0656, -0.08710000000000001], "localEnd": [0, -0.0656, -0.129], "contactNormal": [0, 0, -1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332}, "dimensions": {"width": 0.0664, "height": 0.0419, "depth": 0.0664, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, -0.0656, -0.10805000000000001], "rotation": [1.5708, 0, 0], "scale": [0.0664, 0.0419, 0.0664]}, "actionProfile": {"animationRole": "front-left-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-front-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}}, "material": "wheel-urethane", "materialLayers": ["wheel-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-shoulder-front-left", "type": "bevel highlight", "placement": "outer rim where the flat face meets the rolling surface", "approximateSize": "0.008 radius", "orientation": "follows surface", "materialEffect": "brighter specular band along the round", "geometryEffect": "generous rounded shoulder, park-wheel profile", "confidence": 0.9, "evidenceRefs": ["zone-r2c2"]}, {"id": "bearing-seat-front-left", "type": "hole or socket", "placement": "centred on the outer wheel face", "approximateSize": "0.022 diameter x 0.007 deep", "orientation": "follows surface", "materialEffect": "dark maroon-brown, strong cavity AO, bright axle nut at centre", "geometryEffect": "cylindrical recess with a concentric shield ring", "confidence": 0.9, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.3, "bumpAmplitude": 0.006, "normalPattern": "fine mould-release stipple", "displacementPattern": "none", "occlusionPattern": "bearing recess darkening", "edgeWearPattern": "flat-spot scuffing on the rolling surface", "notes": "Bone-cream urethane, soft sheen, not glossy plastic."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_wheel_front_left_12.add(mesh_wheel_front_left_12);
  meshes["wheel-front-left"] = mesh_wheel_front_left_12;
  colliders["wheel-front-left"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["wheel-front-left"] ??= [];
  destructionGroups["wheel-front-left"].push(node_wheel_front_left_12);

  const attachment_wheel_front_right_13 = {"parentId": "truck-front", "parentSocket": "socket-axle-front", "localStart": [0, -0.0656, 0.08710000000000001], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332};
  const endpoint_wheel_front_right_13 = makeAttachmentEndpoint(attachment_wheel_front_right_13);
  const node_wheel_front_right_13 = new THREE.Group();
  node_wheel_front_right_13.name = "Front right wheel__pivot";
  if (endpoint_wheel_front_right_13) {
    node_wheel_front_right_13.position.copy(endpoint_wheel_front_right_13.start);
    node_wheel_front_right_13.rotation.set(0, 0, 0);
    node_wheel_front_right_13.scale.set(1, 1, 1);
  } else {
    node_wheel_front_right_13.position.set(0.0, -0.0656, 0.10805000000000001);
    node_wheel_front_right_13.rotation.set(1.5708, 0.0, 0.0);
    node_wheel_front_right_13.scale.set(0.0664, 0.0419, 0.0664);
  }
  node_wheel_front_right_13.userData.sculptComponent = {"id": "wheel-front-right", "name": "Front right wheel", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.9, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder for blockout; form-refinement lathes the rounded shoulder profile", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.008, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-axle-front", "localStart": [0, -0.0656, 0.08710000000000001], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332}, "dimensions": {"width": 0.0664, "height": 0.0419, "depth": 0.0664, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, -0.0656, 0.10805000000000001], "rotation": [1.5708, 0, 0], "scale": [0.0664, 0.0419, 0.0664]}, "actionProfile": {"animationRole": "front-right-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-front-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}}, "material": "wheel-urethane", "materialLayers": ["wheel-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-shoulder-front-right", "type": "bevel highlight", "placement": "outer rim where the flat face meets the rolling surface", "approximateSize": "0.008 radius", "orientation": "follows surface", "materialEffect": "brighter specular band along the round", "geometryEffect": "generous rounded shoulder, park-wheel profile", "confidence": 0.9, "evidenceRefs": ["zone-r2c2"]}, {"id": "bearing-seat-front-right", "type": "hole or socket", "placement": "centred on the outer wheel face", "approximateSize": "0.022 diameter x 0.007 deep", "orientation": "follows surface", "materialEffect": "dark maroon-brown, strong cavity AO, bright axle nut at centre", "geometryEffect": "cylindrical recess with a concentric shield ring", "confidence": 0.9, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.3, "bumpAmplitude": 0.006, "normalPattern": "fine mould-release stipple", "displacementPattern": "none", "occlusionPattern": "bearing recess darkening", "edgeWearPattern": "flat-spot scuffing on the rolling surface", "notes": "Bone-cream urethane, soft sheen, not glossy plastic."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_wheel_front_right_13.userData.actionProfile = {"animationRole": "front-right-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-front-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-front"] ?? root).add(node_wheel_front_right_13);
  nodes["wheel-front-right"] = node_wheel_front_right_13;
  const mesh_wheel_front_right_13Geometry = endpoint_wheel_front_right_13
    ? new THREE.CylinderGeometry(endpoint_wheel_front_right_13.endRadius, endpoint_wheel_front_right_13.baseRadius, endpoint_wheel_front_right_13.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_wheel_front_right_13 = new THREE.Mesh(
    mesh_wheel_front_right_13Geometry,
    materialMap["wheel-urethane"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_front_right_13.name = "Front right wheel";
  if (endpoint_wheel_front_right_13) {
    mesh_wheel_front_right_13.position.copy(endpoint_wheel_front_right_13.midpoint);
    mesh_wheel_front_right_13.quaternion.copy(endpoint_wheel_front_right_13.quaternion);
  }
  mesh_wheel_front_right_13.castShadow = options.castShadow ?? true;
  mesh_wheel_front_right_13.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_front_right_13.userData.sculptComponent = {"id": "wheel-front-right", "name": "Front right wheel", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.9, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder for blockout; form-refinement lathes the rounded shoulder profile", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.008, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": {"parentId": "truck-front", "parentSocket": "socket-axle-front", "localStart": [0, -0.0656, 0.08710000000000001], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332}, "dimensions": {"width": 0.0664, "height": 0.0419, "depth": 0.0664, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, -0.0656, 0.10805000000000001], "rotation": [1.5708, 0, 0], "scale": [0.0664, 0.0419, 0.0664]}, "actionProfile": {"animationRole": "front-right-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-front-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}}, "material": "wheel-urethane", "materialLayers": ["wheel-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-shoulder-front-right", "type": "bevel highlight", "placement": "outer rim where the flat face meets the rolling surface", "approximateSize": "0.008 radius", "orientation": "follows surface", "materialEffect": "brighter specular band along the round", "geometryEffect": "generous rounded shoulder, park-wheel profile", "confidence": 0.9, "evidenceRefs": ["zone-r2c2"]}, {"id": "bearing-seat-front-right", "type": "hole or socket", "placement": "centred on the outer wheel face", "approximateSize": "0.022 diameter x 0.007 deep", "orientation": "follows surface", "materialEffect": "dark maroon-brown, strong cavity AO, bright axle nut at centre", "geometryEffect": "cylindrical recess with a concentric shield ring", "confidence": 0.9, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.3, "bumpAmplitude": 0.006, "normalPattern": "fine mould-release stipple", "displacementPattern": "none", "occlusionPattern": "bearing recess darkening", "edgeWearPattern": "flat-spot scuffing on the rolling surface", "notes": "Bone-cream urethane, soft sheen, not glossy plastic."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_wheel_front_right_13.add(mesh_wheel_front_right_13);
  meshes["wheel-front-right"] = mesh_wheel_front_right_13;
  colliders["wheel-front-right"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["wheel-front-right"] ??= [];
  destructionGroups["wheel-front-right"].push(node_wheel_front_right_13);

  const attachment_mount_bolts_front_14 = null;
  const endpoint_mount_bolts_front_14 = makeAttachmentEndpoint(attachment_mount_bolts_front_14);
  const node_mount_bolts_front_14 = new THREE.Group();
  node_mount_bolts_front_14.name = "Front mounting bolts__pivot";
  if (endpoint_mount_bolts_front_14) {
    node_mount_bolts_front_14.position.copy(endpoint_mount_bolts_front_14.start);
    node_mount_bolts_front_14.rotation.set(0, 0, 0);
    node_mount_bolts_front_14.scale.set(1, 1, 1);
  } else {
    node_mount_bolts_front_14.position.set(0.0, 0.002, 0.0);
    node_mount_bolts_front_14.rotation.set(0.0, 0.0, 0.0);
    node_mount_bolts_front_14.scale.set(0.0416, 0.004, 0.102);
  }
  node_mount_bolts_front_14.userData.sculptComponent = {"id": "mount-bolts-front", "name": "Front mounting bolts", "level": "micro", "role": "hardware", "importance": 0.5, "confidence": 0.85, "primitive": "instanced-cluster", "geometryDescriptor": {"topologyIntent": "4x InstancedMesh, rectangular pattern", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": null, "dimensions": {"width": 0.0416, "height": 0.004, "depth": 0.102, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.002, 0], "rotation": [0, 0, 0], "scale": [0.0416, 0.004, 0.102]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bolt-head-recess-front", "type": "screw or rivet", "placement": "four corners of a 0.0416 x 0.102 rectangle on the deck face", "approximateSize": "0.009 head diameter", "orientation": "follows surface", "materialEffect": "dark steel with a bright worn rim ring", "geometryEffect": "countersunk head sitting flush in the deck", "confidence": 0.85, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_mount_bolts_front_14.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-front"] ?? root).add(node_mount_bolts_front_14);
  nodes["mount-bolts-front"] = node_mount_bolts_front_14;
  const mesh_mount_bolts_front_14Geometry = endpoint_mount_bolts_front_14
    ? new THREE.CylinderGeometry(endpoint_mount_bolts_front_14.endRadius, endpoint_mount_bolts_front_14.baseRadius, endpoint_mount_bolts_front_14.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const mesh_mount_bolts_front_14 = new THREE.Mesh(
    mesh_mount_bolts_front_14Geometry,
    materialMap["hardware-steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mount_bolts_front_14.name = "Front mounting bolts";
  if (endpoint_mount_bolts_front_14) {
    mesh_mount_bolts_front_14.position.copy(endpoint_mount_bolts_front_14.midpoint);
    mesh_mount_bolts_front_14.quaternion.copy(endpoint_mount_bolts_front_14.quaternion);
  }
  mesh_mount_bolts_front_14.castShadow = options.castShadow ?? true;
  mesh_mount_bolts_front_14.receiveShadow = options.receiveShadow ?? true;
  mesh_mount_bolts_front_14.userData.sculptComponent = {"id": "mount-bolts-front", "name": "Front mounting bolts", "level": "micro", "role": "hardware", "importance": 0.5, "confidence": 0.85, "primitive": "instanced-cluster", "geometryDescriptor": {"topologyIntent": "4x InstancedMesh, rectangular pattern", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-front", "attachment": null, "dimensions": {"width": 0.0416, "height": 0.004, "depth": 0.102, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.002, 0], "rotation": [0, 0, 0], "scale": [0.0416, 0.004, 0.102]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bolt-head-recess-front", "type": "screw or rivet", "placement": "four corners of a 0.0416 x 0.102 rectangle on the deck face", "approximateSize": "0.009 head diameter", "orientation": "follows surface", "materialEffect": "dark steel with a bright worn rim ring", "geometryEffect": "countersunk head sitting flush in the deck", "confidence": 0.85, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_mount_bolts_front_14.add(mesh_mount_bolts_front_14);
  meshes["mount-bolts-front"] = mesh_mount_bolts_front_14;
  colliders["mount-bolts-front"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_mount_bolts_front_14);
  // TODO: replace 'mount-bolts-front' box fallback with instanced-cluster procedural geometry.

  const attachment_truck_rear_15 = null;
  const endpoint_truck_rear_15 = makeAttachmentEndpoint(attachment_truck_rear_15);
  const node_truck_rear_15 = new THREE.Group();
  node_truck_rear_15.name = "Rear truck assembly__pivot";
  if (endpoint_truck_rear_15) {
    node_truck_rear_15.position.copy(endpoint_truck_rear_15.start);
    node_truck_rear_15.rotation.set(0, 0, 0);
    node_truck_rear_15.scale.set(1, 1, 1);
  } else {
    node_truck_rear_15.position.set(-0.2265, -0.0069, 0.0);
    node_truck_rear_15.rotation.set(0.0, 0.0, 0.0);
    node_truck_rear_15.scale.set(1.0, 1.0, 1.0);
  }
  node_truck_rear_15.userData.sculptComponent = {"id": "truck-rear", "name": "Rear truck assembly", "level": "macro", "role": "structure", "importance": 0.95, "confidence": 0.85, "primitive": "box", "geometryDescriptor": {"topologyIntent": "turning assembly pivoting about the kingpin axis", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.075, "height": 0.0746, "depth": 0.258, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.2265, -0.0069, 0], "rotation": [0, 0, 0], "scale": [1.0, 1.0, 1.0]}, "actionProfile": {"animationRole": "rear-truck", "pivot": {"mode": "custom", "localPosition": [0, -0.012, 0], "axis": [-1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-axle-rear", "localPosition": [0, -0.0656, 0], "localNormal": [0, 0, 1], "purpose": "wheel axle line"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "truck-rear", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1", "zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": true};
  node_truck_rear_15.userData.actionProfile = {"animationRole": "rear-truck", "pivot": {"mode": "custom", "localPosition": [0, -0.012, 0], "axis": [-1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-axle-rear", "localPosition": [0, -0.0656, 0], "localNormal": [0, 0, 1], "purpose": "wheel axle line"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "truck-rear", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["root"] ?? root).add(node_truck_rear_15);
  nodes["truck-rear"] = node_truck_rear_15;
  const mesh_truck_rear_15Geometry = endpoint_truck_rear_15
    ? new THREE.CylinderGeometry(endpoint_truck_rear_15.endRadius, endpoint_truck_rear_15.baseRadius, endpoint_truck_rear_15.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_truck_rear_15 = new THREE.Mesh(
    mesh_truck_rear_15Geometry,
    materialMap["cast-aluminium"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_truck_rear_15.name = "Rear truck assembly";
  if (endpoint_truck_rear_15) {
    mesh_truck_rear_15.position.copy(endpoint_truck_rear_15.midpoint);
    mesh_truck_rear_15.quaternion.copy(endpoint_truck_rear_15.quaternion);
  }
  mesh_truck_rear_15.castShadow = options.castShadow ?? true;
  mesh_truck_rear_15.receiveShadow = options.receiveShadow ?? true;
  mesh_truck_rear_15.userData.sculptComponent = {"id": "truck-rear", "name": "Rear truck assembly", "level": "macro", "role": "structure", "importance": 0.95, "confidence": 0.85, "primitive": "box", "geometryDescriptor": {"topologyIntent": "turning assembly pivoting about the kingpin axis", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.075, "height": 0.0746, "depth": 0.258, "units": "relative", "confidence": 0.85}, "transform": {"position": [-0.2265, -0.0069, 0], "rotation": [0, 0, 0], "scale": [1.0, 1.0, 1.0]}, "actionProfile": {"animationRole": "rear-truck", "pivot": {"mode": "custom", "localPosition": [0, -0.012, 0], "axis": [-1, 0, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "socket-axle-rear", "localPosition": [0, -0.0656, 0], "localNormal": [0, 0, 1], "purpose": "wheel axle line"}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "truck-rear", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1", "zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": true};
  node_truck_rear_15.add(mesh_truck_rear_15);
  meshes["truck-rear"] = mesh_truck_rear_15;
  colliders["truck-rear"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["truck-rear"] ??= [];
  destructionGroups["truck-rear"].push(node_truck_rear_15);
  const socket_truck_rear_socket_axle_rear_0 = new THREE.Object3D();
  socket_truck_rear_socket_axle_rear_0.name = "socket-axle-rear";
  socket_truck_rear_socket_axle_rear_0.position.set(0.0, -0.0656, 0.0);
  socket_truck_rear_socket_axle_rear_0.rotation.set(0, 0, 0);
  socket_truck_rear_socket_axle_rear_0.userData.socket = {"id": "socket-axle-rear", "localPosition": [0, -0.0656, 0], "localNormal": [0, 0, 1], "purpose": "wheel axle line"};
  node_truck_rear_15.add(socket_truck_rear_socket_axle_rear_0);
  sockets["truck-rear:socket-axle-rear"] = socket_truck_rear_socket_axle_rear_0;

  const attachment_baseplate_rear_16 = null;
  const endpoint_baseplate_rear_16 = makeAttachmentEndpoint(attachment_baseplate_rear_16);
  const node_baseplate_rear_16 = new THREE.Group();
  node_baseplate_rear_16.name = "Rear baseplate__pivot";
  if (endpoint_baseplate_rear_16) {
    node_baseplate_rear_16.position.copy(endpoint_baseplate_rear_16.start);
    node_baseplate_rear_16.rotation.set(0, 0, 0);
    node_baseplate_rear_16.scale.set(1, 1, 1);
  } else {
    node_baseplate_rear_16.position.set(0.0, -0.0045, 0.0);
    node_baseplate_rear_16.rotation.set(0.0, 0.0, 0.0);
    node_baseplate_rear_16.scale.set(0.075, 0.009, 0.062);
  }
  node_baseplate_rear_16.userData.sculptComponent = {"id": "baseplate-rear", "name": "Rear baseplate", "level": "meso", "role": "structure", "importance": 0.8, "confidence": 0.85, "primitive": "box", "geometryDescriptor": {"topologyIntent": "box blockout", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.006, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": null, "dimensions": {"width": 0.075, "height": 0.009, "depth": 0.062, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.0045, 0], "rotation": [0, 0, 0], "scale": [0.075, 0.009, 0.062]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "baseplate-corner-radius-rear", "type": "bevel highlight", "placement": "all four baseplate corners", "approximateSize": "0.006 radius", "orientation": "follows surface", "materialEffect": "slightly polished vs the cast face", "geometryEffect": "rounded corner catches the key light as a bright arc", "confidence": 0.85, "evidenceRefs": ["zone-r2c2"]}, {"id": "pivot-cup-recess-rear", "type": "hole or socket", "placement": "outboard end of the baseplate, on the deck-facing side", "approximateSize": "0.014 diameter", "orientation": "follows surface", "materialEffect": "darker cavity AO", "geometryEffect": "cylindrical recess receiving the hanger pivot", "confidence": 0.75, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_baseplate_rear_16.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-rear"] ?? root).add(node_baseplate_rear_16);
  nodes["baseplate-rear"] = node_baseplate_rear_16;
  const mesh_baseplate_rear_16Geometry = endpoint_baseplate_rear_16
    ? new THREE.CylinderGeometry(endpoint_baseplate_rear_16.endRadius, endpoint_baseplate_rear_16.baseRadius, endpoint_baseplate_rear_16.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_baseplate_rear_16 = new THREE.Mesh(
    mesh_baseplate_rear_16Geometry,
    materialMap["cast-aluminium"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_baseplate_rear_16.name = "Rear baseplate";
  if (endpoint_baseplate_rear_16) {
    mesh_baseplate_rear_16.position.copy(endpoint_baseplate_rear_16.midpoint);
    mesh_baseplate_rear_16.quaternion.copy(endpoint_baseplate_rear_16.quaternion);
  }
  mesh_baseplate_rear_16.castShadow = options.castShadow ?? true;
  mesh_baseplate_rear_16.receiveShadow = options.receiveShadow ?? true;
  mesh_baseplate_rear_16.userData.sculptComponent = {"id": "baseplate-rear", "name": "Rear baseplate", "level": "meso", "role": "structure", "importance": 0.8, "confidence": 0.85, "primitive": "box", "geometryDescriptor": {"topologyIntent": "box blockout", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.006, "segments": 3}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": null, "dimensions": {"width": 0.075, "height": 0.009, "depth": 0.062, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.0045, 0], "rotation": [0, 0, 0], "scale": [0.075, 0.009, 0.062]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "baseplate-corner-radius-rear", "type": "bevel highlight", "placement": "all four baseplate corners", "approximateSize": "0.006 radius", "orientation": "follows surface", "materialEffect": "slightly polished vs the cast face", "geometryEffect": "rounded corner catches the key light as a bright arc", "confidence": 0.85, "evidenceRefs": ["zone-r2c2"]}, {"id": "pivot-cup-recess-rear", "type": "hole or socket", "placement": "outboard end of the baseplate, on the deck-facing side", "approximateSize": "0.014 diameter", "orientation": "follows surface", "materialEffect": "darker cavity AO", "geometryEffect": "cylindrical recess receiving the hanger pivot", "confidence": 0.75, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_baseplate_rear_16.add(mesh_baseplate_rear_16);
  meshes["baseplate-rear"] = mesh_baseplate_rear_16;
  colliders["baseplate-rear"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_baseplate_rear_16);

  const attachment_hanger_rear_17 = null;
  const endpoint_hanger_rear_17 = makeAttachmentEndpoint(attachment_hanger_rear_17);
  const node_hanger_rear_17 = new THREE.Group();
  node_hanger_rear_17.name = "Rear hanger__pivot";
  if (endpoint_hanger_rear_17) {
    node_hanger_rear_17.position.copy(endpoint_hanger_rear_17.start);
    node_hanger_rear_17.rotation.set(0, 0, 0);
    node_hanger_rear_17.scale.set(1, 1, 1);
  } else {
    node_hanger_rear_17.position.set(0.0, -0.0616, 0.0);
    node_hanger_rear_17.rotation.set(0.0, 0.0, 0.0);
    node_hanger_rear_17.scale.set(0.055, 0.026, 0.105);
  }
  node_hanger_rear_17.userData.sculptComponent = {"id": "hanger-rear", "name": "Rear hanger", "level": "meso", "role": "structure", "importance": 0.9, "confidence": 0.8, "primitive": "box", "geometryDescriptor": {"topologyIntent": "tapered cast arm; form-refinement lofts it from the yoke out to the axle boss", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.004, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": null, "dimensions": {"width": 0.055, "height": 0.026, "depth": 0.105, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.0616, 0], "rotation": [0, 0, 0], "scale": [0.055, 0.026, 0.105]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "hanger-yoke-rear", "type": "recessed groove", "placement": "centre of the hanger where the kingpin passes through", "approximateSize": "0.018 wide slot", "orientation": "follows surface", "materialEffect": "deep cavity occlusion", "geometryEffect": "V-shaped yoke opening toward the baseplate", "confidence": 0.8, "evidenceRefs": ["zone-r2c2"]}, {"id": "hanger-casting-parting-line-rear", "type": "seam line", "placement": "horizontal line around the hanger mid-height", "approximateSize": "0.0015 wide", "orientation": "follows surface", "materialEffect": "slightly rougher, catches dirt", "geometryEffect": "shallow raised ridge from the casting mould split", "confidence": 0.7, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.38, "bumpAmplitude": 0.02, "normalPattern": "irregular casting pits, poisson-scattered", "displacementPattern": "none", "occlusionPattern": "cavity-darkened yoke and pivot recess", "edgeWearPattern": "polished bright along grind edges", "notes": "Raw sand-cast aluminium: satin, never mirror."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_hanger_rear_17.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-rear"] ?? root).add(node_hanger_rear_17);
  nodes["hanger-rear"] = node_hanger_rear_17;
  const mesh_hanger_rear_17Geometry = endpoint_hanger_rear_17
    ? new THREE.CylinderGeometry(endpoint_hanger_rear_17.endRadius, endpoint_hanger_rear_17.baseRadius, endpoint_hanger_rear_17.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_hanger_rear_17 = new THREE.Mesh(
    mesh_hanger_rear_17Geometry,
    materialMap["cast-aluminium"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hanger_rear_17.name = "Rear hanger";
  if (endpoint_hanger_rear_17) {
    mesh_hanger_rear_17.position.copy(endpoint_hanger_rear_17.midpoint);
    mesh_hanger_rear_17.quaternion.copy(endpoint_hanger_rear_17.quaternion);
  }
  mesh_hanger_rear_17.castShadow = options.castShadow ?? true;
  mesh_hanger_rear_17.receiveShadow = options.receiveShadow ?? true;
  mesh_hanger_rear_17.userData.sculptComponent = {"id": "hanger-rear", "name": "Rear hanger", "level": "meso", "role": "structure", "importance": 0.9, "confidence": 0.8, "primitive": "box", "geometryDescriptor": {"topologyIntent": "tapered cast arm; form-refinement lofts it from the yoke out to the axle boss", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.004, "segments": 2}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": null, "dimensions": {"width": 0.055, "height": 0.026, "depth": 0.105, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, -0.0616, 0], "rotation": [0, 0, 0], "scale": [0.055, 0.026, 0.105]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "hanger-yoke-rear", "type": "recessed groove", "placement": "centre of the hanger where the kingpin passes through", "approximateSize": "0.018 wide slot", "orientation": "follows surface", "materialEffect": "deep cavity occlusion", "geometryEffect": "V-shaped yoke opening toward the baseplate", "confidence": 0.8, "evidenceRefs": ["zone-r2c2"]}, {"id": "hanger-casting-parting-line-rear", "type": "seam line", "placement": "horizontal line around the hanger mid-height", "approximateSize": "0.0015 wide", "orientation": "follows surface", "materialEffect": "slightly rougher, catches dirt", "geometryEffect": "shallow raised ridge from the casting mould split", "confidence": 0.7, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.55, "microRoughness": 0.38, "bumpAmplitude": 0.02, "normalPattern": "irregular casting pits, poisson-scattered", "displacementPattern": "none", "occlusionPattern": "cavity-darkened yoke and pivot recess", "edgeWearPattern": "polished bright along grind edges", "notes": "Raw sand-cast aluminium: satin, never mirror."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_hanger_rear_17.add(mesh_hanger_rear_17);
  meshes["hanger-rear"] = mesh_hanger_rear_17;
  colliders["hanger-rear"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_hanger_rear_17);

  const attachment_kingpin_rear_18 = {"parentId": "truck-rear", "parentSocket": "socket-kingpin", "localStart": [-0.004, -0.009, 0], "localEnd": [-0.02, -0.042, 0], "contactNormal": [0, -1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.006, "baseRadius": 0.004, "endRadius": 0.004};
  const endpoint_kingpin_rear_18 = makeAttachmentEndpoint(attachment_kingpin_rear_18);
  const node_kingpin_rear_18 = new THREE.Group();
  node_kingpin_rear_18.name = "Rear kingpin__pivot";
  if (endpoint_kingpin_rear_18) {
    node_kingpin_rear_18.position.copy(endpoint_kingpin_rear_18.start);
    node_kingpin_rear_18.rotation.set(0, 0, 0);
    node_kingpin_rear_18.scale.set(1, 1, 1);
  } else {
    node_kingpin_rear_18.position.set(-0.012, -0.024, 0.0);
    node_kingpin_rear_18.rotation.set(0.0, 0.0, -0.62);
    node_kingpin_rear_18.scale.set(0.008, 0.04, 0.008);
  }
  node_kingpin_rear_18.userData.sculptComponent = {"id": "kingpin-rear", "name": "Rear kingpin", "level": "meso", "role": "hardware", "importance": 0.6, "confidence": 0.75, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-kingpin", "localStart": [-0.004, -0.009, 0], "localEnd": [-0.02, -0.042, 0], "contactNormal": [0, -1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.006, "baseRadius": 0.004, "endRadius": 0.004}, "dimensions": {"width": 0.008, "height": 0.04, "depth": 0.008, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.012, -0.024, 0], "rotation": [0, 0, -0.62], "scale": [0.008, 0.04, 0.008]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_kingpin_rear_18.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-rear"] ?? root).add(node_kingpin_rear_18);
  nodes["kingpin-rear"] = node_kingpin_rear_18;
  const mesh_kingpin_rear_18Geometry = endpoint_kingpin_rear_18
    ? new THREE.CylinderGeometry(endpoint_kingpin_rear_18.endRadius, endpoint_kingpin_rear_18.baseRadius, endpoint_kingpin_rear_18.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_kingpin_rear_18 = new THREE.Mesh(
    mesh_kingpin_rear_18Geometry,
    materialMap["hardware-steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_kingpin_rear_18.name = "Rear kingpin";
  if (endpoint_kingpin_rear_18) {
    mesh_kingpin_rear_18.position.copy(endpoint_kingpin_rear_18.midpoint);
    mesh_kingpin_rear_18.quaternion.copy(endpoint_kingpin_rear_18.quaternion);
  }
  mesh_kingpin_rear_18.castShadow = options.castShadow ?? true;
  mesh_kingpin_rear_18.receiveShadow = options.receiveShadow ?? true;
  mesh_kingpin_rear_18.userData.sculptComponent = {"id": "kingpin-rear", "name": "Rear kingpin", "level": "meso", "role": "hardware", "importance": 0.6, "confidence": 0.75, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-kingpin", "localStart": [-0.004, -0.009, 0], "localEnd": [-0.02, -0.042, 0], "contactNormal": [0, -1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.006, "baseRadius": 0.004, "endRadius": 0.004}, "dimensions": {"width": 0.008, "height": 0.04, "depth": 0.008, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.012, -0.024, 0], "rotation": [0, 0, -0.62], "scale": [0.008, 0.04, 0.008]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_kingpin_rear_18.add(mesh_kingpin_rear_18);
  meshes["kingpin-rear"] = mesh_kingpin_rear_18;
  colliders["kingpin-rear"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_kingpin_rear_18);

  const attachment_kingpin_nut_rear_19 = {"parentId": "truck-rear", "parentSocket": "socket-nut", "localStart": [-0.02, -0.042, 0], "localEnd": [-0.0228, -0.0478, 0], "contactNormal": [0, 1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.004, "baseRadius": 0.006, "endRadius": 0.006};
  const endpoint_kingpin_nut_rear_19 = makeAttachmentEndpoint(attachment_kingpin_nut_rear_19);
  const node_kingpin_nut_rear_19 = new THREE.Group();
  node_kingpin_nut_rear_19.name = "Rear kingpin nut__pivot";
  if (endpoint_kingpin_nut_rear_19) {
    node_kingpin_nut_rear_19.position.copy(endpoint_kingpin_nut_rear_19.start);
    node_kingpin_nut_rear_19.rotation.set(0, 0, 0);
    node_kingpin_nut_rear_19.scale.set(1, 1, 1);
  } else {
    node_kingpin_nut_rear_19.position.set(-0.021, -0.043, 0.0);
    node_kingpin_nut_rear_19.rotation.set(0.0, 0.0, -0.62);
    node_kingpin_nut_rear_19.scale.set(0.012, 0.006, 0.012);
  }
  node_kingpin_nut_rear_19.userData.sculptComponent = {"id": "kingpin-nut-rear", "name": "Rear kingpin nut", "level": "micro", "role": "hardware", "importance": 0.45, "confidence": 0.8, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-nut", "localStart": [-0.02, -0.042, 0], "localEnd": [-0.0228, -0.0478, 0], "contactNormal": [0, 1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.004, "baseRadius": 0.006, "endRadius": 0.006}, "dimensions": {"width": 0.012, "height": 0.006, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.021, -0.043, 0], "rotation": [0, 0, -0.62], "scale": [0.012, 0.006, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "kingpin-nut-facets-rear", "type": "bevel highlight", "placement": "six flats around the nut", "approximateSize": "0.012 across flats", "orientation": "follows surface", "materialEffect": "smoother and darker than the raw casting", "geometryEffect": "hex prism, not a smooth cylinder", "confidence": 0.85, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_kingpin_nut_rear_19.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-rear"] ?? root).add(node_kingpin_nut_rear_19);
  nodes["kingpin-nut-rear"] = node_kingpin_nut_rear_19;
  const mesh_kingpin_nut_rear_19Geometry = endpoint_kingpin_nut_rear_19
    ? new THREE.CylinderGeometry(endpoint_kingpin_nut_rear_19.endRadius, endpoint_kingpin_nut_rear_19.baseRadius, endpoint_kingpin_nut_rear_19.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_kingpin_nut_rear_19 = new THREE.Mesh(
    mesh_kingpin_nut_rear_19Geometry,
    materialMap["hardware-steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_kingpin_nut_rear_19.name = "Rear kingpin nut";
  if (endpoint_kingpin_nut_rear_19) {
    mesh_kingpin_nut_rear_19.position.copy(endpoint_kingpin_nut_rear_19.midpoint);
    mesh_kingpin_nut_rear_19.quaternion.copy(endpoint_kingpin_nut_rear_19.quaternion);
  }
  mesh_kingpin_nut_rear_19.castShadow = options.castShadow ?? true;
  mesh_kingpin_nut_rear_19.receiveShadow = options.receiveShadow ?? true;
  mesh_kingpin_nut_rear_19.userData.sculptComponent = {"id": "kingpin-nut-rear", "name": "Rear kingpin nut", "level": "micro", "role": "hardware", "importance": 0.45, "confidence": 0.8, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-nut", "localStart": [-0.02, -0.042, 0], "localEnd": [-0.0228, -0.0478, 0], "contactNormal": [0, 1, 0], "contactType": "threaded", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.004, "baseRadius": 0.006, "endRadius": 0.006}, "dimensions": {"width": 0.012, "height": 0.006, "depth": 0.012, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.021, -0.043, 0], "rotation": [0, 0, -0.62], "scale": [0.012, 0.006, 0.012]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "kingpin-nut-facets-rear", "type": "bevel highlight", "placement": "six flats around the nut", "approximateSize": "0.012 across flats", "orientation": "follows surface", "materialEffect": "smoother and darker than the raw casting", "geometryEffect": "hex prism, not a smooth cylinder", "confidence": 0.85, "evidenceRefs": ["zone-r2c2"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_kingpin_nut_rear_19.add(mesh_kingpin_nut_rear_19);
  meshes["kingpin-nut-rear"] = mesh_kingpin_nut_rear_19;
  colliders["kingpin-nut-rear"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_kingpin_nut_rear_19);

  const attachment_bushing_rear_top_20 = {"parentId": "truck-rear", "parentSocket": "socket-kingpin", "localStart": [-0.008, -0.017, 0], "localEnd": [-0.014, -0.029, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.011, "endRadius": 0.006};
  const endpoint_bushing_rear_top_20 = makeAttachmentEndpoint(attachment_bushing_rear_top_20);
  const node_bushing_rear_top_20 = new THREE.Group();
  node_bushing_rear_top_20.name = "Rear top bushing__pivot";
  if (endpoint_bushing_rear_top_20) {
    node_bushing_rear_top_20.position.copy(endpoint_bushing_rear_top_20.start);
    node_bushing_rear_top_20.rotation.set(0, 0, 0);
    node_bushing_rear_top_20.scale.set(1, 1, 1);
  } else {
    node_bushing_rear_top_20.position.set(-0.014, -0.018, 0.0);
    node_bushing_rear_top_20.rotation.set(0.0, 0.0, -0.62);
    node_bushing_rear_top_20.scale.set(0.022, 0.012, 0.022);
  }
  node_bushing_rear_top_20.userData.sculptComponent = {"id": "bushing-rear-top", "name": "Rear top bushing", "level": "meso", "role": "hardware", "importance": 0.35, "confidence": 0.5, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "truncated cone; colour and durometer inferred, hidden in the reference", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-kingpin", "localStart": [-0.008, -0.017, 0], "localEnd": [-0.014, -0.029, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.011, "endRadius": 0.006}, "dimensions": {"width": 0.022, "height": 0.012, "depth": 0.022, "units": "relative", "confidence": 0.5}, "transform": {"position": [-0.014, -0.018, 0], "rotation": [0, 0, -0.62], "scale": [0.022, 0.012, 0.022]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "bushing-urethane", "materialLayers": ["bushing-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_bushing_rear_top_20.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-rear"] ?? root).add(node_bushing_rear_top_20);
  nodes["bushing-rear-top"] = node_bushing_rear_top_20;
  const mesh_bushing_rear_top_20Geometry = endpoint_bushing_rear_top_20
    ? new THREE.CylinderGeometry(endpoint_bushing_rear_top_20.endRadius, endpoint_bushing_rear_top_20.baseRadius, endpoint_bushing_rear_top_20.length, 32, 12)
    : new THREE.ConeGeometry(0.5, 1, 48, 16);
  const mesh_bushing_rear_top_20 = new THREE.Mesh(
    mesh_bushing_rear_top_20Geometry,
    materialMap["bushing-urethane"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bushing_rear_top_20.name = "Rear top bushing";
  if (endpoint_bushing_rear_top_20) {
    mesh_bushing_rear_top_20.position.copy(endpoint_bushing_rear_top_20.midpoint);
    mesh_bushing_rear_top_20.quaternion.copy(endpoint_bushing_rear_top_20.quaternion);
  }
  mesh_bushing_rear_top_20.castShadow = options.castShadow ?? true;
  mesh_bushing_rear_top_20.receiveShadow = options.receiveShadow ?? true;
  mesh_bushing_rear_top_20.userData.sculptComponent = {"id": "bushing-rear-top", "name": "Rear top bushing", "level": "meso", "role": "hardware", "importance": 0.35, "confidence": 0.5, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "truncated cone; colour and durometer inferred, hidden in the reference", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-kingpin", "localStart": [-0.008, -0.017, 0], "localEnd": [-0.014, -0.029, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.011, "endRadius": 0.006}, "dimensions": {"width": 0.022, "height": 0.012, "depth": 0.022, "units": "relative", "confidence": 0.5}, "transform": {"position": [-0.014, -0.018, 0], "rotation": [0, 0, -0.62], "scale": [0.022, 0.012, 0.022]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "bushing-urethane", "materialLayers": ["bushing-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_bushing_rear_top_20.add(mesh_bushing_rear_top_20);
  meshes["bushing-rear-top"] = mesh_bushing_rear_top_20;
  colliders["bushing-rear-top"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_bushing_rear_top_20);

  const attachment_bushing_rear_bot_21 = {"parentId": "truck-rear", "parentSocket": "socket-kingpin", "localStart": [-0.014, -0.029, 0], "localEnd": [-0.0195, -0.04, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.006, "endRadius": 0.011};
  const endpoint_bushing_rear_bot_21 = makeAttachmentEndpoint(attachment_bushing_rear_bot_21);
  const node_bushing_rear_bot_21 = new THREE.Group();
  node_bushing_rear_bot_21.name = "Rear bottom bushing__pivot";
  if (endpoint_bushing_rear_bot_21) {
    node_bushing_rear_bot_21.position.copy(endpoint_bushing_rear_bot_21.start);
    node_bushing_rear_bot_21.rotation.set(0, 0, 0);
    node_bushing_rear_bot_21.scale.set(1, 1, 1);
  } else {
    node_bushing_rear_bot_21.position.set(-0.02, -0.032, 0.0);
    node_bushing_rear_bot_21.rotation.set(0.0, 0.0, -0.62);
    node_bushing_rear_bot_21.scale.set(0.022, 0.012, 0.022);
  }
  node_bushing_rear_bot_21.userData.sculptComponent = {"id": "bushing-rear-bot", "name": "Rear bottom bushing", "level": "meso", "role": "hardware", "importance": 0.35, "confidence": 0.5, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "truncated cone; colour and durometer inferred, hidden in the reference", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-kingpin", "localStart": [-0.014, -0.029, 0], "localEnd": [-0.0195, -0.04, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.006, "endRadius": 0.011}, "dimensions": {"width": 0.022, "height": 0.012, "depth": 0.022, "units": "relative", "confidence": 0.5}, "transform": {"position": [-0.02, -0.032, 0], "rotation": [0, 0, -0.62], "scale": [0.022, 0.012, 0.022]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "bushing-urethane", "materialLayers": ["bushing-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_bushing_rear_bot_21.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-rear"] ?? root).add(node_bushing_rear_bot_21);
  nodes["bushing-rear-bot"] = node_bushing_rear_bot_21;
  const mesh_bushing_rear_bot_21Geometry = endpoint_bushing_rear_bot_21
    ? new THREE.CylinderGeometry(endpoint_bushing_rear_bot_21.endRadius, endpoint_bushing_rear_bot_21.baseRadius, endpoint_bushing_rear_bot_21.length, 32, 12)
    : new THREE.ConeGeometry(0.5, 1, 48, 16);
  const mesh_bushing_rear_bot_21 = new THREE.Mesh(
    mesh_bushing_rear_bot_21Geometry,
    materialMap["bushing-urethane"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bushing_rear_bot_21.name = "Rear bottom bushing";
  if (endpoint_bushing_rear_bot_21) {
    mesh_bushing_rear_bot_21.position.copy(endpoint_bushing_rear_bot_21.midpoint);
    mesh_bushing_rear_bot_21.quaternion.copy(endpoint_bushing_rear_bot_21.quaternion);
  }
  mesh_bushing_rear_bot_21.castShadow = options.castShadow ?? true;
  mesh_bushing_rear_bot_21.receiveShadow = options.receiveShadow ?? true;
  mesh_bushing_rear_bot_21.userData.sculptComponent = {"id": "bushing-rear-bot", "name": "Rear bottom bushing", "level": "meso", "role": "hardware", "importance": 0.35, "confidence": 0.5, "primitive": "cone", "geometryDescriptor": {"topologyIntent": "truncated cone; colour and durometer inferred, hidden in the reference", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-kingpin", "localStart": [-0.014, -0.029, 0], "localEnd": [-0.0195, -0.04, 0], "contactNormal": [0, 1, 0], "contactType": "compression-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "overlap": 0.003, "baseRadius": 0.006, "endRadius": 0.011}, "dimensions": {"width": 0.022, "height": 0.012, "depth": 0.022, "units": "relative", "confidence": 0.5}, "transform": {"position": [-0.02, -0.032, 0], "rotation": [0, 0, -0.62], "scale": [0.022, 0.012, 0.022]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "bushing-urethane", "materialLayers": ["bushing-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r2c2"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_bushing_rear_bot_21.add(mesh_bushing_rear_bot_21);
  meshes["bushing-rear-bot"] = mesh_bushing_rear_bot_21;
  colliders["bushing-rear-bot"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_bushing_rear_bot_21);

  const attachment_axle_rear_22 = {"parentId": "truck-rear", "parentSocket": "socket-axle-rear", "localStart": [0, -0.0656, -0.129], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "press-fit", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r1c1"], "embedDepth": 0.012, "baseRadius": 0.0049, "endRadius": 0.0049};
  const endpoint_axle_rear_22 = makeAttachmentEndpoint(attachment_axle_rear_22);
  const node_axle_rear_22 = new THREE.Group();
  node_axle_rear_22.name = "Rear axle__pivot";
  if (endpoint_axle_rear_22) {
    node_axle_rear_22.position.copy(endpoint_axle_rear_22.start);
    node_axle_rear_22.rotation.set(0, 0, 0);
    node_axle_rear_22.scale.set(1, 1, 1);
  } else {
    node_axle_rear_22.position.set(0.0, -0.0656, 0.0);
    node_axle_rear_22.rotation.set(1.5708, 0.0, 0.0);
    node_axle_rear_22.scale.set(0.0098, 0.258, 0.0098);
  }
  node_axle_rear_22.userData.sculptComponent = {"id": "axle-rear", "name": "Rear axle", "level": "meso", "role": "hardware", "importance": 0.6, "confidence": 0.85, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-axle-rear", "localStart": [0, -0.0656, -0.129], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "press-fit", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r1c1"], "embedDepth": 0.012, "baseRadius": 0.0049, "endRadius": 0.0049}, "dimensions": {"width": 0.0098, "height": 0.258, "depth": 0.0098, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.0656, 0], "rotation": [1.5708, 0, 0], "scale": [0.0098, 0.258, 0.0098]}, "actionProfile": {"animationRole": "axle", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_axle_rear_22.userData.actionProfile = {"animationRole": "axle", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-rear"] ?? root).add(node_axle_rear_22);
  nodes["axle-rear"] = node_axle_rear_22;
  const mesh_axle_rear_22Geometry = endpoint_axle_rear_22
    ? new THREE.CylinderGeometry(endpoint_axle_rear_22.endRadius, endpoint_axle_rear_22.baseRadius, endpoint_axle_rear_22.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_axle_rear_22 = new THREE.Mesh(
    mesh_axle_rear_22Geometry,
    materialMap["hardware-steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_axle_rear_22.name = "Rear axle";
  if (endpoint_axle_rear_22) {
    mesh_axle_rear_22.position.copy(endpoint_axle_rear_22.midpoint);
    mesh_axle_rear_22.quaternion.copy(endpoint_axle_rear_22.quaternion);
  }
  mesh_axle_rear_22.castShadow = options.castShadow ?? true;
  mesh_axle_rear_22.receiveShadow = options.receiveShadow ?? true;
  mesh_axle_rear_22.userData.sculptComponent = {"id": "axle-rear", "name": "Rear axle", "level": "meso", "role": "hardware", "importance": 0.6, "confidence": 0.85, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder blockout", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-axle-rear", "localStart": [0, -0.0656, -0.129], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "press-fit", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r1c1"], "embedDepth": 0.012, "baseRadius": 0.0049, "endRadius": 0.0049}, "dimensions": {"width": 0.0098, "height": 0.258, "depth": 0.0098, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, -0.0656, 0], "rotation": [1.5708, 0, 0], "scale": [0.0098, 0.258, 0.0098]}, "actionProfile": {"animationRole": "axle", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_axle_rear_22.add(mesh_axle_rear_22);
  meshes["axle-rear"] = mesh_axle_rear_22;
  colliders["axle-rear"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_axle_rear_22);

  const attachment_wheel_rear_left_23 = {"parentId": "truck-rear", "parentSocket": "socket-axle-rear", "localStart": [0, -0.0656, -0.08710000000000001], "localEnd": [0, -0.0656, -0.129], "contactNormal": [0, 0, -1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332};
  const endpoint_wheel_rear_left_23 = makeAttachmentEndpoint(attachment_wheel_rear_left_23);
  const node_wheel_rear_left_23 = new THREE.Group();
  node_wheel_rear_left_23.name = "Rear left wheel__pivot";
  if (endpoint_wheel_rear_left_23) {
    node_wheel_rear_left_23.position.copy(endpoint_wheel_rear_left_23.start);
    node_wheel_rear_left_23.rotation.set(0, 0, 0);
    node_wheel_rear_left_23.scale.set(1, 1, 1);
  } else {
    node_wheel_rear_left_23.position.set(0.0, -0.0656, -0.10805000000000001);
    node_wheel_rear_left_23.rotation.set(1.5708, 0.0, 0.0);
    node_wheel_rear_left_23.scale.set(0.0664, 0.0419, 0.0664);
  }
  node_wheel_rear_left_23.userData.sculptComponent = {"id": "wheel-rear-left", "name": "Rear left wheel", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.9, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder for blockout; form-refinement lathes the rounded shoulder profile", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.008, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-axle-rear", "localStart": [0, -0.0656, -0.08710000000000001], "localEnd": [0, -0.0656, -0.129], "contactNormal": [0, 0, -1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332}, "dimensions": {"width": 0.0664, "height": 0.0419, "depth": 0.0664, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, -0.0656, -0.10805000000000001], "rotation": [1.5708, 0, 0], "scale": [0.0664, 0.0419, 0.0664]}, "actionProfile": {"animationRole": "rear-left-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-rear-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}}, "material": "wheel-urethane", "materialLayers": ["wheel-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-shoulder-rear-left", "type": "bevel highlight", "placement": "outer rim where the flat face meets the rolling surface", "approximateSize": "0.008 radius", "orientation": "follows surface", "materialEffect": "brighter specular band along the round", "geometryEffect": "generous rounded shoulder, park-wheel profile", "confidence": 0.9, "evidenceRefs": ["zone-r2c2"]}, {"id": "bearing-seat-rear-left", "type": "hole or socket", "placement": "centred on the outer wheel face", "approximateSize": "0.022 diameter x 0.007 deep", "orientation": "follows surface", "materialEffect": "dark maroon-brown, strong cavity AO, bright axle nut at centre", "geometryEffect": "cylindrical recess with a concentric shield ring", "confidence": 0.9, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.3, "bumpAmplitude": 0.006, "normalPattern": "fine mould-release stipple", "displacementPattern": "none", "occlusionPattern": "bearing recess darkening", "edgeWearPattern": "flat-spot scuffing on the rolling surface", "notes": "Bone-cream urethane, soft sheen, not glossy plastic."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_wheel_rear_left_23.userData.actionProfile = {"animationRole": "rear-left-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-rear-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-rear"] ?? root).add(node_wheel_rear_left_23);
  nodes["wheel-rear-left"] = node_wheel_rear_left_23;
  const mesh_wheel_rear_left_23Geometry = endpoint_wheel_rear_left_23
    ? new THREE.CylinderGeometry(endpoint_wheel_rear_left_23.endRadius, endpoint_wheel_rear_left_23.baseRadius, endpoint_wheel_rear_left_23.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_wheel_rear_left_23 = new THREE.Mesh(
    mesh_wheel_rear_left_23Geometry,
    materialMap["wheel-urethane"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_rear_left_23.name = "Rear left wheel";
  if (endpoint_wheel_rear_left_23) {
    mesh_wheel_rear_left_23.position.copy(endpoint_wheel_rear_left_23.midpoint);
    mesh_wheel_rear_left_23.quaternion.copy(endpoint_wheel_rear_left_23.quaternion);
  }
  mesh_wheel_rear_left_23.castShadow = options.castShadow ?? true;
  mesh_wheel_rear_left_23.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_rear_left_23.userData.sculptComponent = {"id": "wheel-rear-left", "name": "Rear left wheel", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.9, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder for blockout; form-refinement lathes the rounded shoulder profile", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.008, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-axle-rear", "localStart": [0, -0.0656, -0.08710000000000001], "localEnd": [0, -0.0656, -0.129], "contactNormal": [0, 0, -1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332}, "dimensions": {"width": 0.0664, "height": 0.0419, "depth": 0.0664, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, -0.0656, -0.10805000000000001], "rotation": [1.5708, 0, 0], "scale": [0.0664, 0.0419, 0.0664]}, "actionProfile": {"animationRole": "rear-left-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-rear-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}}, "material": "wheel-urethane", "materialLayers": ["wheel-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-shoulder-rear-left", "type": "bevel highlight", "placement": "outer rim where the flat face meets the rolling surface", "approximateSize": "0.008 radius", "orientation": "follows surface", "materialEffect": "brighter specular band along the round", "geometryEffect": "generous rounded shoulder, park-wheel profile", "confidence": 0.9, "evidenceRefs": ["zone-r2c2"]}, {"id": "bearing-seat-rear-left", "type": "hole or socket", "placement": "centred on the outer wheel face", "approximateSize": "0.022 diameter x 0.007 deep", "orientation": "follows surface", "materialEffect": "dark maroon-brown, strong cavity AO, bright axle nut at centre", "geometryEffect": "cylindrical recess with a concentric shield ring", "confidence": 0.9, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.3, "bumpAmplitude": 0.006, "normalPattern": "fine mould-release stipple", "displacementPattern": "none", "occlusionPattern": "bearing recess darkening", "edgeWearPattern": "flat-spot scuffing on the rolling surface", "notes": "Bone-cream urethane, soft sheen, not glossy plastic."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_wheel_rear_left_23.add(mesh_wheel_rear_left_23);
  meshes["wheel-rear-left"] = mesh_wheel_rear_left_23;
  colliders["wheel-rear-left"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["wheel-rear-left"] ??= [];
  destructionGroups["wheel-rear-left"].push(node_wheel_rear_left_23);

  const attachment_wheel_rear_right_24 = {"parentId": "truck-rear", "parentSocket": "socket-axle-rear", "localStart": [0, -0.0656, 0.08710000000000001], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332};
  const endpoint_wheel_rear_right_24 = makeAttachmentEndpoint(attachment_wheel_rear_right_24);
  const node_wheel_rear_right_24 = new THREE.Group();
  node_wheel_rear_right_24.name = "Rear right wheel__pivot";
  if (endpoint_wheel_rear_right_24) {
    node_wheel_rear_right_24.position.copy(endpoint_wheel_rear_right_24.start);
    node_wheel_rear_right_24.rotation.set(0, 0, 0);
    node_wheel_rear_right_24.scale.set(1, 1, 1);
  } else {
    node_wheel_rear_right_24.position.set(0.0, -0.0656, 0.10805000000000001);
    node_wheel_rear_right_24.rotation.set(1.5708, 0.0, 0.0);
    node_wheel_rear_right_24.scale.set(0.0664, 0.0419, 0.0664);
  }
  node_wheel_rear_right_24.userData.sculptComponent = {"id": "wheel-rear-right", "name": "Rear right wheel", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.9, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder for blockout; form-refinement lathes the rounded shoulder profile", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.008, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-axle-rear", "localStart": [0, -0.0656, 0.08710000000000001], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332}, "dimensions": {"width": 0.0664, "height": 0.0419, "depth": 0.0664, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, -0.0656, 0.10805000000000001], "rotation": [1.5708, 0, 0], "scale": [0.0664, 0.0419, 0.0664]}, "actionProfile": {"animationRole": "rear-right-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-rear-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}}, "material": "wheel-urethane", "materialLayers": ["wheel-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-shoulder-rear-right", "type": "bevel highlight", "placement": "outer rim where the flat face meets the rolling surface", "approximateSize": "0.008 radius", "orientation": "follows surface", "materialEffect": "brighter specular band along the round", "geometryEffect": "generous rounded shoulder, park-wheel profile", "confidence": 0.9, "evidenceRefs": ["zone-r2c2"]}, {"id": "bearing-seat-rear-right", "type": "hole or socket", "placement": "centred on the outer wheel face", "approximateSize": "0.022 diameter x 0.007 deep", "orientation": "follows surface", "materialEffect": "dark maroon-brown, strong cavity AO, bright axle nut at centre", "geometryEffect": "cylindrical recess with a concentric shield ring", "confidence": 0.9, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.3, "bumpAmplitude": 0.006, "normalPattern": "fine mould-release stipple", "displacementPattern": "none", "occlusionPattern": "bearing recess darkening", "edgeWearPattern": "flat-spot scuffing on the rolling surface", "notes": "Bone-cream urethane, soft sheen, not glossy plastic."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_wheel_rear_right_24.userData.actionProfile = {"animationRole": "rear-right-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-rear-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-rear"] ?? root).add(node_wheel_rear_right_24);
  nodes["wheel-rear-right"] = node_wheel_rear_right_24;
  const mesh_wheel_rear_right_24Geometry = endpoint_wheel_rear_right_24
    ? new THREE.CylinderGeometry(endpoint_wheel_rear_right_24.endRadius, endpoint_wheel_rear_right_24.baseRadius, endpoint_wheel_rear_right_24.length, 32, 12)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 48, 16);
  const mesh_wheel_rear_right_24 = new THREE.Mesh(
    mesh_wheel_rear_right_24Geometry,
    materialMap["wheel-urethane"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wheel_rear_right_24.name = "Rear right wheel";
  if (endpoint_wheel_rear_right_24) {
    mesh_wheel_rear_right_24.position.copy(endpoint_wheel_rear_right_24.midpoint);
    mesh_wheel_rear_right_24.quaternion.copy(endpoint_wheel_rear_right_24.quaternion);
  }
  mesh_wheel_rear_right_24.castShadow = options.castShadow ?? true;
  mesh_wheel_rear_right_24.receiveShadow = options.receiveShadow ?? true;
  mesh_wheel_rear_right_24.userData.sculptComponent = {"id": "wheel-rear-right", "name": "Rear right wheel", "level": "meso", "role": "body", "importance": 0.9, "confidence": 0.9, "primitive": "cylinder", "geometryDescriptor": {"topologyIntent": "cylinder for blockout; form-refinement lathes the rounded shoulder profile", "edgeTreatment": {"type": "fillet", "bevelRadius": 0.008, "segments": 4}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": {"parentId": "truck-rear", "parentSocket": "socket-axle-rear", "localStart": [0, -0.0656, 0.08710000000000001], "localEnd": [0, -0.0656, 0.129], "contactNormal": [0, 0, 1], "contactType": "bearing-seated", "gapTolerance": 0.0008, "evidenceRefs": ["zone-r2c2"], "embedDepth": 0.008, "baseRadius": 0.0332, "endRadius": 0.0332}, "dimensions": {"width": 0.0664, "height": 0.0419, "depth": 0.0664, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, -0.0656, 0.10805000000000001], "rotation": [1.5708, 0, 0], "scale": [0.0664, 0.0419, 0.0664]}, "actionProfile": {"animationRole": "rear-right-wheel", "pivot": {"mode": "custom", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": true, "fractureGroup": "wheel-rear-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 4.0, "debrisMaterial": "cast-aluminium"}}, "material": "wheel-urethane", "materialLayers": ["wheel-urethane"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "wheel-shoulder-rear-right", "type": "bevel highlight", "placement": "outer rim where the flat face meets the rolling surface", "approximateSize": "0.008 radius", "orientation": "follows surface", "materialEffect": "brighter specular band along the round", "geometryEffect": "generous rounded shoulder, park-wheel profile", "confidence": 0.9, "evidenceRefs": ["zone-r2c2"]}, {"id": "bearing-seat-rear-right", "type": "hole or socket", "placement": "centred on the outer wheel face", "approximateSize": "0.022 diameter x 0.007 deep", "orientation": "follows surface", "materialEffect": "dark maroon-brown, strong cavity AO, bright axle nut at centre", "geometryEffect": "cylindrical recess with a concentric shield ring", "confidence": 0.9, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.42, "microRoughness": 0.3, "bumpAmplitude": 0.006, "normalPattern": "fine mould-release stipple", "displacementPattern": "none", "occlusionPattern": "bearing recess darkening", "edgeWearPattern": "flat-spot scuffing on the rolling surface", "notes": "Bone-cream urethane, soft sheen, not glossy plastic."}, "evidenceRefs": ["zone-r2c2", "zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_wheel_rear_right_24.add(mesh_wheel_rear_right_24);
  meshes["wheel-rear-right"] = mesh_wheel_rear_right_24;
  colliders["wheel-rear-right"] = {"type": "sphere", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["wheel-rear-right"] ??= [];
  destructionGroups["wheel-rear-right"].push(node_wheel_rear_right_24);

  const attachment_mount_bolts_rear_25 = null;
  const endpoint_mount_bolts_rear_25 = makeAttachmentEndpoint(attachment_mount_bolts_rear_25);
  const node_mount_bolts_rear_25 = new THREE.Group();
  node_mount_bolts_rear_25.name = "Rear mounting bolts__pivot";
  if (endpoint_mount_bolts_rear_25) {
    node_mount_bolts_rear_25.position.copy(endpoint_mount_bolts_rear_25.start);
    node_mount_bolts_rear_25.rotation.set(0, 0, 0);
    node_mount_bolts_rear_25.scale.set(1, 1, 1);
  } else {
    node_mount_bolts_rear_25.position.set(0.0, 0.002, 0.0);
    node_mount_bolts_rear_25.rotation.set(0.0, 0.0, 0.0);
    node_mount_bolts_rear_25.scale.set(0.0416, 0.004, 0.102);
  }
  node_mount_bolts_rear_25.userData.sculptComponent = {"id": "mount-bolts-rear", "name": "Rear mounting bolts", "level": "micro", "role": "hardware", "importance": 0.5, "confidence": 0.85, "primitive": "instanced-cluster", "geometryDescriptor": {"topologyIntent": "4x InstancedMesh, rectangular pattern", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": null, "dimensions": {"width": 0.0416, "height": 0.004, "depth": 0.102, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.002, 0], "rotation": [0, 0, 0], "scale": [0.0416, 0.004, 0.102]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bolt-head-recess-rear", "type": "screw or rivet", "placement": "four corners of a 0.0416 x 0.102 rectangle on the deck face", "approximateSize": "0.009 head diameter", "orientation": "follows surface", "materialEffect": "dark steel with a bright worn rim ring", "geometryEffect": "countersunk head sitting flush in the deck", "confidence": 0.85, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_mount_bolts_rear_25.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}};
  (nodes["truck-rear"] ?? root).add(node_mount_bolts_rear_25);
  nodes["mount-bolts-rear"] = node_mount_bolts_rear_25;
  const mesh_mount_bolts_rear_25Geometry = endpoint_mount_bolts_rear_25
    ? new THREE.CylinderGeometry(endpoint_mount_bolts_rear_25.endRadius, endpoint_mount_bolts_rear_25.baseRadius, endpoint_mount_bolts_rear_25.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const mesh_mount_bolts_rear_25 = new THREE.Mesh(
    mesh_mount_bolts_rear_25Geometry,
    materialMap["hardware-steel"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mount_bolts_rear_25.name = "Rear mounting bolts";
  if (endpoint_mount_bolts_rear_25) {
    mesh_mount_bolts_rear_25.position.copy(endpoint_mount_bolts_rear_25.midpoint);
    mesh_mount_bolts_rear_25.quaternion.copy(endpoint_mount_bolts_rear_25.quaternion);
  }
  mesh_mount_bolts_rear_25.castShadow = options.castShadow ?? true;
  mesh_mount_bolts_rear_25.receiveShadow = options.receiveShadow ?? true;
  mesh_mount_bolts_rear_25.userData.sculptComponent = {"id": "mount-bolts-rear", "name": "Rear mounting bolts", "level": "micro", "role": "hardware", "importance": 0.5, "confidence": 0.85, "primitive": "instanced-cluster", "geometryDescriptor": {"topologyIntent": "4x InstancedMesh, rectangular pattern", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "truck-rear", "attachment": null, "dimensions": {"width": 0.0416, "height": 0.004, "depth": 0.102, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.002, 0], "rotation": [0, 0, 0], "scale": [0.0416, 0.004, 0.102]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "cast-aluminium"}}, "material": "hardware-steel", "materialLayers": ["hardware-steel"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bolt-head-recess-rear", "type": "screw or rivet", "placement": "four corners of a 0.0416 x 0.102 rectangle on the deck face", "approximateSize": "0.009 head diameter", "orientation": "follows surface", "materialEffect": "dark steel with a bright worn rim ring", "geometryEffect": "countersunk head sitting flush in the deck", "confidence": 0.85, "evidenceRefs": ["zone-r1c1"]}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c1"], "details": [], "fidelityTier": "blockout", "isContainer": false};
  node_mount_bolts_rear_25.add(mesh_mount_bolts_rear_25);
  meshes["mount-bolts-rear"] = mesh_mount_bolts_rear_25;
  colliders["mount-bolts-rear"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": ""};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_mount_bolts_rear_25);
  // TODO: replace 'mount-bolts-rear' box fallback with instanced-cluster procedural geometry.

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry. 5 of 7 materials extracted at confidence 0.836-0.86. 'griptape' and 'bushing-urethane' are not present in the reference at all and are documented in spec.documentedLimitations instead of being given fabricated maps."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
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
  lights.userData.lightingFromPhoto = [{"id": "key", "type": "directional", "role": "key", "direction": [-0.55, 0.72, 0.42], "colorTemperature": 5200, "color": "#FFF4E4", "intensity": 3.1, "softness": 0.25, "evidenceRefs": ["full-object", "zone-r0c1"], "notes": "Hard upper-left key. It rakes across the deck bottom, which is what makes the chipped rim and the casting pits read. Shadow terminator on the wheels is tight, so this is a small source, not a softbox."}, {"id": "fill", "type": "ambient", "role": "fill", "color": "#2A2E38", "intensity": 0.22, "evidenceRefs": ["full-object"], "notes": "Very low cool ambient. Shadow sides fall to near-black but never fully clip, so some fill exists."}, {"id": "rim", "type": "directional", "role": "rim", "direction": [0.68, 0.28, -0.66], "color": "#C8D4E6", "intensity": 0.85, "evidenceRefs": ["zone-r2c2"], "notes": "Cool back-right rim separating the trucks and the far rail from the dark background."}, {"id": "exposure-and-tonemapping", "type": "camera", "role": "grade", "toneMapping": "ACESFilmic", "exposure": 1.15, "background": "#232326 flat charcoal, subtle radial falloff", "evidenceRefs": ["full-object"], "notes": "ACES filmic tone mapping with exposure ~1.15. The reference holds highlight detail on the bone wheels while the background sits near 0.12 luminance."}, {"id": "contact-shadow", "type": "shadow", "role": "grounding", "evidenceRefs": ["zone-r3c2"], "notes": "Soft contact shadow / ambient occlusion pooled directly under the tail and beneath both trucks, fading within about one wheel diameter. Without it the board floats."}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry. 5 of 7 materials extracted at confidence 0.836-0.86. 'griptape' and 'bushing-urethane' are not present in the reference at all and are documented in spec.documentedLimitations instead of being given fabricated maps."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}
