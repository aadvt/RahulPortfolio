'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { SHOWCASE_ASSETS, type ShowcaseAsset } from '@/data/showcaseAssets';
import SceneErrorBoundary from '@/components/room/SceneErrorBoundary';
import AssetDetail from './AssetDetail';
import { COLORS, MONO, SANS, label } from './styles';

// WebGL must not run during SSR, so every canvas host is client-only.
const AssetCard = dynamic(() => import('./AssetCard'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        aspectRatio: '4 / 3',
        borderRadius: '16px',
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
      }}
    />
  ),
});

const TOTALS = SHOWCASE_ASSETS.reduce(
  (sum, asset) => ({
    components: sum.components + asset.componentCount,
    materials: sum.materials + asset.materialCount,
  }),
  { components: 0, materials: 0 },
);

function Stat({ value, name }: { value: string; name: string }) {
  return (
    <div>
      <div style={{ fontFamily: SANS, fontSize: '26px', fontWeight: 600, color: COLORS.text }}>
        {value}
      </div>
      <div style={{ ...label, marginTop: '2px' }}>{name}</div>
    </div>
  );
}

export default function ShowcaseGallery() {
  const [active, setActive] = useState<ShowcaseAsset | null>(null);

  // ?asset=<id> opens straight into a model, so a single object is linkable.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('asset');
    const match = SHOWCASE_ASSETS.find((asset) => asset.id === requested);
    if (match) setActive(match);
  }, []);

  // Freeze the grid turntables while the detail viewer holds the foreground —
  // five live contexts on one page is more GPU than the page is worth.
  useEffect(() => {
    document.body.style.overflow = active ? 'hidden' : '';
    const url = new URL(window.location.href);
    if (active) url.searchParams.set('asset', active.id);
    else url.searchParams.delete('asset');
    window.history.replaceState(null, '', url);
    return () => {
      document.body.style.overflow = '';
    };
  }, [active]);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: SANS,
        padding: 'clamp(32px, 5vw, 56px) clamp(18px, 4vw, 32px) 96px',
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            ...label,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={12} />
          Back
        </Link>

        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '32px',
            margin: '28px 0 12px',
          }}
        >
          <div style={{ maxWidth: '620px' }}>
            <p style={{ ...label, color: COLORS.accent }}>img2threejs pipeline</p>
            <h1
              style={{
                fontSize: 'clamp(38px, 5.5vw, 60px)',
                fontWeight: 600,
                letterSpacing: '-0.03em',
                lineHeight: 1.02,
                margin: '12px 0 0',
              }}
            >
              Reference photo
              <span style={{ color: COLORS.textMuted }}> to </span>
              procedural mesh
            </h1>
            <p
              style={{
                fontSize: '15px',
                lineHeight: 1.65,
                color: COLORS.textMuted,
                margin: '18px 0 0',
              }}
            >
              Four objects from the studio room, reconstructed as code. No GLB files and no
              baked textures — each model is a factory that assembles primitives and generates
              its own albedo, roughness, normal and AO maps in the browser at runtime.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '40px' }}>
            <Stat value={String(SHOWCASE_ASSETS.length)} name="assets" />
            <Stat value={String(TOTALS.components)} name="components" />
            <Stat value={String(TOTALS.materials)} name="materials" />
          </div>
        </header>

        <SceneErrorBoundary>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))',
              gap: '18px',
              marginTop: '44px',
            }}
          >
            {SHOWCASE_ASSETS.map((asset, index) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                index={index}
                paused={active !== null}
                onOpen={setActive}
              />
            ))}
          </div>
        </SceneErrorBoundary>

        <p
          style={{
            fontFamily: MONO,
            fontSize: '11px',
            color: COLORS.textMuted,
            lineHeight: 1.7,
            marginTop: '44px',
          }}
        >
          All four models are at the <span style={{ color: COLORS.accent }}>blockout</span> pass,
          but they did not get there the same way.{' '}
          <span style={{ color: COLORS.accent }}>Skateboard</span> was rebuilt through the real
          img2threejs pipeline — suitability gate, detail inventory from zone crops, reference PBR
          extraction at 0.84–0.86 confidence, then a rendered comparison against the source photo
          scored by vision. It scored <span style={{ color: COLORS.accent }}>0.52</span> against a
          0.70 bar and is correctly held at <code>refine-code</code>: the deck is still a rectangle
          where the reference has a rounded popsicle outline. The other three carry
          hand-authored specs with <span style={{ color: COLORS.accent }}>zero</span> review
          history — they have never been compared against their references, so treat their pass
          label as a placeholder, not a result. Specs live in <code>.img2threejs/</code>;
          regenerate this metadata with <code>python .img2threejs/build_manifest.py</code>.
        </p>
      </div>

      <AnimatePresence>
        {active && <AssetDetail asset={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </main>
  );
}
