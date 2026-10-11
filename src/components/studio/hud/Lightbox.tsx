'use client';

/**
 * Full-screen viewer for the archive. Mounted once at the room root and driven
 * by a store, because both the side panel and the index open it — and the
 * panel's backdrop-filter / clip-path would trap a position:fixed overlay
 * rendered inside it.
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import styles from './studio.module.css';
import { ARCHIVE } from '../stops';

type Store = { index: number | null; open: (i: number) => void; close: () => void; step: (d: number) => void };

export const useLightbox = create<Store>((set) => ({
  index: null,
  open: (index) => set({ index }),
  close: () => set({ index: null }),
  step: (d) => set((s) => (s.index === null ? s : { index: (s.index + d + ARCHIVE.length) % ARCHIVE.length })),
}));

export default function Lightbox() {
  const index = useLightbox((s) => s.index);
  const close = useLightbox((s) => s.close);
  const step = useLightbox((s) => s.step);

  // Owns the keyboard while it is up (capture phase, so the room's own
  // Esc / arrow handlers never see these keys).
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, () => void> = { Escape: close, ArrowRight: () => step(1), ArrowLeft: () => step(-1) };
      const fn = map[e.key];
      if (!fn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      fn();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, close, step]);

  if (index === null) return null;

  return (
    <div className={styles.lightbox} onClick={close} role="dialog" aria-modal="true" aria-label="Image viewer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={index} src={ARCHIVE[index]} alt="" />
      <div className={styles.lightboxBar} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => step(-1)}>
          ← Prev
        </button>
        <span>
          {String(index + 1).padStart(2, '0')} / {String(ARCHIVE.length).padStart(2, '0')} · esc to close
        </span>
        <button type="button" onClick={() => step(1)}>
          Next →
        </button>
      </div>
    </div>
  );
}
