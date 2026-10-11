/**
 * The room as a portfolio: seven stops, walked west to east along the north
 * wall. Each stop is a camera (views.ts), an object in the room that you can
 * click to get there, and a panel of real content.
 *
 * The stop is derived from the camera view rather than stored next to it, so
 * every existing path that moves the camera (the monitor, the badge, Esc, the
 * debug buttons) keeps the HUD in sync without knowing it exists.
 *
 * All of the copy below is lifted from the rest of the site — the home page,
 * the footer, the feedback section and the badge texture. Nothing is invented
 * here; add new projects to these arrays, not to the components.
 */

import { create } from 'zustand';
import { useStudioView, type ViewId } from './views';
import { REELS } from './media';
import { MONITOR, BADGE, TAG, WARDROBE, WINDOW, HALF_D } from './spec';

export type StopId = 'home' | 'work' | 'about' | 'archive' | 'rack' | 'contact';

export type Stop = {
  id: StopId;
  /** Two-digit scene number shown in the HUD. */
  code: string;
  /** One-word title, set in display type. */
  title: string;
  /** What the object in the room is, for the hover label. */
  object: string;
  /** One line under the title. */
  line: string;
  view: ViewId;
  /** World point the focus light aims at and the hover label hangs from. */
  anchor: [number, number, number];
};

export const STOPS: Stop[] = [
  {
    id: 'home',
    code: '00',
    title: 'Studio',
    object: 'The room',
    line: 'Walk the room. Every object opens a part of the portfolio.',
    view: 'hero',
    anchor: [0, 1.2, 0],
  },
  {
    id: 'work',
    code: '01',
    title: 'Work',
    object: 'Monitor',
    line: `${REELS.length} campaign films. Click the screen to roll the reel.`,
    view: 'monitor',
    anchor: [MONITOR.x, MONITOR.y, MONITOR.z + MONITOR.face],
  },
  {
    id: 'about',
    code: '02',
    title: 'About',
    object: 'Studio ID',
    line: 'Digital designer and art director building image-led stories.',
    view: 'badge',
    anchor: [BADGE.x, BADGE.y, BADGE.z],
  },
  {
    id: 'archive',
    code: '03',
    title: 'Archive',
    object: 'The wall',
    line: 'Selected identity fragments, motion tests and visual systems.',
    view: 'archive',
    anchor: [TAG.x, TAG.y, -HALF_D + 0.01],
  },
  {
    id: 'rack',
    code: '04',
    title: 'Services',
    object: 'The rack',
    line: 'Four things I make, hung up like the rest of the wardrobe.',
    view: 'rack',
    anchor: [(WARDROBE.x0 + WARDROBE.x1) / 2, 1.4, -HALF_D + WARDROBE.depth * 0.5],
  },
  {
    id: 'contact',
    code: '05',
    title: 'Contact',
    object: 'Window',
    line: 'Available for freelance and contract work.',
    view: 'contact',
    anchor: [WINDOW.centerX, (WINDOW.sill + WINDOW.head) / 2, -HALF_D - 0.05],
  },
];

export const STOP_BY_ID = Object.fromEntries(STOPS.map((s) => [s.id, s])) as Record<StopId, Stop>;

const BY_VIEW = new Map<ViewId, StopId>(STOPS.map((s) => [s.view, s.id]));

/** The stop a camera view belongs to; the debug views count as the overview. */
export function stopForView(view: ViewId): StopId {
  return BY_VIEW.get(view) ?? 'home';
}

/** Current stop, derived from the camera. */
export function useStop(): Stop {
  const view = useStudioView((s) => s.view);
  return STOP_BY_ID[stopForView(view)];
}

export function goToStop(id: StopId) {
  useStudioView.getState().setView(STOP_BY_ID[id].view);
}

/** Step along the walk, wrapping at both ends. */
export function stepStop(delta: number) {
  const cur = stopForView(useStudioView.getState().view);
  const i = STOPS.findIndex((s) => s.id === cur);
  const next = STOPS[(i + delta + STOPS.length) % STOPS.length];
  goToStop(next.id);
}

/* ------------------------------------------------------------------ */
/* UI state that is not the camera                                     */
/* ------------------------------------------------------------------ */

type UI = {
  /** The canvas has compiled and drawn its first frames. */
  sceneReady: boolean;
  /** The loader has lifted: the intro flight may start. */
  ready: boolean;
  /** WebGL failed; the room falls back to the text index. */
  failed: boolean;
  /** The intro flight has landed; hotspots and the HUD go live. */
  landed: boolean;
  /** Which object the pointer is over, for the in-scene label. */
  hover: StopId | null;
  /** The full-screen text index (also the accessible fallback). */
  listOpen: boolean;
  /** Panel collapsed by the user at the current stop. Reset on every move. */
  panelHidden: boolean;
  setSceneReady: () => void;
  setReady: () => void;
  setFailed: () => void;
  setLanded: () => void;
  setHover: (id: StopId | null) => void;
  setListOpen: (open: boolean) => void;
  setPanelHidden: (hidden: boolean) => void;
};

export const useStudioUI = create<UI>((set) => ({
  sceneReady: false,
  ready: false,
  failed: false,
  landed: false,
  hover: null,
  listOpen: false,
  panelHidden: false,
  setSceneReady: () => set({ sceneReady: true }),
  setReady: () => set({ ready: true }),
  setFailed: () => set({ failed: true, listOpen: true }),
  setLanded: () => set({ landed: true }),
  setHover: (hover) => set({ hover }),
  setListOpen: (listOpen) => set({ listOpen }),
  setPanelHidden: (panelHidden) => set({ panelHidden }),
}));

// Arriving somewhere new always shows that stop's panel again.
useStudioView.subscribe((s, prev) => {
  if (s.view !== prev.view) useStudioUI.setState({ panelHidden: false, hover: null });
});

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

export const PROFILE = {
  name: 'Rahul T D',
  handle: 'l1lRED',
  role: 'Digital Designer & Art Director',
  since: '2024',
  status: 'Available for freelance & contract',
  email: 'Rahulcdf17@gmail.com',
  instagram: { handle: '@l1llred', url: 'https://www.instagram.com/l1llred' },
  portrait: '/images/IMG_5775.PNG',
  intro: [
    'Digital designer building image-led product stories.',
    'Selected identity fragments, motion tests and visual systems — experimental, editorial, streetwear-forward.',
  ],
  traits: ['Experimental', 'Editorial', 'Streetwear-forward', 'Motion-led'],
};

export const SERVICES = [
  {
    title: 'UI / UX Design',
    points: [
      'Wireframing and prototyping',
      'Interface design for web and mobile apps',
      'Usability testing and feedback analysis',
      'Interaction design and micro-animations',
    ],
  },
  {
    title: 'Graphic Design',
    points: [
      'Logo and brand identity design',
      'Social media graphics and ad creatives',
      'Infographics and data visualisation',
      'Custom illustrations and icons',
    ],
  },
  {
    title: 'Web Design',
    points: [
      'Responsive website design',
      'Landing page design and optimisation',
      'Webflow development and customisation',
      'Website maintenance and updates',
    ],
  },
  {
    title: 'Branding',
    points: [
      'Brand strategy and identity development',
      'Visual style guide creation',
      'Typography and colour systems',
      'Brand storytelling and messaging',
    ],
  },
];

export const ARCHIVE = [
  '/images/Images_1/IMG_0227.JPG',
  '/images/Images_1/IMG_3035.jpg',
  '/images/Images_1/IMG_6195.PNG',
  '/images/Images_1/IMG_7011 (1).PNG',
  '/images/Images_1/IMG_7012.PNG',
  '/images/Images_1/IMG_7013.PNG',
  '/images/Images_1/WhatsApp Image 2026-06-18 at 12.49.02 AM.jpeg',
  '/images/Images_1/WhatsApp Image 2026-06-18 at 12.49.04 AM (1).jpeg',
  '/images/Images_1/WhatsApp Image 2026-06-18 at 12.49.04 AM (2).jpeg',
  '/images/Images_1/WhatsApp Image 2026-06-18 at 12.49.04 AM.jpeg',
  '/images/Images_1/WhatsApp Image 2026-06-18 at 12.49.05 AM.jpeg',
  '/images/IMG_5775.PNG',
  '/images/IMG_6471.jpg',
];

export const FEEDBACK = [
  {
    name: 'Dr. Red',
    avatar: '/images/feedback/dr-red.png',
    quote:
      'Creative, adaptable, and always improving. His editing has become increasingly refined and professional, making him a valuable asset to any project.',
  },
  {
    name: 'Honey K',
    avatar: '/images/feedback/honey-k.png',
    quote: 'Smooth transitions, perfect timing, and incredible energy. His edits keep viewers engaged from start to finish.',
  },
  {
    name: 'TFOX',
    avatar: '/images/feedback/tfox.png',
    quote: 'The attention to detail in every edit is what stands out most. Every project feels thoughtful and well-crafted.',
  },
];

// Dev-only handle for the offline render script and console debugging.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__studioUI = useStudioUI;
  (window as unknown as Record<string, unknown>).__studioView = useStudioView;
}
