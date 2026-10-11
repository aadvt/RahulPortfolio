'use client';

/**
 * Film-leader countdown over the room while it bakes its textures and compiles
 * its shaders. It counts 3 → 2 → 1 at least once — so even a fast machine gets
 * the beat — and then holds on the last number until the canvas reports its
 * first frames. Only then does it wipe up and hand over to the intro flight.
 */

import { useEffect, useState } from 'react';
import styles from './studio.module.css';
import { useStudioUI } from '../stops';

const BEAT = 520; // ms per number

export default function Loader() {
  const sceneReady = useStudioUI((s) => s.sceneReady);
  const failed = useStudioUI((s) => s.failed);
  const setReady = useStudioUI((s) => s.setReady);
  const [n, setN] = useState(3);
  const [gone, setGone] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduced(reduced);
    if (reduced) {
      setN(1);
      return;
    }
    const t = window.setInterval(() => setN((v) => Math.max(1, v - 1)), BEAT);
    return () => window.clearInterval(t);
  }, []);

  const counted = n === 1;

  useEffect(() => {
    if (!(counted && (sceneReady || failed))) return;
    // Wipe first, fly second: the camera swoop starts once the wipe is mostly
    // clear, so the two never compete for the same frames.
    const t = window.setTimeout(() => setGone(true), 260);
    const t2 = window.setTimeout(setReady, 260 + 650);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [counted, sceneReady, failed, setReady]);

  return (
    <div className={`${styles.loader} ${gone ? styles.loaderOut : ''}`} aria-hidden={gone} role="status">
      <span className={styles.loaderBrand}>
        Rahul<sup style={{ color: '#e3142a', fontSize: '0.42em', verticalAlign: 'top' }}>®</sup>
      </span>
      <div className={styles.leader}>
        <span className={styles.leaderSweep} />
        <span className={styles.leaderRing} />
        <span className={styles.leaderCross} />
        {/* Stacked and faded by CSS alone, so the count keeps ticking on the
            compositor while the main thread is busy baking textures. */}
        {[3, 2, 1].map((v) => (
          <span key={v} className={`${styles.leaderNum} ${styles[`leaderNum${v}`]}`} data-reduced={reduced}>
            {v}
          </span>
        ))}
      </div>
      <div className={styles.loaderText}>
        <span>{sceneReady ? 'Room ready' : 'Building the room in code…'}</span>
        <span>Studio · reel 01</span>
      </div>
    </div>
  );
}
