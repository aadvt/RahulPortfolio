'use client';

/**
 * What makes the room clickable.
 *
 * Each stop gets an invisible hit volume wrapped around its object. They are
 * deliberately generous — a 7 cm ID card is impossible to tap on a phone, but
 * the chair back it hangs from is not. The volumes never draw (colorWrite and
 * depthWrite off) yet still take the raycast.
 *
 * On top of that, two kinds of DOM label hang off each stop's anchor:
 *  - a numbered pin, shown only on the overview, so a first-time visitor can
 *    see at a glance that the room is a menu;
 *  - a hover tag ("03 — ARCHIVE · the wall"), shown when the pointer is on an
 *    object you are not already looking at.
 */

import * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { MONITOR as MON, BADGE, TAG, WARDROBE as WD, WINDOW as WIN, HALF_D } from './spec';
import { STOP_BY_ID, goToStop, useStop, useStudioUI, type StopId } from './stops';
import styles from './hud/studio.module.css';

type Volume = { id: StopId; center: [number, number, number]; size: [number, number, number]; pin: [number, number, number] };

const VOLUMES: Volume[] = [
  {
    id: 'work',
    center: [MON.x, MON.y, MON.z + 0.02],
    size: [MON.width + 0.06, MON.height + 0.08, 0.1],
    pin: [MON.x, MON.y + MON.height / 2 + 0.1, MON.z + 0.05],
  },
  {
    id: 'about',
    center: [BADGE.x, BADGE.y + 0.02, BADGE.z],
    size: [0.2, 0.26, 0.14],
    pin: [BADGE.x, BADGE.y + 0.2, BADGE.z + 0.02],
  },
  {
    id: 'archive',
    center: [TAG.x, TAG.y, -HALF_D + 0.04],
    size: [TAG.width, TAG.height, 0.08],
    pin: [TAG.x + TAG.width * 0.36, TAG.y + TAG.height / 2 + 0.06, -HALF_D + 0.06],
  },
  {
    id: 'rack',
    center: [(WD.x0 + WD.x1) / 2, WD.height / 2, -HALF_D + WD.depth / 2],
    size: [WD.x1 - WD.x0, WD.height, WD.depth + 0.02],
    pin: [(WD.x0 + WD.x1) / 2, WD.height + 0.12, -HALF_D + WD.depth * 0.8],
  },
  {
    id: 'contact',
    center: [WIN.centerX + 0.12, (WIN.sill + WIN.head) / 2, -HALF_D + 0.04],
    size: [WIN.width + 0.5, WIN.head - WIN.sill, 0.16],
    pin: [WIN.centerX, WIN.head + 0.14, -HALF_D + 0.08],
  },
];

/** One shared invisible material: takes rays, writes nothing. */
const ghost = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 });
const unit = new THREE.BoxGeometry(1, 1, 1);

function Volume({ v, active, live }: { v: Volume; active: boolean; live: boolean }) {
  const setHover = useStudioUI((s) => s.setHover);

  // A volume around the object you are already looking at would sit between
  // the camera and the thing itself (the monitor's player, the badge) and eat
  // its clicks, so it stands down while its stop is active.
  const raycast = useMemo(() => (active || !live ? () => null : THREE.Mesh.prototype.raycast), [active, live]);

  return (
    <mesh
      position={v.center}
      scale={v.size}
      geometry={unit}
      material={ghost}
      raycast={raycast}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(v.id);
      }}
      onPointerOut={() => {
        if (useStudioUI.getState().hover === v.id) setHover(null);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        // Orbit drags end in a click too; only count a real tap.
        if (e.delta > 6) return;
        e.stopPropagation();
        setHover(null);
        goToStop(v.id);
      }}
    />
  );
}

function Pin({ v, index }: { v: Volume; index: number }) {
  const stop = STOP_BY_ID[v.id];
  const hover = useStudioUI((s) => s.hover === v.id);
  return (
    <Html position={v.pin} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
      <button
        type="button"
        className={`${styles.pin} ${hover ? styles.pinHot : ''}`}
        style={{ animationDelay: `${0.25 + index * 0.09}s` }}
        onClick={() => goToStop(v.id)}
        onPointerEnter={() => useStudioUI.getState().setHover(v.id)}
        onPointerLeave={() => useStudioUI.getState().setHover(null)}
        aria-label={`${stop.code} ${stop.title}`}
      >
        <span className={styles.pinDot} />
        <span className={styles.pinCode}>{stop.code}</span>
        <span className={styles.pinTitle}>{stop.title}</span>
      </button>
    </Html>
  );
}

function HoverTag({ v }: { v: Volume }) {
  const stop = STOP_BY_ID[v.id];
  return (
    <Html position={v.pin} center zIndexRange={[31, 0]} style={{ pointerEvents: 'none' }}>
      <div className={styles.tag}>
        <span className={styles.tagCode}>{stop.code}</span>
        <span className={styles.tagTitle}>{stop.title}</span>
        <span className={styles.tagObject}>{stop.object} · click to open</span>
      </div>
    </Html>
  );
}

export default function Hotspots() {
  const stop = useStop();
  const hover = useStudioUI((s) => s.hover);
  const landed = useStudioUI((s) => s.landed);
  const listOpen = useStudioUI((s) => s.listOpen);

  // Pointer cursor for anything clickable.
  useEffect(() => {
    if (!hover || hover === stop.id) return;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hover, stop.id]);

  const overview = stop.id === 'home';
  const live = landed && !listOpen;

  return (
    <group>
      {VOLUMES.map((v) => (
        <Volume key={v.id} v={v} active={v.id === stop.id} live={live} />
      ))}

      {live && overview && VOLUMES.map((v, i) => <Pin key={v.id} v={v} index={i} />)}

      {live &&
        !overview &&
        VOLUMES.filter((v) => v.id === hover && v.id !== stop.id).map((v) => <HoverTag key={v.id} v={v} />)}
    </group>
  );
}
