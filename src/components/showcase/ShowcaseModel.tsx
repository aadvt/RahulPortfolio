'use client';

import { useEffect, useMemo } from 'react';
import type { ShowcaseAsset } from '@/data/showcaseAssets';
import { acquireAssetGroup, setWireframe } from './assetGroupCache';

interface Props {
  asset: ShowcaseAsset;
  wireframe: boolean;
}

/**
 * Mounts a normalized clone of an img2threejs factory. Geometry and materials
 * come from the module cache and are deliberately not disposed here — sibling
 * canvases on this page share them.
 */
export default function ShowcaseModel({ asset, wireframe }: Props) {
  const group = useMemo(() => acquireAssetGroup(asset), [asset]);

  useEffect(() => {
    setWireframe(group, wireframe);
    // Materials are shared, so leaving wireframe on would follow the user back
    // out to the grid.
    return () => setWireframe(group, false);
  }, [group, wireframe]);

  return <primitive object={group} />;
}
