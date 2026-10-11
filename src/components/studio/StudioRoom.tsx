'use client';

/**
 * /room — the studio as a portfolio.
 *
 * Layers, bottom to top: the WebGL room, film grain, the HUD (stops, titles,
 * content panel), the text index, and the film-leader loader. The canvas is
 * client-only; everything else renders on the server, so the portfolio's text
 * is in the HTML before any 3D has loaded.
 */

import dynamic from 'next/dynamic';
import { Component, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useStudioView } from './views';
import { useMonitor } from './monitor';
import { useStudioUI, STOPS, stopForView } from './stops';
import StudioHud from './hud/StudioHud';
import IndexView from './hud/IndexView';
import Loader from './hud/Loader';
import Lightbox from './hud/Lightbox';
import { panelWidth, sheetHeight } from './hud/layout';
import styles from './hud/studio.module.css';

const StudioCanvas = dynamic(() => import('./StudioCanvas'), { ssr: false });

/** A scene that throws hands the visitor to the text index instead of a black screen. */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('[StudioRoom] scene failed', error);
    useStudioUI.getState().setFailed();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function StudioRoom() {
  const view = useStudioView((s) => s.view);
  const setView = useStudioView((s) => s.setView);
  const on = useMonitor((s) => s.on);
  const wake = useMonitor((s) => s.wake);
  const sleep = useMonitor((s) => s.sleep);
  const failed = useStudioUI((s) => s.failed);
  const [gl, setGl] = useState<boolean | null>(null);
  // The canvas mounts a beat after first paint: building the room blocks the
  // main thread, and the loader must already be on screen when it does.
  const [mount, setMount] = useState(false);
  const [size, setSize] = useState({ w: 1440, h: 900 });

  useEffect(() => {
    const ok = hasWebGL();
    setGl(ok);
    if (!ok) useStudioUI.getState().setFailed();
    let t = 0;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => (t = window.setTimeout(() => setMount(true), 350))));
    return () => {
      cancelAnimationFrame(r);
      window.clearTimeout(t);
    };
  }, []);

  // Panel geometry lives in CSS variables so the stylesheet and the camera rig
  // (which reads the same functions) agree on it.
  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Deep links: /room?stop=archive opens on that stop (the intro flies straight
  // there), and walking the room keeps the URL in step so any view can be shared.
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get('stop');
    const match = STOPS.find((s) => s.id === want);
    if (match) setView(match.view);
  }, [setView]);

  useEffect(() => {
    const id = stopForView(view);
    const url = new URL(window.location.href);
    if (id === 'home') url.searchParams.delete('stop');
    else url.searchParams.set('stop', id);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  }, [view]);

  // The machine follows the camera: arriving at the desk boots it, going
  // anywhere else puts it to sleep so no audio keeps playing off-screen.
  useEffect(() => {
    if (view === 'monitor') wake();
    else sleep();
  }, [view, wake, sleep]);

  // Escape backs out of any close-up. The player owns the key while it is
  // mounted, so this only runs once the monitor is asleep.
  useEffect(() => {
    if (on || view === 'hero') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useStudioUI.getState().listOpen) setView('hero');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on, view, setView]);

  const vars = {
    '--panel-w': `${panelWidth(size.w)}px`,
    '--sheet-h': `${sheetHeight(size.h)}px`,
  } as CSSProperties;

  return (
    <div className={styles.root} style={vars}>
      <div className={styles.canvas} aria-hidden="true">
        {gl && mount && !failed && (
          <CanvasBoundary>
            <StudioCanvas />
          </CanvasBoundary>
        )}
      </div>
      <div className={styles.grain} aria-hidden="true" />

      <StudioHud />
      <IndexView />
      <Lightbox />
      <Loader />
    </div>
  );
}
