import { useRef, useEffect, useLayoutEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useRoomStore } from '@/store/useRoomStore';
import gsap from 'gsap';
import * as THREE from 'three';

interface CameraConfig {
  position: [number, number, number];
  target: [number, number, number];
}

const CAMERA_CONFIGS: Record<string, CameraConfig> = {
  NONE: {
    // Front-right, pulled in close and aimed low so the room fills the
    // viewport. Kept in the open front/top region (walls at x=±11, z=-11)
    // so the sight line never clips through a wall.
    position: [8.5, 8, 13.5],
    target: [0, 3, -2],
  },
  PC: {
    // Desk sits against the back wall around x=-3, z=-8.6.
    position: [-3, 5, 0],
    target: [-3, 3.4, -8.6],
  },
  SHOES: {
    position: [8.5, 2.5, 12],
    target: [8.5, 0.4, 8],
  },
  CLOSET: {
    position: [4.5, 5.5, -3],
    target: [4.5, 5, -10.2],
  },
  MIRROR: {
    position: [-6.5, 4.6, -8],
    target: [-10.65, 4.6, -8],
  },
};

export default function CameraManager() {
  const { camera } = useThree();
  const { activeTarget } = useRoomStore();
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  // The point the camera should currently be aimed at (GSAP animates this).
  const lookTarget = useRef(new THREE.Vector3(...CAMERA_CONFIGS.NONE.target));

  // Seed the initial position before first paint.
  useLayoutEffect(() => {
    camera.position.set(...CAMERA_CONFIGS.NONE.position);
    camera.lookAt(lookTarget.current);
  }, [camera]);

  // Aim the camera at the (animated) look target on every frame. Doing this in
  // the render loop means the camera can never end up un-aimed, regardless of
  // mount/animation timing.
  useFrame(() => {
    camera.lookAt(lookTarget.current);
  });

  useEffect(() => {
    const config = CAMERA_CONFIGS[activeTarget];
    if (!config) return;

    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    timelineRef.current = gsap.timeline();

    // Animate camera position.
    timelineRef.current.to(
      camera.position,
      {
        x: config.position[0],
        y: config.position[1],
        z: config.position[2],
        duration: 1.2,
        ease: 'power2.inOut',
      },
      0
    );

    // Animate the look target (useFrame re-aims each frame from this).
    timelineRef.current.to(
      lookTarget.current,
      {
        x: config.target[0],
        y: config.target[1],
        z: config.target[2],
        duration: 1.2,
        ease: 'power2.inOut',
      },
      0
    );
  }, [activeTarget, camera]);

  return null;
}
