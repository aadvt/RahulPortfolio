'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ShowcaseAsset } from '@/data/showcaseAssets';

export type LightMode = 'neutral' | 'grazing' | 'reference';

interface Props {
  asset: ShowcaseAsset;
  mode: LightMode;
  /** Cards render unshadowed to keep four canvases cheap. */
  shadows?: boolean;
}

/**
 * Mounts the look-dev rig the img2threejs lighting pass authored next to each
 * model, rather than inventing showcase-specific lighting. Swapping modes
 * rebuilds the rig, which is what the review workflow expects:
 * neutral reads material, grazing exposes flat normals, reference matches the photo.
 */
export default function LookDevRig({ asset, mode, shadows = true }: Props) {
  const rig = useMemo(() => {
    const lights = asset.lights(mode);
    if (!shadows) {
      lights.traverse((object) => {
        const light = object as THREE.Light;
        if (light.isLight) light.castShadow = false;
      });
    }
    return lights;
  }, [asset, mode, shadows]);

  useEffect(() => {
    return () => {
      rig.traverse((object) => {
        const light = object as THREE.DirectionalLight;
        if (!light.isLight) return;
        light.shadow?.map?.dispose();
        light.dispose?.();
      });
    };
  }, [rig]);

  return <primitive object={rig} />;
}
