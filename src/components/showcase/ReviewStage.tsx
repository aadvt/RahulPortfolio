'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createSkateboardModel,
  createSkateboardLookDevLights,
} from './generated/createSkateboardModel';

// Named review viewpoints from qualityContract.reviewViewpoints. Each is a
// camera direction in the model's own frame plus a framing multiplier; the
// stage fits the model's bounding sphere so a spec change cannot silently
// reframe a comparison.
//
// The board is modelled deck-up (+Y), but the reference photographs it from
// BELOW, so the hero view sits under the deck with the nose (+X) toward screen
// up. Matching the reference camera is what makes the side-by-side legible.
type Viewpoint = {
  dir: [number, number, number];
  up: [number, number, number];
  zoom: number;
  fov: number;
  target?: [number, number, number];
  /**
   * The board is authored deck-up, but the reference photographs the graphic
   * side lit from above. Viewing the underside from below would put the
   * visible face permanently in shadow and make the comparison meaningless,
   * so graphic-facing viewpoints roll the model over instead of burying the
   * camera under an unlit surface.
   */
  modelRotation?: [number, number, number];
};

const FLIP: [number, number, number] = [Math.PI, 0, 0];

const VIEWPOINTS: Record<string, Viewpoint> = {
  'hero-three-quarter': {
    dir: [0.36, 0.84, 0.4],
    up: [1, 0, 0],
    zoom: 1.0,
    fov: 28,
    modelRotation: FLIP,
  },
  'bottom-orthographic': {
    dir: [0, 1, 0.001],
    up: [1, 0, 0],
    zoom: 0.94,
    fov: 12,
    modelRotation: FLIP,
  },
  'rail-profile': { dir: [0, -0.12, 1], up: [0, 1, 0], zoom: 0.9, fov: 16 },
  'truck-detail': {
    dir: [0.5, 0.68, 0.52],
    up: [1, 0, 0],
    zoom: 0.32,
    fov: 30,
    target: [0.2265, 0.05, 0],
    modelRotation: FLIP,
  },
};

const MODELS: Record<
  string,
  {
    build: (o?: Record<string, unknown>) => THREE.Group;
    // The generated rig returns a Group, not an array.
    lights: (mode: 'neutral' | 'grazing' | 'reference') => THREE.Group;
  }
> = {
  skateboard: { build: createSkateboardModel, lights: createSkateboardLookDevLights },
};

function param(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

export default function ReviewStage() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const assetId = param('asset', 'skateboard');
    const viewId = param('view', 'hero-three-quarter');
    const lightMode = param('lights', 'reference');
    const wireframe = param('wire', '0') === '1';
    const entry = MODELS[assetId];
    const view = VIEWPOINTS[viewId] ?? VIEWPOINTS['hero-three-quarter'];

    if (!entry) {
      host.dataset.error = `unknown asset ${assetId}`;
      document.body.dataset.ready = 'error';
      return;
    }

    const width = host.clientWidth;
    const height = host.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // lightingFromPhoto: ACESFilmic at exposure ~1.15.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#232326');

    const model = entry.build({
      castShadow: true,
      receiveShadow: true,
      textureSize: 1024,
      qualityPriority: 'reference-fidelity',
    });
    // Container components (root, truck groups) exist to parent and pivot; the
    // generator still emits a unit-box mesh for each. Hide those - a node that
    // parents other component nodes is a container by definition, so this needs
    // no hardcoded id list and survives spec changes.
    // Detached, not hidden: Box3.setFromObject ignores `visible`, and the
    // camera fit below depends on the bounds being the real model.
    const runtime = model.userData.sculptRuntime as
      | { meshes?: Record<string, THREE.Mesh> }
      | undefined;
    Object.values(runtime?.meshes ?? {})
      .filter((mesh) =>
        mesh.parent?.children.some(
          (child) => child !== mesh && (child as THREE.Group).isGroup,
        ),
      )
      .forEach((mesh) => mesh.removeFromParent());

    // Blockout acceptance is "silhouette reads correctly WITHOUT materials", so
    // clay mode swaps in one neutral matte so form is judged on its own. Using
    // the full PBR stack here would score the material pass by accident.
    if (param('clay', '0') === '1') {
      const clay = new THREE.MeshStandardMaterial({
        color: 0x9a9a9a,
        roughness: 0.85,
        metalness: 0.0,
      });
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.material = clay;
      });
    }

    if (wireframe) {
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          (m as THREE.MeshStandardMaterial).wireframe = true;
        });
      });
    }
    if (view.modelRotation) model.rotation.set(...view.modelRotation);
    scene.add(model);

    scene.add(entry.lights(lightMode as 'neutral' | 'grazing' | 'reference'));

    // Fit the camera to the model's real bounds so no viewpoint depends on a
    // hand-tuned distance that a geometry change would invalidate.
    const box = new THREE.Box3().setFromObject(model);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const camera = new THREE.PerspectiveCamera(view.fov, width / height, 0.01, 100);
    const target = view.target
      ? new THREE.Vector3(...view.target)
      : sphere.center.clone();
    const radius =
      (sphere.radius / Math.sin((view.fov * Math.PI) / 180 / 2)) * 1.06 * view.zoom;
    const dir = new THREE.Vector3(...view.dir).normalize();
    camera.position.copy(target).addScaledVector(dir, radius);
    camera.up.set(...view.up);
    camera.lookAt(target);

    renderer.render(scene, camera);

    // Textures are generated synchronously in the factory, so one frame after
    // layout is enough. Two rAFs guarantee the canvas is composited before the
    // capture tool reads the readiness flag.
    requestAnimationFrame(() => {
      renderer.render(scene, camera);
      requestAnimationFrame(() => {
        const info = renderer.info.render;
        host.dataset.triangles = String(info.triangles);
        document.body.dataset.ready = '1';
      });
    });

    return () => {
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
      delete document.body.dataset.ready;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      id="review-stage"
      style={{ width: '100vw', height: '100vh', margin: 0, overflow: 'hidden' }}
    />
  );
}
