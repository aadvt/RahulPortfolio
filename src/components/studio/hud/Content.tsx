'use client';

/**
 * The portfolio itself, as DOM. Each stop's content is one component, rendered
 * in two places: the side panel when you are standing at that stop, and the
 * full-page index (which doubles as the no-WebGL / screen-reader fallback).
 *
 * `--d` on each top-level block staggers its entrance after the panel wipe.
 */

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import styles from './studio.module.css';
import { PROFILE, SERVICES, ARCHIVE, FEEDBACK, goToStop, type StopId } from '../stops';
import { REELS } from '../media';
import { useMonitor } from '../monitor';
import { useLightbox } from './Lightbox';

const d = (n: number) => ({ '--d': n }) as CSSProperties;

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** "Darktrace, Powerade, … and Revolut" — the showreel is not a client. */
const CLIENTS = (() => {
  const names = REELS.filter((r) => r.client !== 'SHOWREEL').map((r) => titleCase(r.client));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('');
})();

function Label({ code, children, n }: { code?: string; children: ReactNode; n: number }) {
  return (
    <h3 className={styles.label} style={d(n)}>
      {code && <b>{code}</b>}
      {children}
    </h3>
  );
}

/* ------------------------------------------------------------------ */
/* 01 Work                                                             */
/* ------------------------------------------------------------------ */

export function WorkContent({ inIndex = false }: { inIndex?: boolean }) {
  const setTrack = useMonitor((s) => s.setTrack);
  return (
    <>
      <h2 className={styles.h} style={d(0)}>
        Selected <em>films</em>
      </h2>
      <p className={styles.lede} style={d(1)}>
        Campaign edits for {CLIENTS}. In the room they play on the studio monitor, with a proper transport bar.
      </p>
      <ul className={styles.reels} style={d(2)}>
        {REELS.map((r, i) => (
          <li key={r.id} className={styles.reel}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.poster} alt="" loading="lazy" />
            <span>
              <b>{r.client}</b>
              <em>{r.name}</em>
            </span>
            {inIndex ? (
              <button
                type="button"
                onClick={() => {
                  setTrack(i);
                  goToStop('work');
                }}
              >
                Play in room →
              </button>
            ) : (
              <a href={`https://vimeo.com/${r.id}`} target="_blank" rel="noreferrer">
                Vimeo ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 02 About                                                            */
/* ------------------------------------------------------------------ */

export function AboutContent() {
  return (
    <>
      <div className={styles.aboutTop} style={d(0)}>
        <figure className={styles.polaroid} style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PROFILE.portrait} alt={`Portrait of ${PROFILE.name}`} loading="lazy" />
          <figcaption>{PROFILE.handle}</figcaption>
          <span className={styles.star} aria-hidden="true">
            ★
          </span>
        </figure>
        <div>
          <h2 className={styles.h}>
            Rahul
            <br />
            <em>T D</em>
          </h2>
          <dl className={styles.facts}>
            <dt>Role</dt>
            <dd>{PROFILE.role}</dd>
            <dt>Since</dt>
            <dd>{PROFILE.since}</dd>
            <dt>Status</dt>
            <dd>{PROFILE.status}</dd>
          </dl>
        </div>
      </div>

      <p className={styles.lede} style={d(1)}>
        {PROFILE.intro[0]}
      </p>
      <p className={styles.p} style={d(2)}>
        {PROFILE.intro[1]}
      </p>

      <div className={styles.stickers} style={d(3)}>
        {PROFILE.traits.map((t, i) => (
          <span key={t} className={styles.sticker} style={{ '--r': `${[-3, 2, -1.5, 3][i % 4]}deg` } as CSSProperties}>
            {t}
          </span>
        ))}
      </div>

      <Label code="★" n={4}>
        What people say
      </Label>
      {FEEDBACK.map((f, i) => (
        <figure key={f.name} className={styles.quote} style={d(5 + i)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.avatar} alt="" loading="lazy" />
          <div>
            <blockquote>“{f.quote}”</blockquote>
            <figcaption>{f.name}</figcaption>
          </div>
        </figure>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 03 Archive                                                          */
/* ------------------------------------------------------------------ */

export function ArchiveContent() {
  const open = useLightbox((s) => s.open);
  return (
    <>
      <h2 className={styles.h} style={d(0)}>
        The <em>wall</em>
      </h2>
      <p className={styles.lede} style={d(1)}>
        Selected identity fragments, motion tests and visual systems — pinned up the way they live in the studio.
      </p>
      <div className={styles.grid} style={d(2)}>
        {ARCHIVE.map((src, i) => (
          <button key={src} type="button" className={styles.shot} onClick={() => open(i)} aria-label={`Open image ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" />
            <span>{String(i + 1).padStart(2, '0')}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 04 Services                                                         */
/* ------------------------------------------------------------------ */

export function ServicesContent() {
  const [open, setOpen] = useState(0);
  return (
    <>
      <h2 className={styles.h} style={d(0)}>
        On the <em>rack</em>
      </h2>
      <p className={styles.lede} style={d(1)}>
        Four disciplines, worn in. Most projects pull from more than one hanger.
      </p>
      <ul className={styles.services} style={d(2)}>
        {SERVICES.map((s, i) => {
          const isOpen = open === i;
          return (
            <li key={s.title} className={`${styles.service} ${isOpen ? styles.serviceOpen : ''}`}>
              <button
                type="button"
                className={styles.serviceHead}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : i)}
              >
                <span className={styles.serviceNum}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.serviceTitle}>{s.title}</span>
                <span className={styles.servicePlus} aria-hidden="true" />
              </button>
              <div className={styles.serviceBody}>
                <div>
                  <ul>
                    {s.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" className={styles.cta} style={d(3)} onClick={() => goToStop('contact')}>
        Start a project <i>→</i>
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 06 Contact                                                          */
/* ------------------------------------------------------------------ */

export function ContactContent() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(PROFILE.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${PROFILE.email}`;
    }
  }, []);

  return (
    <>
      <h2 className={styles.h} style={d(0)}>
        Let&rsquo;s make
        <br />
        something <em>loud</em>
      </h2>
      <span className={styles.status} style={d(1)}>
        <i aria-hidden="true" /> {PROFILE.status}
      </span>

      <a className={styles.mail} style={d(2)} href={`mailto:${PROFILE.email}`}>
        {PROFILE.email}
      </a>
      <div className={styles.row} style={d(3)}>
        <button type="button" className={`${styles.btn} ${copied ? styles.btnHot : ''}`} onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy email'}
        </button>
        <a className={styles.btn} href={`mailto:${PROFILE.email}?subject=Project%20enquiry`}>
          Write now ↗
        </a>
      </div>

      <Label code="↗" n={4}>
        Elsewhere
      </Label>
      <ul className={styles.links} style={d(5)}>
        <li>
          <a href={PROFILE.instagram.url} target="_blank" rel="noreferrer">
            Instagram <span>{PROFILE.instagram.handle}</span>
          </a>
        </li>
        <li>
          <a href="/">
            Main site <span>scroll edition</span>
          </a>
        </li>
      </ul>
    </>
  );
}

export const CONTENT: Partial<Record<StopId, () => ReactNode>> = {
  work: () => <WorkContent />,
  about: () => <AboutContent />,
  archive: () => <ArchiveContent />,
  rack: () => <ServicesContent />,
  contact: () => <ContactContent />,
};
