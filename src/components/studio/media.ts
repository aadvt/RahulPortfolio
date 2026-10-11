/**
 * The reel that plays on the studio monitor.
 *
 * These are the same six Vimeo videos the legacy portfolio page carries in its
 * `mediaCarouselItems` array (app/page.jsx) — same ids, same titles, same
 * posters — so the room and the old page never drift apart.
 */

export type Reel = {
  /** Vimeo video id. */
  id: string;
  /** Brand the piece was cut for. */
  client: string;
  /** Campaign / cut name. */
  name: string;
  /** Still used as the playlist thumbnail and the pre-roll poster. */
  poster: string;
  /**
   * Two of these masters were uploaded on their side. The legacy page fixes
   * them with a `.rotate-video-270` class (styles.css); the player here does
   * the same thing, so they read portrait rather than sideways.
   */
  rotate?: 270;
};

export const REELS: Reel[] = [
  {
    id: '1197780573',
    client: 'SHOWREEL',
    name: 'CINEMATIC SHOWREEL',
    poster: '/images/Images_1/IMG_0227.JPG',
  },
  {
    id: '1197831287',
    client: 'DARKTRACE',
    name: 'THE DEFENDERS',
    poster: '/images/Images_1/IMG_7013.PNG',
  },
  {
    id: '1197831230',
    client: 'POWERADE',
    name: "THE ATHLETE'S CODE",
    poster: '/images/Images_1/IMG_7012.PNG',
    rotate: 270,
  },
  {
    id: '1197831232',
    client: 'SUPERBET',
    name: 'BET RESPONSIBLY',
    poster: '/images/Images_1/IMG_7011 (1).PNG',
    rotate: 270,
  },
  {
    id: '1197831233',
    client: 'HARMAN KARDON',
    name: 'SEE / HEAR',
    poster: '/images/Images_1/IMG_6195.PNG',
  },
  {
    id: '1197831231',
    client: 'REVOLUT',
    name: 'MAKE YOUR MONEY MOVE',
    poster: '/images/Images_1/IMG_3035.jpg',
  },
];

/**
 * Our own controls drive playback, so every piece of Vimeo's chrome is off.
 * Autoplay starts muted because no browser will start audio inside a
 * cross-origin iframe without a gesture *in that iframe* — the volume control
 * in our own bar is what actually unmutes.
 */
export function embedSrc(id: string): string {
  const q = new URLSearchParams({
    autoplay: '1',
    muted: '1',
    loop: '0',
    controls: '0',
    title: '0',
    byline: '0',
    portrait: '0',
    playsinline: '1',
    dnt: '1',
    transparent: '0',
  });
  return `https://player.vimeo.com/video/${id}?${q.toString()}`;
}
