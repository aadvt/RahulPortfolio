'use client';

/**
 * Everything drawn over the canvas. Styled as a camera slate rather than an
 * app: a REC light and running timecode, a scene number and title per stop, a
 * crosshair frame around the subject, and a rail of stops along the bottom.
 */

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './studio.module.css';
import { STOPS, goToStop, stepStop, useStop, useStudioUI, type StopId } from '../stops';
import { useMonitor } from '../monitor';
import { useStudioView, VIEWS, DEBUG_VIEWS } from '../views';
import { CONTENT } from './Content';
import { PANEL_STOPS } from './layout';

/* ------------------------------------------------------------------ */
/* Timecode                                                            */
/* ------------------------------------------------------------------ */

/** HH:MM:SS:FF at 24 fps since the room opened. Written straight to the DOM. */
function Timecode() {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    let last = '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const tick = () => {
      const s = (performance.now() - t0) / 1000;
      const tc = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(Math.floor(s) % 60)}:${pad(
        Math.floor((s % 1) * 24)
      )}`;
      if (tc !== last && el.current) el.current.textContent = tc;
      last = tc;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span className={styles.tc} ref={el}>
      00:00:00:00
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Scene title                                                         */
/* ------------------------------------------------------------------ */

function Title({ id }: { id: StopId }) {
  const stop = STOPS.find((s) => s.id === id)!;
  const letters = stop.title.toUpperCase().split('');
  const atStop = id !== 'home';

  return (
    // keyed by stop so the letters replay their rise on every arrival
    <div key={id} className={`${styles.title} ${atStop ? styles.titleAtStop : ''}`}>
      <div className={styles.titleCode}>
        <b>Scene {stop.code}</b>
        <i />
        <span>{stop.object}</span>
      </div>
      <h1 className={styles.titleWord} style={atStop ? { fontSize: 'clamp(48px, 6.4vw, 104px)' } : undefined}>
        <span aria-hidden="true">
          {letters.map((c, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties}>
              {c === ' ' ? ' ' : c}
            </span>
          ))}
        </span>
        <span className={styles.srOnly}>{stop.title}</span>
        <span className={styles.titleGhost} aria-hidden="true">
          {stop.title.toUpperCase()}
        </span>
      </h1>
      <p className={styles.titleLine}>{stop.line}</p>
      {!atStop && <span className={styles.scribble}>click anything that glows →</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

/**
 * The panel wipes shut, swaps its content while closed, then wipes open on
 * the new stop — so content never visibly jumps from one stop to the next.
 */
function Panel({ id }: { id: StopId }) {
  const hidden = useStudioUI((s) => s.panelHidden);
  const setHidden = useStudioUI((s) => s.setPanelHidden);
  const [shown, setShown] = useState<StopId>(id);
  const [open, setOpen] = useState(PANEL_STOPS.includes(id));
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id === shown) {
      setOpen(PANEL_STOPS.includes(id));
      return;
    }
    setOpen(false);
    const t = window.setTimeout(() => {
      setShown(id);
      setOpen(PANEL_STOPS.includes(id));
      body.current?.scrollTo({ top: 0 });
    }, 480);
    return () => window.clearTimeout(t);
  }, [id, shown]);

  const stop = STOPS.find((s) => s.id === shown)!;
  const render = PANEL_STOPS.includes(shown) ? CONTENT[shown] : undefined;
  const visible = open && !hidden && !!render;

  return (
    <>
      <aside
        className={`${styles.panel} ${visible ? styles.panelOn : ''}`}
        aria-label={`${stop.title} details`}
        aria-hidden={!visible}
        inert={!visible}
      >
        <span className={styles.panelGrip} aria-hidden="true" />
        <header className={styles.panelHead}>
          <span>
            <b>Scene {stop.code}</b> / {stop.title}
          </span>
          <button type="button" className={styles.panelClose} onClick={() => setHidden(true)}>
            Hide <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className={styles.panelBody} ref={body} key={shown}>
          {render?.()}
        </div>
        <footer className={styles.panelFoot}>
          <span className={styles.barcode} aria-hidden="true" />
          <span>Rahul® — studio / {new Date().getFullYear()}</span>
        </footer>
      </aside>

      {open && hidden && render && (
        <button type="button" className={`${styles.btn} ${styles.panelTab}`} onClick={() => setHidden(false)}>
          Show {stop.title} ↗
        </button>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

export default function StudioHud() {
  const stop = useStop();
  const landed = useStudioUI((s) => s.landed);
  const listOpen = useStudioUI((s) => s.listOpen);
  const setListOpen = useStudioUI((s) => s.setListOpen);
  const panelHidden = useStudioUI((s) => s.panelHidden);
  const monitorOn = useMonitor((s) => s.on);
  const view = useStudioView((s) => s.view);
  const setView = useStudioView((s) => s.setView);
  const rail = useRef<HTMLOListElement>(null);
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has('debug'));
  }, []);

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const ui = useStudioUI.getState();
      if (!ui.landed) return;

      if (e.key === 'i' || e.key === 'I') {
        ui.setListOpen(!ui.listOpen);
        return;
      }
      if (ui.listOpen) return;

      // While the reel is up, the player owns the arrows (seek / volume).
      const playerOwnsArrows = useMonitor.getState().on;
      if (!playerOwnsArrows && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        stepStop(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }
      const n = Number(e.key);
      if (e.key.length === 1 && Number.isInteger(n) && n >= 0 && n < STOPS.length) {
        goToStop(STOPS[n].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keep the active stop scrolled into view on the phone rail.
  useEffect(() => {
    // Scroll the rail itself — scrollIntoView would also nudge every scrollable
    // ancestor, which on iOS can shift the whole fixed-height page.
    const list = rail.current;
    const el = list?.querySelector<HTMLElement>(`[data-stop="${stop.id}"]`);
    if (!list || !el || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [stop.id]);

  const framed = PANEL_STOPS.includes(stop.id);

  return (
    <div className={`${styles.hud} ${landed && !listOpen ? styles.hudOn : ''}`} inert={!landed || listOpen}>
      {/* crosshair round the subject */}
      <div
        className={`${styles.frame} ${framed ? styles.frameOn : ''} ${framed && !panelHidden ? styles.frameWithPanel : ''}`}
        aria-hidden="true"
      >
        <span className={styles.corner} />
        <span className={styles.corner} />
        <span className={styles.corner} />
        <span className={styles.corner} />
        <span className={styles.frameLabel}>
          <b>●</b> Focus — {stop.object}
        </span>
      </div>

      {/* top bar */}
      <div className={styles.top}>
        <Link href="/" className={styles.brand} aria-label="Back to the main site">
          <span className={styles.brandMark}>
            Rahul<sup>®</sup>
          </span>
          <span className={styles.brandSub}>
            <span className={styles.brandBack}>← Site</span>
            <span>Studio / vol.01</span>
          </span>
        </Link>

        <div className={styles.topRight}>
          <span className={styles.rec}>
            <span className={styles.recDot} />
            <span>Rec</span>
          </span>
          <Timecode />
          <button
            type="button"
            className={styles.btn}
            onClick={() => setListOpen(true)}
            aria-label="Open the portfolio index"
          >
            Index <span className={styles.kbd}>I</span>
          </button>
        </div>
      </div>

      {/* Scene title. Work and About go without: the reel has its own chrome,
          and the ID card *is* the title card — big type would sit on its print. */}
      {stop.id !== 'work' && stop.id !== 'about' && <Title id={stop.id} />}

      {stop.id === 'work' && (
        <div className={styles.caption}>
          <span style={{ color: '#f4f1ec' }}>Scene 01 — Work</span>
          <span>{monitorOn ? 'space play · ← → seek · n / p next film' : 'click the screen to roll the reel'}</span>
          <span>esc back to the room</span>
        </div>
      )}

      <Panel id={stop.id} />

      {/* keyboard hints */}
      <div className={`${styles.navHint} ${(framed && !panelHidden) || stop.id === 'work' ? styles.navHintOff : ''}`} aria-hidden="true">
        <span>
          <span className={styles.kbd}>←</span>
          <span className={styles.kbd}>→</span> walk
        </span>
        <span>
          <span className={styles.kbd}>0</span>–<span className={styles.kbd}>6</span> jump
        </span>
        <span>
          <span className={styles.kbd}>esc</span> overview
        </span>
        <span>drag · orbit</span>
      </div>

      {/* stop rail */}
      <nav className={styles.nav} aria-label="Studio stops">
        <button type="button" className={styles.navArrow} onClick={() => stepStop(-1)} aria-label="Previous stop">
          ←
        </button>
        <ol className={styles.navList} ref={rail}>
          {STOPS.map((s) => (
            <li key={s.id} data-stop={s.id}>
              <button
                type="button"
                className={`${styles.navItem} ${s.id === stop.id ? styles.navOn : ''}`}
                aria-current={s.id === stop.id ? 'location' : undefined}
                onClick={() => goToStop(s.id)}
                onPointerEnter={() => useStudioUI.getState().setHover(s.id === 'home' ? null : s.id)}
                onPointerLeave={() => useStudioUI.getState().setHover(null)}
              >
                <span className={styles.navCode}>{s.code}</span>
                <span className={styles.navLabel}>{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className={styles.navArrow} onClick={() => stepStop(1)} aria-label="Next stop">
          →
        </button>
      </nav>

      {/* reference-sheet cameras, for build checks only */}
      {debug && (
        <div style={{ position: 'absolute', top: 70, left: 'var(--gutter)', display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 420 }}>
          {DEBUG_VIEWS.map((id) => (
            <button
              key={id}
              type="button"
              className={`${styles.btn} ${view === id ? styles.btnHot : ''}`}
              onClick={() => setView(id)}
            >
              {VIEWS[id].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
