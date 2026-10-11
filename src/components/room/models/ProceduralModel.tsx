import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

export type ModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

type Factory = (options?: ModelOptions) => THREE.Group;

interface Props {
  factory: Factory;
  /** Re-emit glow on meshes whose name implies an emitter (LED, screen, RGB). */
  glow?: boolean;
  textureSize?: number;
}

const GLOW_RULES: { test: RegExp; color: string; intensity: number }[] = [
  { test: /led|underglow/i, color: '#ffb454', intensity: 2.2 },
  { test: /screen|timeline|monitor|phone/i, color: '#2f5aa8', intensity: 1.3 },
  { test: /rgb|glow/i, color: '#7c3aed', intensity: 1.8 },
  { test: /keyboard|keeb/i, color: '#a855f7', intensity: 0.7 },
];

/**
 * Instantiates an img2threejs procedural factory once and renders the resulting
 * THREE.Group via <primitive>. Optionally boosts emissive on emitter meshes,
 * since the generator's material model has no emissive channel.
 */
export default function ProceduralModel({ factory, glow = false, textureSize = 128 }: Props) {
  const group = useMemo(() => {
    const g = factory({ castShadow: true, receiveShadow: true, textureSize });
    if (glow) {
      g.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (!mat || !('emissive' in mat)) return;
        const rule = GLOW_RULES.find((r) => r.test.test(mesh.name));
        if (rule) {
          mat.emissive = new THREE.Color(rule.color);
          mat.emissiveIntensity = rule.intensity;
          mat.toneMapped = false;
          mat.needsUpdate = true;
        }
      });
    }
    return g;
  }, [factory, glow, textureSize]);

  // Release GPU resources if this model unmounts (e.g. StrictMode remount).
  useEffect(() => {
    return () => {
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          const sm = m as THREE.MeshStandardMaterial;
          sm.map?.dispose();
          sm.roughnessMap?.dispose();
          sm.normalMap?.dispose();
          sm.aoMap?.dispose();
          sm.dispose();
        });
      });
    };
  }, [group]);

  return <primitive object={group} />;
}
