import * as THREE from 'three';
import type { ShowcaseAsset } from '@/data/showcaseAssets';

/** Every model is fitted into a box this many units on its longest axis. */
const NORMALIZED_SIZE = 2;

/**
 * Rough CPU+GPU budget per asset. Each material generates five independent
 * canvas maps (albedo, roughness, height, normal, AO) at size × size RGBA,
 * so cost scales with materialCount × size².
 */
const BYTES_PER_MATERIAL_PIXEL = 20;
const TEXTURE_BUDGET_BYTES = 40_000_000;

/**
 * Texture resolution this asset can afford. The wardrobe carries 23 materials
 * and the skateboard 5, so a single fixed size would either starve the simple
 * models or blow ~120MB on the complex ones.
 */
export function textureSizeFor(asset: ShowcaseAsset): number {
  const perMaterial = TEXTURE_BUDGET_BYTES / (BYTES_PER_MATERIAL_PIXEL * Math.max(1, asset.materialCount));
  const raw = Math.sqrt(perMaterial);
  // The generator clamps to a power of two in [256, 2048] anyway.
  const power = Math.round(Math.log2(raw));
  return Math.max(256, Math.min(1024, 2 ** power));
}

export type AssetFraming = {
  /** Height of the normalized model above the ground plane. */
  height: number;
  /** Radius of the sphere enclosing the normalized model. */
  boundingRadius: number;
};

type Prototype = { group: THREE.Group; framing: AssetFraming };

const prototypes = new Map<string, Prototype>();

function buildPrototype(asset: ShowcaseAsset): Prototype {
  const built = asset.factory({
    castShadow: true,
    receiveShadow: true,
    textureSize: textureSizeFor(asset),
  });

  // img2threejs emits a mesh for every component, including the pure container
  // nodes that exist only to parent and pivot (root, the truck groups). Their
  // unit box would swallow the real model, so hide any mesh whose node also
  // parents other component nodes. Derived from the graph rather than an id
  // list, so it keeps working as specs change.
  // They are detached rather than hidden: Box3.setFromObject ignores `visible`,
  // so a merely-hidden unit box would still blow out the framing.
  const containerMeshes: THREE.Mesh[] = [];
  built.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.parent) return;
    const parentsOtherNodes = mesh.parent.children.some(
      (sibling) => sibling !== mesh && (sibling as THREE.Group).isGroup,
    );
    if (parentsOtherNodes) containerMeshes.push(mesh);
  });
  containerMeshes.forEach((mesh) => {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  });

  // Center on X/Z and seat on y=0, then scale so a skateboard and a wardrobe
  // frame identically in the same camera.
  const box = new THREE.Box3().setFromObject(built);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const longestAxis = Math.max(size.x, size.y, size.z) || 1;
  const scale = NORMALIZED_SIZE / longestAxis;

  built.position.set(-center.x, -box.min.y, -center.z);

  const wrapper = new THREE.Group();
  wrapper.name = `${asset.name} (normalized)`;
  wrapper.scale.setScalar(scale);
  wrapper.add(built);

  return {
    group: wrapper,
    framing: {
      height: size.y * scale,
      // Half the diagonal of the normalized box — what the camera has to clear.
      boundingRadius: (size.length() * scale) / 2,
    },
  };
}

function prototypeFor(asset: ShowcaseAsset): Prototype {
  let prototype = prototypes.get(asset.id);
  if (!prototype) {
    prototype = buildPrototype(asset);
    prototypes.set(asset.id, prototype);
  }
  return prototype;
}

/** Normalized bounds, used to frame the camera without per-asset guesswork. */
export function framingFor(asset: ShowcaseAsset): AssetFraming {
  return prototypeFor(asset).framing;
}

/**
 * Returns a display-ready copy of an asset. The first call runs the generator —
 * seconds of blocking canvas work for a complex target — so the result is kept
 * and every later mount gets an Object3D.clone(), which shares the underlying
 * geometry and materials instead of regenerating them.
 *
 * The cache owns those resources for the lifetime of the page: callers must not
 * dispose geometry or materials, only drop their clone.
 */
export function acquireAssetGroup(asset: ShowcaseAsset): THREE.Group {
  return prototypeFor(asset).group.clone();
}

/** Materials are shared across clones, so wireframe is a page-wide switch. */
export function setWireframe(group: THREE.Group, wireframe: boolean): void {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard || standard.wireframe === wireframe) return;
      standard.wireframe = wireframe;
      standard.needsUpdate = true;
    });
  });
}
