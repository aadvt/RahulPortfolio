'use client';

/**
 * The monitor's glass, and what plays on it.
 *
 * Asleep, the glass carries the baked editor-UI texture. Click it and the
 * camera flies to the desk and a real DOM panel — a Vimeo iframe plus a
 * desktop-style transport bar — is CSS-3D transformed onto the exact rectangle
 * the texture occupied. The video cannot be a WebGL texture: Vimeo is a
 * cross-origin iframe and there is no frame buffer to sample.
 *
 * Everything the player shows is driven through the Vimeo Player SDK, so the
 * scrubber, volume and transport behave like a media player on a desktop
 * rather than like Vimeo's own chrome, which is switched off entirely.
 */

import * as THREE from 'three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { MONITOR as MON, C } from '../spec';
import { plain, glow, Slab } from '../kit';
import { screenTexture } from '../textures';
import { REELS, embedSrc } from '../media';
import { useMonitor } from '../monitor';
import { useStudioView } from '../views';
import { useStudioUI } from '../stops';

/* ------------------------------------------------------------------ */
/* Vimeo SDK                                                           */
/* ------------------------------------------------------------------ */

type VimeoEvent = { seconds?: number; duration?: number; percent?: number; volume?: number };

type VimeoPlayer = {
  play(): Promise<void>;
  pause(): Promise<void>;
  getDuration(): Promise<number>;
  setCurrentTime(t: number): Promise<number>;
  setVolume(v: number): Promise<number>;
  setMuted(m: boolean): Promise<boolean>;
  loadVideo(id: string | number): Promise<number>;
  on(event: string, cb: (data: VimeoEvent) => void): void;
  destroy(): Promise<void>;
};

type VimeoGlobal = { Player: new (el: HTMLIFrameElement) => VimeoPlayer };

const SDK = 'https://player.vimeo.com/api/player.js';

/** Loads player.js once per document and reports when the global is live. */
function useVimeoSdk(active: boolean) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return;
    const w = window as unknown as { Vimeo?: VimeoGlobal };
    if (w.Vimeo) {
      setReady(true);
      return;
    }
    const done = () => setReady(true);
    let el = document.querySelector<HTMLScriptElement>('script[data-vimeo-sdk]');
    if (!el) {
      el = document.createElement('script');
      el.src = SDK;
      el.async = true;
      el.dataset.vimeoSdk = 'true';
      document.head.appendChild(el);
    }
    el.addEventListener('load', done);
    return () => el?.removeEventListener('load', done);
  }, [active]);

  return ready;
}

/* ------------------------------------------------------------------ */
/* Player panel (DOM)                                                  */
/* ------------------------------------------------------------------ */

/**
 * Panel layout, in the pixels the DOM is authored at before the CSS-3D scale.
 * Kept here rather than in the stylesheet because the rotated-master iframes
 * have to be sized against the stage in absolute terms — see `rotStyle`.
 */
const PX_W = 1474;
const PX_H = 600;
const BAR_H = 36;
const CTL_H = 76;
const TASK_H = 28;
const SIDE_W = 268;
const STAGE_W = PX_W - SIDE_W;
const STAGE_H = PX_H - BAR_H - CTL_H - TASK_H;

/**
 * A master stored on its side goes in a box the size of the stage *turned
 * ninety degrees*, so that rotating it back lands it exactly on the stage.
 * Vimeo letterboxes the video inside that box, and the letterboxing rotates
 * with it — which is what makes a 9:16 cut come out upright and centred.
 */
const rotStyle = (deg: number): React.CSSProperties => ({
  inset: 'auto',
  top: '50%',
  left: '50%',
  width: STAGE_H,
  height: STAGE_W,
  transform: `translate(-50%,-50%) rotate(${deg}deg)`,
  transformOrigin: 'center center',
});

const clock = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

function ReelPlayer({ onSleep }: { onSleep: () => void }) {
  const { track, setTrack } = useMonitor();
  const sdk = useVimeoSdk(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<VimeoPlayer | null>(null);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(true);
  const [loop, setLoop] = useState(false);
  const [theatre, setTheatre] = useState(false);
  const [now, setNow] = useState('');

  // Playback state the effects and key handlers need to read without
  // re-subscribing to every one of them.
  const live = useRef({ playing, volume, muted, loop, track, time, duration });
  live.current = { playing, volume, muted, loop, track, time, duration };

  const scrubbing = useRef(false);
  const first = useRef(true);
  // Whatever was selected last time the desk was visited. Frozen at mount so
  // the iframe's src never changes — swapping it would tear the SDK off.
  const booted = useRef(track).current;

  /* ---- wall clock in the title bar ---- */
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    tick();
    const t = window.setInterval(tick, 15000);
    return () => window.clearInterval(t);
  }, []);

  /* ---- attach the SDK to the iframe, once ---- */
  useEffect(() => {
    if (!sdk || !iframeRef.current) return;
    const w = window as unknown as { Vimeo: VimeoGlobal };
    const p = new w.Vimeo.Player(iframeRef.current);
    playerRef.current = p;

    p.on('play', () => setPlaying(true));
    p.on('pause', () => setPlaying(false));
    p.on('timeupdate', (d) => {
      if (!scrubbing.current && d.seconds != null) setTime(d.seconds);
      if (d.duration) setDuration(d.duration);
    });
    p.on('progress', (d) => setBuffered(d.percent ?? 0));
    p.on('loaded', () => p.getDuration().then(setDuration).catch(() => {}));
    p.on('ended', () => {
      if (live.current.loop) {
        p.setCurrentTime(0).then(() => p.play()).catch(() => {});
      } else {
        setTrack((live.current.track + 1) % REELS.length);
      }
    });

    return () => {
      playerRef.current = null;
      p.destroy().catch(() => {});
    };
  }, [sdk, setTrack]);

  /* ---- swapping reels keeps the same iframe, so the SDK stays attached ---- */
  useEffect(() => {
    if (first.current) {
      first.current = false; // the iframe already booted on REELS[track]
      return;
    }
    const p = playerRef.current;
    if (!p) return;
    setTime(0);
    setDuration(0);
    setBuffered(0);
    p.loadVideo(REELS[track].id)
      .then(async () => {
        await p.setMuted(live.current.muted);
        await p.setVolume(live.current.muted ? 0 : live.current.volume);
        await p.play().catch(() => {});
        p.getDuration().then(setDuration).catch(() => {});
      })
      .catch(() => {});
  }, [track]);

  /* ---- transport ---- */
  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (live.current.playing) p.pause().catch(() => {});
    else p.play().catch(() => {});
  }, []);

  const seekBy = useCallback((d: number) => {
    const p = playerRef.current;
    if (!p) return;
    const { time: t, duration: len } = live.current;
    const next = Math.max(0, len ? Math.min(len, t + d) : t + d);
    setTime(next);
    p.setCurrentTime(next).catch(() => {});
  }, []);

  const step = useCallback(
    (d: number) => setTrack((track + d + REELS.length) % REELS.length),
    [track, setTrack]
  );

  const applyVolume = useCallback((v: number) => {
    const p = playerRef.current;
    setVolume(v);
    setMuted(v === 0);
    p?.setMuted(v === 0).catch(() => {});
    p?.setVolume(v).catch(() => {});
  }, []);

  const toggleMute = useCallback(() => {
    const next = !live.current.muted;
    setMuted(next);
    const p = playerRef.current;
    p?.setMuted(next).catch(() => {});
    if (!next) p?.setVolume(live.current.volume || 0.8).catch(() => {});
  }, []);

  /* ---- keyboard, the way a desktop player behaves ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          toggle();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekBy(5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekBy(-5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          applyVolume(Math.min(1, Math.round((live.current.volume + 0.1) * 10) / 10));
          break;
        case 'ArrowDown':
          e.preventDefault();
          applyVolume(Math.max(0, Math.round((live.current.volume - 0.1) * 10) / 10));
          break;
        case 'm':
          toggleMute();
          break;
        case 'n':
          step(1);
          break;
        case 'p':
          step(-1);
          break;
        case 'Escape':
          onSleep();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, seekBy, applyVolume, toggleMute, step, onSleep]);

  const reel = REELS[track];
  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <div className="rmOS" onPointerDown={(e) => e.stopPropagation()}>
      <style>{CSS}</style>

      {/* ---------- title bar ---------- */}
      <header className="rmBar">
        <span className="rmDots">
          <i className="rmClose" onClick={onSleep} title="Sleep (Esc)" />
          <i className="rmMin" />
          <i className="rmMax" />
        </span>
        <span className="rmTitle">
          REEL PLAYER <em>—</em> {reel.client} / {reel.name}
        </span>
        <span className="rmClock">{now}</span>
      </header>

      <div className={`rmBody${theatre ? ' rmTheatre' : ''}`}>
        {/* ---------- playlist ---------- */}
        <aside className="rmList">
          <div className="rmListHead">
            PROJECTS <span>{REELS.length}</span>
          </div>
          <div className="rmScroll">
            {REELS.map((r, i) => (
              <button
                key={r.id}
                className={`rmItem${i === track ? ' rmOn' : ''}`}
                onClick={() => setTrack(i)}
              >
                <span className="rmThumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.poster} alt="" draggable={false} />
                  {i === track && playing && (
                    <span className="rmEq">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                </span>
                <span className="rmMeta">
                  <b>{r.client}</b>
                  <em>{r.name}</em>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* ---------- stage ---------- */}
        <section className="rmStage">
          <iframe
            ref={iframeRef}
            src={embedSrc(REELS[booted].id)}
            title="Reel"
            style={reel.rotate ? rotStyle(reel.rotate) : undefined}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            frameBorder="0"
          />
          {muted && (
            <button className="rmUnmute" onClick={toggleMute}>
              🔇 CLICK FOR SOUND
            </button>
          )}
          <span className="rmGlass" />
        </section>
      </div>

      {/* ---------- transport ---------- */}
      <footer className="rmCtl">
        <div className="rmSeek">
          <span className="rmBuf" style={{ width: `${buffered * 100}%` }} />
          <span className="rmPlay" style={{ width: `${pct}%` }} />
          <input
            type="range"
            min={0}
            max={duration || 0.001}
            step={0.05}
            value={Math.min(time, duration || 0)}
            aria-label="Seek"
            onPointerDown={() => (scrubbing.current = true)}
            onPointerUp={() => (scrubbing.current = false)}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTime(v);
              playerRef.current?.setCurrentTime(v).catch(() => {});
            }}
          />
        </div>

        <div className="rmRow">
          <div className="rmKeys">
            <button onClick={() => step(-1)} title="Previous (P)">
              ⏮
            </button>
            <button onClick={() => seekBy(-10)} title="Back 10s (←)">
              ⏪
            </button>
            <button className="rmBig" onClick={toggle} title="Play / pause (Space)">
              {playing ? '❚❚' : '▶'}
            </button>
            <button onClick={() => seekBy(10)} title="Forward 10s (→)">
              ⏩
            </button>
            <button onClick={() => step(1)} title="Next (N)">
              ⏭
            </button>
            <span className="rmTime">
              {clock(time)} <i>/</i> {clock(duration)}
            </span>
          </div>

          <div className="rmKeys rmRight">
            <button
              className={loop ? 'rmActive' : ''}
              onClick={() => setLoop((l) => !l)}
              title="Loop this reel"
            >
              ⟲
            </button>
            <button onClick={toggleMute} title="Mute (M)">
              {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </button>
            <input
              className="rmVol"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              aria-label="Volume"
              onChange={(e) => applyVolume(Number(e.target.value))}
            />
            <button
              className={theatre ? 'rmActive' : ''}
              onClick={() => setTheatre((t) => !t)}
              title="Theatre mode"
            >
              ⤢
            </button>
          </div>
        </div>
      </footer>

      {/* ---------- taskbar ---------- */}
      <div className="rmTask">
        <span className="rmLogo">◈ studio.os</span>
        <span className="rmApp">▸ reel-player</span>
        <span className="rmDim">vimeo · {reel.client.toLowerCase()}</span>
        <span className="rmSpacer" />
        <span className="rmDim">space · ←→ · m · n/p</span>
        <button className="rmSleep" onClick={onSleep}>
          ⏻ back to room
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel styling                                                       */
/* ------------------------------------------------------------------ */

const CSS = /* css */ `
.rmOS{position:absolute;inset:0;display:flex;flex-direction:column;
  font:500 13px/1.3 ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  color:#cfc6da;background:#07070b;letter-spacing:.03em;
  user-select:none;-webkit-user-select:none;overflow:hidden;}
.rmOS *{box-sizing:border-box;}
.rmOS button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0;}

.rmBar{flex:0 0 ${BAR_H}px;display:flex;align-items:center;gap:14px;padding:0 14px;
  background:linear-gradient(#191622,#111017);border-bottom:1px solid #241f30;}
.rmDots{display:flex;gap:7px;}
.rmDots i{width:11px;height:11px;border-radius:50%;display:block;}
.rmClose{background:#ff5f57;cursor:pointer;}
.rmMin{background:#febc2e;}
.rmMax{background:#28c840;}
.rmTitle{font-size:12px;color:#9b90ad;letter-spacing:.12em;}
.rmTitle em{font-style:normal;opacity:.4;padding:0 2px;}
.rmClock{margin-left:auto;font-size:12px;color:#6f6681;letter-spacing:.1em;}

.rmBody{flex:1 1 auto;display:flex;min-height:0;}

.rmList{flex:0 0 ${SIDE_W}px;display:flex;flex-direction:column;min-height:0;
  background:#0b0a10;border-right:1px solid #1d1926;transition:margin-left .28s ease;}
.rmTheatre .rmList{margin-left:-${SIDE_W}px;}
.rmListHead{flex:0 0 28px;display:flex;align-items:center;gap:8px;padding:0 14px;
  font-size:10px;letter-spacing:.24em;color:#5d5570;border-bottom:1px solid #1a1622;}
.rmListHead span{color:#b750ff;}
.rmScroll{flex:1 1 auto;overflow-y:auto;padding:6px;}
.rmScroll::-webkit-scrollbar{width:6px;}
.rmScroll::-webkit-scrollbar-thumb{background:#2a2338;border-radius:3px;}

.rmItem{display:flex;align-items:center;gap:10px;width:100%;padding:6px;border-radius:6px;
  text-align:left;transition:background .16s ease;}
.rmItem:hover{background:#171325;}
.rmItem.rmOn{background:linear-gradient(90deg,rgba(183,80,255,.22),rgba(183,80,255,.04));
  box-shadow:inset 2px 0 0 #b750ff;}
.rmThumb{position:relative;flex:0 0 62px;height:36px;border-radius:4px;overflow:hidden;background:#000;}
.rmThumb img{width:100%;height:100%;object-fit:cover;opacity:.72;}
.rmItem.rmOn .rmThumb img{opacity:1;}
.rmMeta{display:flex;flex-direction:column;gap:2px;min-width:0;}
.rmMeta b{font-size:11px;letter-spacing:.12em;color:#e6def0;font-weight:600;}
.rmMeta em{font-size:10px;font-style:normal;color:#736a85;letter-spacing:.06em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;}

.rmEq{position:absolute;right:4px;bottom:4px;display:flex;gap:2px;align-items:flex-end;height:11px;}
.rmEq i{width:2px;background:#b750ff;animation:rmEq .9s ease-in-out infinite;}
.rmEq i:nth-child(2){animation-delay:.18s;}
.rmEq i:nth-child(3){animation-delay:.36s;}
@keyframes rmEq{0%,100%{height:3px}50%{height:11px}}

.rmStage{position:relative;flex:1 1 auto;background:#000;min-width:0;}
.rmStage iframe{position:absolute;inset:0;width:100%;height:100%;border:0;}
.rmGlass{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(118deg,rgba(255,255,255,.05) 0%,rgba(255,255,255,0) 34%),
             radial-gradient(120% 90% at 50% 45%,rgba(0,0,0,0) 55%,rgba(0,0,0,.45) 100%);}
/* These two need the .rmOS prefix: ".rmOS button" would otherwise out-specify
   a bare class and reset both colour and background. */
.rmOS .rmUnmute{position:absolute;right:16px;bottom:16px;padding:8px 15px;border-radius:999px;
  font-size:11px;font-weight:700;letter-spacing:.14em;color:#0b0810;background:#b750ff;
  box-shadow:0 0 24px rgba(183,80,255,.55);animation:rmPulse 2.4s ease-in-out infinite;}
.rmOS .rmUnmute:hover{background:#c877ff;}
@keyframes rmPulse{0%,100%{opacity:.85}50%{opacity:1}}

.rmCtl{flex:0 0 ${CTL_H}px;padding:9px 16px 6px;background:linear-gradient(#0d0c13,#08080c);
  border-top:1px solid #1d1926;}

.rmSeek{position:relative;height:16px;display:flex;align-items:center;}
.rmSeek::before{content:"";position:absolute;left:0;right:0;height:4px;border-radius:2px;background:#221d2e;}
.rmBuf,.rmPlay{position:absolute;left:0;height:4px;border-radius:2px;pointer-events:none;}
.rmBuf{background:#332a44;}
.rmPlay{background:linear-gradient(90deg,#7a3cff,#b750ff);box-shadow:0 0 10px rgba(183,80,255,.6);}
.rmSeek input{position:relative;width:100%;height:16px;margin:0;background:none;
  -webkit-appearance:none;appearance:none;cursor:pointer;}
.rmSeek input::-webkit-slider-runnable-track{height:16px;background:none;}
.rmSeek input::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;margin-top:2px;
  border-radius:50%;background:#fff;box-shadow:0 0 8px rgba(183,80,255,.9);}
.rmSeek input::-moz-range-track{height:16px;background:none;}
.rmSeek input::-moz-range-thumb{width:11px;height:11px;border:0;border-radius:50%;background:#fff;}

.rmRow{display:flex;align-items:center;margin-top:6px;}
.rmKeys{display:flex;align-items:center;gap:4px;}
.rmRight{margin-left:auto;}
.rmKeys button{width:30px;height:26px;border-radius:5px;font-size:12px;color:#9b90ad;
  transition:background .15s ease,color .15s ease;}
.rmKeys button:hover{background:#1c1728;color:#efe8f8;}
.rmKeys button.rmActive{color:#b750ff;background:rgba(183,80,255,.14);}
.rmKeys .rmBig{width:36px;height:26px;font-size:13px;color:#efe8f8;background:#1c1728;}
.rmKeys .rmBig:hover{background:#2a2038;}
.rmTime{margin-left:12px;font-size:11px;color:#8b81a0;letter-spacing:.1em;}
.rmTime i{font-style:normal;opacity:.4;padding:0 3px;}

.rmVol{width:88px;height:16px;margin:0 4px;-webkit-appearance:none;appearance:none;
  background:none;cursor:pointer;}
.rmVol::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:#2a2338;}
.rmVol::-webkit-slider-thumb{-webkit-appearance:none;width:9px;height:9px;margin-top:-3px;
  border-radius:50%;background:#b750ff;}
.rmVol::-moz-range-track{height:3px;border-radius:2px;background:#2a2338;}
.rmVol::-moz-range-thumb{width:9px;height:9px;border:0;border-radius:50%;background:#b750ff;}

.rmTask{flex:0 0 ${TASK_H}px;display:flex;align-items:center;gap:16px;padding:0 14px;
  font-size:10px;letter-spacing:.16em;color:#5d5570;
  background:#0a0910;border-top:1px solid #1a1622;}
.rmLogo{color:#b750ff;}
.rmApp{color:#9b90ad;}
.rmDim{opacity:.75;}
.rmSpacer{flex:1 1 auto;}
.rmOS .rmSleep{color:#9b90ad;letter-spacing:.16em;}
.rmOS .rmSleep:hover{color:#b750ff;}
`;

/* ------------------------------------------------------------------ */
/* 3D glass                                                            */
/* ------------------------------------------------------------------ */

/** Inner glass area, inside the bezel. */
const GW = MON.width - MON.bezel * 2;
const GH = MON.height - MON.bezel * 2;

/**
 * drei's transform mode maps 1 CSS pixel to (distanceFactor || 10) / 400
 * world units, i.e. 40 px per metre, before the group's own scale. So a panel
 * authored at PX_W pixels lands on the glass at exactly this scale.
 *
 * PX_W x PX_H is 1474 x 600 — the glass aspect (0.978 : 0.398) to within a
 * pixel, so nothing is stretched.
 */
const PANEL_SCALE = (GW * 40) / PX_W;

const WORLD = new THREE.Vector3(MON.x, MON.y, MON.z + MON.face);

export default function MonitorScreen() {
  const on = useMonitor((s) => s.on);
  const wake = useMonitor((s) => s.wake);
  const sleep = useMonitor((s) => s.sleep);
  const setView = useStudioView((s) => s.setView);

  const [direct, setDirect] = useState(false);
  // The room's hit volume sits in front of the glass until you are at the desk,
  // so the hover tell has to listen to it as well as to the glass itself.
  const viaVolume = useStudioUI((s) => s.hover === 'work');
  const hover = direct || viaVolume;
  const setHover = setDirect;

  // The baked editor desktop. It stays on the glass even while the player is
  // mounted — the DOM panel covers it completely, and leaving it lit means the
  // monitor never blacks out if the camera swings away mid-playback.
  const idle = useMemo(() => {
    const t = screenTexture();
    return new THREE.MeshBasicMaterial({
      map: t,
      toneMapped: false,
      fog: false,
      color: new THREE.Color(1.28, 1.28, 1.28),
    });
  }, []);

  useEffect(() => {
    document.body.style.cursor = hover && !on ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hover, on]);

  const enter = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (on) return;
      wake();
      setView('monitor');
    },
    [on, wake, setView]
  );

  const exit = useCallback(() => {
    sleep();
    setView('hero');
  }, [sleep, setView]);

  /**
   * The DOM panel has no depth buffer, so once the camera swings behind the
   * desk it would float over the whole room. Hidden by hand from the render
   * loop rather than by unmounting — unmounting would tear down the iframe and
   * restart the video every time the user orbited past.
   */
  const wrap = useRef<HTMLDivElement>(null);
  const toCam = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    const el = wrap.current;
    if (!el) return;
    toCam.current.copy(camera.position).sub(WORLD);
    const dist = toCam.current.length();
    const facing = toCam.current.z / (dist || 1); // glass normal is +Z
    const show = facing > 0.15 && dist < 4.2;
    const want = show ? 'visible' : 'hidden';
    if (el.style.visibility !== want) {
      el.style.visibility = want;
      el.style.pointerEvents = show ? 'auto' : 'none';
    }
  });

  const bezel = plain('#0d0d10', 0.5, 0.2);
  const edge = glow(C.screen, 2.2);
  const b = MON.bezel;

  return (
    <group position={[MON.x, MON.y, MON.z]}>
      {/* the glass — also the click target */}
      <mesh
        position={[0, 0, MON.face]}
        material={idle}
        onClick={enter}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <planeGeometry args={[GW, GH]} />
      </mesh>

      {/* flat bezel ring, so the glass reads as one plane against the curved shell */}
      <Slab size={[MON.width, b, 0.014]} position={[0, GH / 2 + b / 2, MON.face - 0.006]} material={bezel} />
      <Slab size={[MON.width, b, 0.014]} position={[0, -GH / 2 - b / 2, MON.face - 0.006]} material={bezel} />
      <Slab size={[b, MON.height, 0.014]} position={[-GW / 2 - b / 2, 0, MON.face - 0.006]} material={bezel} />
      <Slab size={[b, MON.height, 0.014]} position={[GW / 2 + b / 2, 0, MON.face - 0.006]} material={bezel} />

      {/*
        Hover tell: a hairline round the bezel rather than a glow card. A card
        big enough to read as a highlight is also big enough to fill the frame
        with additive haze once the camera is up against the glass.
      */}
      {hover && !on && (
        <group position={[0, 0, MON.face - 0.004]}>
          <Slab size={[MON.width + 0.01, 0.005, 0.01]} position={[0, MON.height / 2 + 0.004, 0]} material={edge} />
          <Slab size={[MON.width + 0.01, 0.005, 0.01]} position={[0, -MON.height / 2 - 0.004, 0]} material={edge} />
          <Slab size={[0.005, MON.height, 0.01]} position={[-MON.width / 2 - 0.002, 0, 0]} material={edge} />
          <Slab size={[0.005, MON.height, 0.01]} position={[MON.width / 2 + 0.002, 0, 0]} material={edge} />
        </group>
      )}

      {on && (
        <Html
          transform
          position={[0, 0, MON.face + 0.002]}
          scale={PANEL_SCALE}
          zIndexRange={[40, 0]}
          style={{ width: PX_W, height: PX_H }}
        >
          <div
            ref={wrap}
            style={{ width: PX_W, height: PX_H, position: 'relative', overflow: 'hidden' }}
          >
            <ReelPlayer onSleep={exit} />
          </div>
        </Html>
      )}
    </group>
  );
}
