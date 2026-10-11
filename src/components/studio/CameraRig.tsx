'use client';

/**
 * Drives the camera between named views and owns the orbit controls.
 *
 * Every move is a single tween of one progress value rather than three
 * independent tweens on position / target / fov. That gives us:
 *  - one thing to kill when the user clicks again mid-flight (no tweens
 *    fighting each other over the same vector),
 *  - an arc: long moves lift off the floor plane and come back down, the way a
 *    camera operator would boom over furniture instead of sliding through it,
 *  - duration that scales with distance, so a hop from the monitor to the badge
 *    is quick and a flight across the room takes its time.
 *
 * Also here: the intro flight in from outside the diorama, a slow idle sway on
 * the overview so the hero never looks like a still, portrait-aware framing,
 * and a projection offset that keeps the subject clear of the content panel.
 */

import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import gsap from 'gsap';
import { VIEWS, useStudioView, type View } from './views';
import { useStudioUI, stopForView } from './stops';
import { panelInset } from './hud/layout';

type Controls = React.ComponentRef<typeof OrbitControls>;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Views are authored for a 16:9 frame. On a portrait phone the same vertical
 * fov would crop most of the room off the sides, so widen it until the frame
 * holds the horizontal coverage of a ~5:4 screen — capped before it fisheyes.
 */
const REF_ASPECT = 1.25;
export function fovFor(v: View, aspect: number): number {
  const base = v.fov ?? 50;
  if (aspect >= REF_ASPECT) return base;
  const half = THREE.MathUtils.degToRad(base / 2);
  const widened = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * (REF_ASPECT / aspect)));
  return Math.min(widened, 90);
}

/** Seconds for a move of `d` metres. */
const durationFor = (d: number) => THREE.MathUtils.clamp(0.8 + d * 0.17, 0.85, 2.3);

const IDLE_AFTER = 4.5; // seconds without input before the overview starts to sway
const SWAY_AMP = 0.085; // radians of azimuth either side
const SWAY_RATE = 0.16; // rad/s of the sway phase

export default function CameraRig() {
  const controls = useRef<Controls>(null);
  const view = useStudioView((s) => s.view);
  const ready = useStudioUI((s) => s.ready);
  const { camera, size, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;

  const tween = useRef<gsap.core.Tween | null>(null);
  const flying = useRef(false);
  const introDone = useRef(false);
  const lastInput = useRef(0);
  const sway = useRef<{ base: THREE.Vector3; phase: number; amp: number } | null>(null);
  const shift = useRef({ x: 0, y: 0 });

  /* ---------------------------------------------------------------- */
  /* flights                                                          */
  /* ---------------------------------------------------------------- */

  /** Fly to `v`. `from` overrides the start (used by the intro). */
  const fly = (v: View, opts: { duration?: number; ease?: string; lift?: number; onDone?: () => void } = {}) => {
    const c = controls.current;
    if (!c) {
      // Controls not mounted yet: place the camera outright rather than drop
      // the move — the intro's onDone is what lets the HUD come up at all.
      cam.position.set(...v.position);
      cam.lookAt(...v.target);
      cam.fov = fovFor(v, size.width / size.height);
      cam.updateProjectionMatrix();
      opts.onDone?.();
      return;
    }
    tween.current?.kill();
    sway.current = null;

    const p0 = cam.position.clone();
    const t0 = c.target.clone();
    const f0 = cam.fov;
    const p1 = new THREE.Vector3(...v.position);
    const t1 = new THREE.Vector3(...v.target);
    const f1 = fovFor(v, size.width / size.height);

    const dist = p0.distanceTo(p1) + t0.distanceTo(t1) * 0.5;
    const reduced = prefersReducedMotion();
    const duration = reduced ? 0 : opts.duration ?? durationFor(dist);
    // Boom up over the furniture on long moves; nothing on short hops.
    const lift = opts.lift ?? THREE.MathUtils.clamp((dist - 1.2) * 0.12, 0, 0.55);

    const apply = (k: number) => {
      cam.position.lerpVectors(p0, p1, k);
      cam.position.y += Math.sin(Math.PI * k) * lift;
      c.target.lerpVectors(t0, t1, k);
      cam.fov = f0 + (f1 - f0) * k;
      cam.updateProjectionMatrix();
      c.update();
    };

    if (duration === 0) {
      apply(1);
      opts.onDone?.();
      return;
    }

    flying.current = true;
    c.enabled = false;
    const state = { k: 0 };
    tween.current = gsap.to(state, {
      k: 1,
      duration,
      ease: opts.ease ?? 'power3.inOut',
      onUpdate: () => apply(state.k),
      onComplete: () => {
        flying.current = false;
        c.enabled = true;
        lastInput.current = performance.now() / 1000;
        opts.onDone?.();
      },
    });
  };

  // Park the camera outside the diorama until the scene is ready.
  useEffect(() => {
    const c = controls.current;
    const v = VIEWS.hero;
    const target = new THREE.Vector3(...v.target);
    const out = new THREE.Vector3(...v.position).sub(target).multiplyScalar(1.08).add(target);
    out.y += 0.35;
    cam.position.copy(out);
    cam.fov = fovFor(v, size.width / size.height) + 6;
    cam.updateProjectionMatrix();
    if (c) {
      c.target.copy(target).add(new THREE.Vector3(0, -0.6, 0));
      c.update();
    }
    // Only ever on mount; later resizes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intro: once the first frame of the room is up, swoop into the overview.
  useEffect(() => {
    if (!ready || introDone.current) return;
    introDone.current = true;
    const v = VIEWS[useStudioView.getState().view];
    fly(v, {
      duration: 2.9,
      ease: 'power4.out',
      lift: 0,
      onDone: () => useStudioUI.getState().setLanded(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Every later view change.
  useEffect(() => {
    if (!introDone.current) return;
    fly(VIEWS[view]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Re-frame for the new aspect when the window changes shape between moves.
  useEffect(() => {
    if (flying.current || !introDone.current) return;
    cam.fov = fovFor(VIEWS[useStudioView.getState().view], size.width / size.height);
    cam.updateProjectionMatrix();
  }, [size.width, size.height, cam]);

  /* ---------------------------------------------------------------- */
  /* input tracking (for the idle sway)                               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const el = gl.domElement;
    const poke = () => {
      lastInput.current = performance.now() / 1000;
      sway.current = null;
    };
    el.addEventListener('pointerdown', poke);
    el.addEventListener('wheel', poke, { passive: true });
    window.addEventListener('keydown', poke);
    return () => {
      el.removeEventListener('pointerdown', poke);
      el.removeEventListener('wheel', poke);
      window.removeEventListener('keydown', poke);
    };
  }, [gl]);

  /* ---------------------------------------------------------------- */
  /* per frame: idle sway + panel offset                              */
  /* ---------------------------------------------------------------- */

  const axis = useRef(new THREE.Vector3(0, 1, 0));
  const tmp = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const now = performance.now() / 1000;
    const currentView = useStudioView.getState().view;
    const ui = useStudioUI.getState();

    // Idle sway on the overview only — anywhere else the user is reading.
    const canSway =
      ui.landed &&
      !flying.current &&
      currentView === 'hero' &&
      !ui.listOpen &&
      !prefersReducedMotion() &&
      now - lastInput.current > IDLE_AFTER;

    if (canSway) {
      if (!sway.current) sway.current = { base: cam.position.clone(), phase: 0, amp: 0 };
      const s = sway.current;
      s.phase += dt * SWAY_RATE;
      s.amp = Math.min(1, s.amp + dt * 0.4); // ease the amplitude in
      const angle = Math.sin(s.phase) * SWAY_AMP * s.amp;
      tmp.current.copy(s.base).sub(c.target).applyAxisAngle(axis.current, angle).add(c.target);
      cam.position.copy(tmp.current);
      c.update();
    }

    // Slide the projection so the subject sits in the space the panel leaves.
    const want = panelInset(stopForView(currentView), ui.panelHidden || ui.listOpen, size.width, size.height);
    const k = 1 - Math.exp(-dt * 6);
    shift.current.x += (want.x - shift.current.x) * k;
    shift.current.y += (want.y - shift.current.y) * k;
    const sx = shift.current.x;
    const sy = shift.current.y;
    if (Math.abs(sx) < 0.5 && Math.abs(sy) < 0.5) {
      if (cam.view?.enabled) cam.clearViewOffset();
    } else {
      cam.setViewOffset(size.width, size.height, sx, sy, size.width, size.height);
    }
  });

  // Debug hook: lets the offline render script frame arbitrary cameras so the
  // build can be shot against the reference sheet panel for panel.
  useEffect(() => {
    const w = window as unknown as { __studio?: unknown };
    w.__studio = {
      set(position: [number, number, number], target: [number, number, number], fov?: number) {
        const c = controls.current;
        if (!c) return;
        tween.current?.kill();
        flying.current = false;
        c.enabled = true;
        cam.position.set(...position);
        c.target.set(...target);
        if (fov) {
          cam.fov = fov;
          cam.updateProjectionMatrix();
        }
        c.update();
      },
    };
    return () => {
      delete w.__studio;
    };
  }, [cam]);

  // minDistance stays under 0.44: the badge close-up sits that far off the
  // card, and a larger floor here would shove the camera straight back out.
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      rotateSpeed={0.55}
      panSpeed={0.6}
      minDistance={0.3}
      maxDistance={7}
      maxPolarAngle={Math.PI * 0.497}
      target={VIEWS.hero.target}
      onStart={() => {
        lastInput.current = performance.now() / 1000;
        sway.current = null;
      }}
    />
  );
}
