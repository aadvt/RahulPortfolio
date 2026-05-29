# Viscous — Marketing Content

A real-time WebGL2 fluid simulation rendered as iridescent black oil, built end-to-end in v0. Drag your cursor across the screen to carve furrows into the surface; thin-film interference paints rainbow shimmer inside the trails while the resting surface stays pitch black.

> Template links to fill in before publishing:
>
> - **v0 template URL:** `[V0_TEMPLATE_URL]`
> - **Live demo URL:** `[LIVE_DEMO_URL]`
> - **GitHub repo URL:** `[GITHUB_REPO_URL]`
> - **Vercel deploy URL:** `[VERCEL_DEPLOY_URL]`
> - **Demo video / GIF:** `[DEMO_MEDIA_URL]`
> - **Your handles:** `[X_HANDLE]`, `[LINKEDIN_URL]`

---

## 1. X / Twitter Posts

### Launch post (primary)

> just shipped a thing in v0
>
> a real-time WebGL2 fluid sim rendered as iridescent black oil. drag your cursor — fast strokes carve deep furrows, slow drags whisper across the surface. thin-film interference paints rainbow shimmer inside the trails.
>
> no libraries. all hand-rolled in a single chat.
>
> [LIVE_DEMO_URL]

### Variant — technical hook

> built a navier-stokes fluid solver from scratch in v0:
>
> splat → advect → vorticity → 20-iter jacobi pressure → gradient subtract → viscous damping → ping-pong FBOs at half-res
>
> shaded as iridescent black oil with reconstructed normals + GGX + thin-film
>
> [LIVE_DEMO_URL]

### Variant — vibes

> drag a stick through oil
>
> [DEMO_MEDIA_URL]
>
> made entirely in v0. fork the template: [V0_TEMPLATE_URL]

### Variant — call to fork

> fork this and make it your own:
>
> - swap the palette to mercury, honey, or dark water
> - drop it behind a hero section as a living background
> - tune viscosity, splat radius, iridescence intensity
>
> all in one v0 chat → [V0_TEMPLATE_URL]

### Reply / quote thread (3 tweets)

1/ "drag a stick through oil" — that was the one-line brief. v0 turned it into a 970-line WebGL2 fluid sim in a single conversation.
[DEMO_MEDIA_URL]

2/ the trick: dye thickness becomes a height field, normals are reconstructed from a 4-tap cross of that height, and thin-film interference (cos(2πnh/λ) per RGB wavelength) only blooms where the dye has been carved — so undisturbed surface stays pitch black.

3/ template is live. fork it, restyle it, drop it on your landing page.
→ [V0_TEMPLATE_URL]

---

## 2. LinkedIn Post

**Hook + body — long-form**

> I just shipped a real-time fluid simulation built entirely in v0.
>
> The brief was simple: simulate the visual feedback of dragging a stick through viscous black oil. Faster strokes should carve deeper furrows. Slower drags should barely disturb the surface. The whole thing should feel hyper-real.
>
> The result is a from-scratch WebGL2 implementation — no Three.js, no fluid libraries, no shader frameworks. Just hand-rolled GLSL and ping-pong framebuffers, all generated and iterated through a single v0 conversation.
>
> Under the hood:
> • A miniature Navier-Stokes solver (splat → advect → vorticity confinement → 20-iteration Jacobi pressure projection → gradient subtract → viscous damping)
> • Mouse delta splatted along the segment between previous and current cursor so fast flicks don't leave gaps
> • A super-linear force curve so a slow drag whispers and a hard flick carves
> • The dye field's alpha channel reinterpreted as a surface height map
> • Reconstructed normals + Schlick Fresnel + GGX specular + thin-film interference for the iridescent rainbow shimmer
> • ACES tonemap, black-point crush, chromatic aberration, and grain to land the cinematic look
>
> What used to be a multi-week shader R&D project is now an afternoon in v0.
>
> Live demo: [LIVE_DEMO_URL]
> Fork the template: [V0_TEMPLATE_URL]
>
> #v0 #vercel #webgl #generativeart #shaders

---

## 3. v0 Template Description

> **Short description (one-liner, ~140 chars)**
>
> A hyper-realistic iridescent black oil shader. Real-time WebGL2 fluid sim that responds to mouse speed — drag to carve, watch it shimmer.

> **Long description (template page body)**
>
> ### Viscous — iridescent oil shader
>
> Drag your cursor across the screen and watch it carve furrows into a surface of iridescent black oil. Fast strokes generate deep, pronounced distortions; slow movements produce subtle, whisper-thin trails. Thin-film interference paints rainbow shimmer inside the disturbed regions while the resting surface stays pitch black.
>
> Built from scratch in a single v0 chat — no third-party shader, fluid, or 3D libraries.
>
> **What's inside**
>
> - A miniature Navier-Stokes fluid solver running on WebGL2 ping-pong framebuffers
> - Velocity advection, vorticity confinement, 20-iteration Jacobi pressure projection, viscous damping
> - Mouse-driven splats along the segment between frames so fast motion never gaps
> - Super-linear force scaling tied to smoothed pointer speed
> - Iridescent shading: reconstructed normals, Schlick Fresnel, GGX specular, thin-film interference, faked environment reflection, ACES tonemap, chromatic aberration, film grain
> - Half-res sim, full-res render, DPR capped at 2, dt clamped, visibility-aware RAF loop
> - Graceful fallback when WebGL2 or float textures are unavailable
>
> **Use it for**
>
> - Living hero backgrounds for product launches
> - Generative art experiments
> - Studying real-time shader and fluid simulation patterns
> - A starting point for your own oil / mercury / water / honey variants
>
> **Tech stack**
>
> Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · WebGL2 · GLSL ES 3.00
>
> Fork it, swap the palette, retune the viscosity, and ship.

> **Tags / categories**
>
> shader, webgl, fluid simulation, generative art, hero background, animation, creative coding, landing page, interactive

---

## 4. GitHub README

````markdown
# Viscous

> A real-time WebGL2 fluid simulation rendered as iridescent black oil. Drag your cursor across the screen and watch it carve.

[![Built with v0](https://img.shields.io/badge/built%20with-v0-black)]([V0_TEMPLATE_URL])
[![Deploy with Vercel](https://vercel.com/button)]([VERCEL_DEPLOY_URL])

![Viscous demo]([DEMO_MEDIA_URL])

**Live demo:** [LIVE_DEMO_URL]
**v0 template:** [V0_TEMPLATE_URL]

---

## What it is

A from-scratch implementation of an interactive viscous-fluid surface. Faster mouse movements carve deeper furrows, slower movements produce subtle whisper-thin trails. Thin-film interference paints rainbow shimmer inside the disturbed regions while the resting surface stays pitch black.

No Three.js. No fluid libraries. No shader frameworks. Just hand-rolled GLSL and ping-pong framebuffers — all generated in a single v0 conversation.

## How it works

The simulation is a miniature Navier-Stokes solver running on WebGL2 ping-pong framebuffers:

1. **Splat** — mouse delta is injected along the segment between previous and current cursor positions, with radius and force scaled super-linearly with smoothed pointer speed.
2. **Advect** — velocity and dye fields are advected through the velocity field.
3. **Vorticity confinement** — small-scale rotational detail is amplified to keep swirls crisp.
4. **Divergence** — the divergence of the velocity field is computed.
5. **Pressure projection** — 20 iterations of Jacobi smoothing solve for pressure.
6. **Gradient subtract** — pressure gradient is subtracted to make the velocity field divergence-free (incompressible).
7. **Viscous damping** — exponential decay simulates the viscosity of oil.

The dye field's alpha channel is reinterpreted as a surface height field. The render pass reconstructs normals from a 4-tap cross of that height, then layers:

- Schlick Fresnel
- GGX specular highlights
- Thin-film interference (`cos(2πnh/λ)` for RGB wavelengths) gated by dye thickness
- A faked environment reflection
- ACES tonemap with a black-point crush
- Chromatic aberration tied to local velocity
- Film grain

Sim runs at half resolution, render at full resolution, DPR capped at 2.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router)
- React 19
- TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- WebGL2 / GLSL ES 3.00

## Getting started

```bash
git clone [GITHUB_REPO_URL]
cd viscous
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and drag your cursor.

## Project structure

```
app/
  layout.tsx       # Root layout (metadata, html bg)
  page.tsx         # Full-bleed mount + corner label
components/
  oil-shader.tsx   # The whole experiment — GL setup, shaders, RAF loop
```

Everything that matters lives in `components/oil-shader.tsx`. Shaders are inline as template strings so you can tweak them without leaving the file.

## Tweak it

A few starting points inside `oil-shader.tsx`:

- **Viscosity / persistence** — `velocityDissipation` and `dyeDissipation`
- **Pressure quality** — `pressureIterations` (default 20)
- **Vorticity / swirliness** — `curlStrength`
- **Splat reactivity** — the `applyPointerSplats` force curve and radius
- **Iridescence intensity** — the `thinFilm` thickness multiplier and `iriMask`
- **Base color** — change `base`, `envCool`, `envWarm` in the render fragment shader to swap the oil for mercury, honey, or water

## Built with v0

This template was built end-to-end in [v0](https://v0.app), Vercel's AI-powered design and development tool. The full conversation went from a one-line prompt — "drag a stick through viscous oil" — to a production-ready ~970-line WebGL2 implementation.

Fork the v0 template to remix it in your own chat: [V0_TEMPLATE_URL]

## License

MIT
````

---

## 5. Vercel Community Forum Blog Post

> **Title**
>
> Building a hyper-realistic oil shader in v0, end-to-end

> **Summary / TL;DR**
>
> I built a real-time WebGL2 fluid simulation rendered as iridescent black oil — entirely inside a single v0 chat. No Three.js, no fluid libraries, no shader frameworks. Just hand-rolled GLSL, ping-pong framebuffers, and a tight feedback loop with v0. Here's how it came together and what I learned.

> **Outline**
>
> 1. **The brief** — one line: "drag a stick through viscous oil." Why this is a deceptively hard prompt and why I picked it as a template to showcase what v0 can do beyond UI.
> 2. **Why no libraries** — the case for a from-scratch WebGL2 implementation when the goal is a hero-grade visual: maximum control, zero dependency overhead, ~970 lines, one file.
> 3. **The fluid pipeline** — walking through the splat → advect → vorticity → divergence → 20-iter Jacobi pressure → gradient subtract → viscous damping loop, with a diagram and links to the source.
> 4. **Making it feel like oil, not water** — viscous damping rates, force curves tied to smoothed pointer speed, splatting along segments to avoid gaps on fast strokes, why super-linear response feels right for a "stick in liquid."
> 5. **The shading pass** — turning the dye alpha into a height field, reconstructing normals from a 4-tap cross, layering Schlick Fresnel + GGX + thin-film interference, gating iridescence behind dye thickness so the resting surface stays pitch black.
> 6. **The grading** — ACES tonemap, black-point crush, vignette, chromatic aberration tied to local velocity, film grain. The journey from "looks like a tech demo" to "looks cinematic."
> 7. **Working with v0 on a shader project** — how I prompted, how plan mode helped scope the work, how I iterated on look-and-feel ("make the blacks darker still") in plain English.
> 8. **Forking it for your own site** — a quick walkthrough of swapping the palette to mercury / honey / dark water and dropping it behind a hero section.
> 9. **Links** — live demo, v0 template, GitHub repo.

> **Sample opening paragraph**
>
> A few weeks back I gave v0 a one-line prompt: "design a hyper-realistic shader experiment that simulates dragging a stick through viscous oil." Forty-five minutes and one conversation later, I had a production-ready WebGL2 fluid simulation — about 970 lines of TypeScript and GLSL, no third-party shader or fluid libraries, just hand-rolled ping-pong framebuffers and a render pass with thin-film interference. This post walks through how it came together and what surprised me about using v0 for something this far outside its typical UI-generation use case.

---

## 6. Product Hunt / Show HN-style Submission

> **Tagline (≤60 chars)**
>
> Drag your cursor through iridescent black oil.

> **First comment**
>
> Hi all — I'm a v0 ambassador and this is a template I built end-to-end in a single v0 chat to show what the tool can do beyond UI generation.
>
> It's a real-time WebGL2 fluid simulation rendered as iridescent black oil. Drag your cursor across the screen — fast strokes carve deep furrows, slow drags barely disturb the surface, and thin-film interference paints rainbow shimmer inside the trails.
>
> Under the hood it's a miniature Navier-Stokes solver (splat → advect → vorticity → 20-iter Jacobi pressure → gradient subtract → viscous damping) on ping-pong framebuffers, with a render pass that reconstructs normals from the dye height field and layers Schlick Fresnel + GGX + thin-film interference + ACES tonemap + chromatic aberration + grain.
>
> No third-party shader or fluid libraries. ~970 lines, one file.
>
> - Live demo: [LIVE_DEMO_URL]
> - Fork the v0 template: [V0_TEMPLATE_URL]
> - Source: [GITHUB_REPO_URL]
>
> Happy to answer questions about the implementation or the v0 workflow that produced it.

---

## 7. Newsletter / Dev.to Blurb (short)

> **Subject line options**
>
> - "I built a fluid simulation in a v0 chat"
> - "What v0 can do beyond UI"
> - "Drag your cursor through this"

> **Body**
>
> Most v0 demos show off UI generation. This one doesn't.
>
> I built a from-scratch WebGL2 fluid simulation — rendered as iridescent black oil — entirely inside a single v0 conversation. ~970 lines, no third-party shader or fluid libraries.
>
> Drag your cursor and watch it carve: [LIVE_DEMO_URL]
> Fork the template: [V0_TEMPLATE_URL]

---

## 8. Suggested Hashtags & Mentions

**X / LinkedIn:** `#v0` `#vercel` `#webgl` `#shaders` `#generativeart` `#creativecoding` `#nextjs` `#typescript` `#frontend` `#webdev`

**Mentions to consider:** `@v0` `@vercel` `@rauchg` `@shadcn` `@leeerob`

---

## 9. Demo Capture Shot List

If you're recording a demo video / GIF for the launch, capture these in order:

1. **Hero shot (8s)** — slow horizontal drag across the full canvas, leaving a clean iridescent trail. Read: "this is what it does."
2. **Speed contrast (6s)** — slow circle, then a sudden hard flick. Read: "it responds to how you move."
3. **Carve + decay (10s)** — write a short word with your cursor, hold, watch the trail bloom and slowly relax back to black. Read: "real fluid dynamics."
4. **Detail close-up (4s)** — slow zoom or screen-record at 2x to show the thin-film rainbow + specular highlights inside a single furrow.
5. **Outro card (2s)** — `viscous · built in v0 · [V0_TEMPLATE_URL]`

Recommended specs: 1920×1080 or 1280×720, 60fps, MP4 (for X/LinkedIn) and a looping GIF or WebM (for the README). Keep total length under 30s for social.

---

## 10. Talking Points for AMA / Q&A

- **Why no libraries?** Maximum control over the look, zero dependency overhead, a single file you can read top-to-bottom.
- **How long did it take?** A single afternoon in v0, including the iterations on the look-and-feel.
- **What's the trickiest part?** Making the surface read as *true* black at rest while still allowing cinematic iridescence inside the trails. Solved by gating thin-film thickness and specular highlights behind the dye mask, plus a black-point crush in the tonemap.
- **Can I use this in production?** Yes — it's MIT-licensed, gracefully falls back when WebGL2 or float textures are unavailable, caps DPR at 2, and pauses when the tab is hidden.
- **Will it work on mobile?** It runs, but the experience is built around a precise pointer. A pointer-events touch path is a natural follow-up.
- **How do I make it look like mercury / honey / water?** Change `base`, `envCool`, `envWarm`, and the `thinFilm` thickness multiplier in the render fragment shader. Three numbers and you have a different liquid.
