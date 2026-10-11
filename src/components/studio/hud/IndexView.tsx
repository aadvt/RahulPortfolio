'use client';

/**
 * The whole portfolio as one scrolling page.
 *
 * Three jobs:
 *  - a fast path for anyone who would rather read than walk (recruiters);
 *  - the fallback when WebGL is unavailable or the scene throws;
 *  - real, server-rendered text for search engines and screen readers. It is
 *    always in the DOM — closed it is just clipped away and `inert`.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './studio.module.css';
import { STOPS, goToStop, useStudioUI, useStop, type StopId } from '../stops';
import { WorkContent, AboutContent, ArchiveContent, ServicesContent, ContactContent } from './Content';

/** Room left above a section after a jump, clear of the fixed close button. */
const JUMP_OFFSET = 84;

const SECTIONS: { id: StopId; render: () => React.ReactNode }[] = [
  { id: 'work', render: () => <WorkContent inIndex /> },
  { id: 'about', render: () => <AboutContent /> },
  { id: 'archive', render: () => <ArchiveContent /> },
  { id: 'rack', render: () => <ServicesContent /> },
  { id: 'contact', render: () => <ContactContent /> },
];

export default function IndexView() {
  const open = useStudioUI((s) => s.listOpen);
  const failed = useStudioUI((s) => s.failed);
  const setOpen = useStudioUI((s) => s.setListOpen);
  const here = useStop();
  const main = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState<StopId>('work');

  // Opening the index lands on whatever you were looking at in the room.
  useEffect(() => {
    if (!open) return;
    const id = here.id === 'home' ? 'work' : here.id;
    const el = main.current?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (el && main.current) main.current.scrollTo({ top: el.offsetTop - JUMP_OFFSET });
    setSeen(id);
  }, [open, here.id]);

  // Highlight the section being read in the side list: the last one whose top
  // has scrolled past the jump line.
  useEffect(() => {
    const root = main.current;
    if (!root || !open) return;
    const onScroll = () => {
      const line = root.scrollTop + JUMP_OFFSET + 8;
      let current: StopId = 'work';
      root.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => {
        if (el.offsetTop <= line) current = el.dataset.section as StopId;
      });
      setSeen(current);
    };
    onScroll();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [open]);

  useEffect(() => {
    if (!open || failed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, failed, setOpen]);

  const visit = (id: StopId) => {
    setOpen(false);
    goToStop(id);
  };

  return (
    <section
      className={`${styles.list} ${open ? styles.listOn : ''}`}
      aria-label="Portfolio index"
      aria-hidden={!open}
      inert={!open}
    >
      {!failed && (
        <button type="button" className={`${styles.btn} ${styles.listClose}`} onClick={() => setOpen(false)}>
          Back to the room <span className={styles.kbd}>esc</span>
        </button>
      )}

      <aside className={styles.listSide}>
        <ul className={styles.listNav}>
          {STOPS.filter((s) => s.id !== 'home').map((s) => (
            <li key={s.id}>
              <a
                href={`#index-${s.id}`}
                className={seen === s.id ? styles.listNavOn : ''}
                onClick={(e) => {
                  e.preventDefault();
                  const el = main.current?.querySelector<HTMLElement>(`[data-section="${s.id}"]`);
                  if (el && main.current) main.current.scrollTo({ top: el.offsetTop - JUMP_OFFSET, behavior: 'smooth' });
                }}
              >
                <span>{s.code}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ul>
        <span className={styles.brandSub}>
          <span>Rahul® — index</span>
          <span>{failed ? '3D unavailable' : 'or walk the room'}</span>
        </span>
      </aside>

      <div className={styles.listMain} ref={main}>
        {failed && (
          <p className={styles.failNote}>
            The 3D studio couldn&rsquo;t start on this device (WebGL is unavailable or the scene failed to render), so
            here is the same portfolio as a page.
          </p>
        )}
        {SECTIONS.map(({ id, render }) => {
          const s = STOPS.find((x) => x.id === id)!;
          return (
            <article key={id} id={`index-${id}`} data-section={id} className={styles.listSection}>
              <header className={styles.listSectionHead}>
                <span>
                  <b>{s.code}</b> — {s.title}
                </span>
                {!failed && (
                  <button type="button" className={styles.listVisit} onClick={() => visit(id)}>
                    See it in the room →
                  </button>
                )}
              </header>
              {render()}
            </article>
          );
        })}
      </div>
    </section>
  );
}
