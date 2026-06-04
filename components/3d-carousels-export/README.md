# Premium Standalone 3D Carousels Component Kit

This folder contains standalone, fully-typed React components for the two advanced 3D carousels used in this digital portfolio:

1.  **CircularGallery**: An infinite-looping 3D curved slider with inertia dragging and velocity skewing.
2.  **PerspectiveCarousel**: A 3D Merry-Go-Round Perspective Carousel that rotates items along a Y-axis orbit. Supports viewport scroll-linked orbit tracking, free automatic spin (autoplay), and touch/mouse dragging. Includes an optional WebGL2 fluid shader background.

---

## 📦 Prerequisites & Dependencies

To use these components in a separate React or Next.js project, install the following peer dependencies:

```bash
npm install framer-motion three
```

And if using TypeScript, install the types for Three.js:

```bash
npm install --save-dev @types/three
```

*Note: Make sure your bundler compiles global CSS imports (default behavior in Next.js, Create React App, Vite, etc.), as the components import `./carousel-styles.css` directly.*

---

## 🛠️ Usage Guides

### 1. CircularGallery

This component renders the curved infinite horizontal carousel. It uses vanilla JS inertia physics and does not require complex animation libraries.

#### Example

```tsx
import { CircularGallery } from "./CircularGallery";

const items = [
  { type: "image", src: "/path/to/img1.jpg", title: "Project Alpha" },
  { type: "video", src: "https://player.vimeo.com/video/12345?background=1&autoplay=1&loop=1&muted=1", title: "Project Beta" },
  { type: "video", src: "https://player.vimeo.com/video/67890?background=1&autoplay=1&loop=1&muted=1", title: "Project Gamma", rotate: 270 }
];

export default function Page() {
  return (
    <main style={{ overflowX: "hidden", background: "#000" }}>
      <CircularGallery 
        items={items} 
        bend={3} 
        scrollSpeed={1.5}
        autoPlaySpeed={0.3} 
        onItemClick={(item) => console.log("Clicked:", item)}
      />
    </main>
  );
}
```

#### API Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `items` | `GalleryItem[]` | *Defaults* | List of slides containing `type` (`video`/`image`), `src`, `title`, and optional `rotate` (for vertical videos). |
| `bend` | `number` | `3` | Arc bending coefficient. Positive values curve upwards, negative values curve downwards. |
| `scrollSpeed`| `number` | `1.5` | Drag and scroll velocity multiplier. |
| `scrollEase` | `number` | `0.08` | Lerp interpolation ease factor (inertia decay rate). |
| `autoPlaySpeed`| `number` | `0.3` | Speed of gentle auto-drift when user is not interacting. |
| `onItemClick`| `function` | `undefined` | Callback fired when user clicks/taps on a card. |

---

### 2. PerspectiveCarousel

This component renders the 3D merry-go-round scene. In scroll-linked mode, it creates a scroll-pinned section that rotates as the page is scrolled. In free mode, it rotates automatically and can be spun by dragging.

#### Example (Scroll-Linked Viewport Orbit)

```tsx
import { PerspectiveCarousel } from "./PerspectiveCarousel";

const items = [
  { type: "image", src: "/img1.jpg", title: "Item 01", className: "media-card-medium" },
  { type: "video", src: "https://player.vimeo.com/video/123", title: "Item 02", className: "media-card-video-landscape" },
  { type: "image", src: "/img2.jpg", title: "Item 03", className: "media-card-tall" }
];

export default function Page() {
  return (
    <main>
      {/* PerspectiveCarousel creates a 400vh tall scroll container and handles pinning internally */}
      <PerspectiveCarousel 
        items={items}
        scrollLinked={true}
        scrollSectionHeight="400vh"
        useShaderBackground={true}
      />
    </main>
  );
}
```

#### Example (Draggable & Autoplay Spin)

```tsx
import { PerspectiveCarousel } from "./PerspectiveCarousel";

export default function Page() {
  return (
    <main style={{ height: "100vh", width: "100vw" }}>
      <PerspectiveCarousel 
        scrollLinked={false}
        autoPlay={true}
        autoPlaySpeed={0.15}
        interactive={true}
        useShaderBackground={true}
      />
    </main>
  );
}
```

#### API Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `items` | `CarouselItem[]` | *Defaults* | List of slides containing `type` (`video`/`image`), `src`, `title`, and layout `className`. |
| `radius` | `number` | `784` (desktop) / `480` (mobile) | Spatial distance from the camera center to the cards. |
| `scrollLinked` | `boolean` | `true` | When `true`, binds rotation/depth/tilt directly to document scrolling. |
| `scrollSectionHeight`| `string` | `"400vh"` | Height of scroll track when `scrollLinked` is `true`. |
| `autoPlay` | `boolean` | `true` | When `scrollLinked={false}`, spins the track continuously. |
| `autoPlaySpeed`| `number` | `0.15` | Degrees of rotation added per animation frame. |
| `interactive` | `boolean` | `true` | Allows users to drag/swipe horizontally to spin the track manually in free mode. |
| `useShaderBackground`| `boolean` | `true` | Renders the Three.js reactive Fluid WebGL2 background. |
| `onItemClick`| `function` | *Modal Open* | Custom click callback. If left empty, a modal overlays automatically. |

---

## 🎨 Layout Classes for Cards

For the `PerspectiveCarousel`, you can apply different aspect ratio dimensions to individual cards using their `className` property:

*   `media-card-medium`: Square proportions (ideal for mixed media).
*   `media-card-wide`: Horizontal banner-like assets.
*   `media-card-tall`: Editorial vertical graphics.
*   `media-card-video-landscape`: Designed specifically for 16:9 videos.
*   `media-card-video-portrait`: Designed specifically for 9:16 vertical videos.

To display standard vertical videos formatted in 16:9 landscape boundaries correctly inside a vertical frame, pass `rotate: 90` or `rotate: 270` in the item data object. The components will automatically rotate the video context inside their wrappers.
