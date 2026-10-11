'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { X, RotateCw, Box, Image as ImageIcon } from 'lucide-react';
import type { ShowcaseAsset } from '@/data/showcaseAssets';
import AssetCanvas from './AssetCanvas';
import type { LightMode } from './LookDevRig';
import { useIsNarrow } from './useViewport';
import { COLORS, MONO, SANS, chip, label } from './styles';

const LIGHT_MODES: { id: LightMode; hint: string }[] = [
  { id: 'neutral', hint: 'Reads material without reference lighting' },
  { id: 'grazing', hint: 'Low key light exposes flat normals and tiling' },
  { id: 'reference', hint: 'Matches the warmth of the source photo' },
];

interface Props {
  asset: ShowcaseAsset;
  onClose: () => void;
}

const sectionStyle: CSSProperties = {
  padding: '18px 20px',
  borderTop: `1px solid ${COLORS.border}`,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  fontFamily: MONO,
  fontSize: '12px',
  color: COLORS.text,
  padding: '5px 0',
};

function Row({ name, value }: { name: string; value: string }) {
  return (
    <div style={rowStyle}>
      <span style={{ color: COLORS.textMuted, flexShrink: 0 }}>{name}</span>
      <span style={{ minWidth: 0, textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );
}

function countsToText(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key} ×${value}`)
    .join(', ');
}

export default function AssetDetail({ asset, onClose }: Props) {
  const narrow = useIsNarrow();
  const [lightMode, setLightMode] = useState<LightMode>('neutral');
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showReference, setShowReference] = useState(true);

  // A side-by-side comparison needs width; on a phone the render takes the
  // whole viewport and the reference becomes a corner inset instead.
  const splitReference = showReference && !narrow;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(4, 4, 6, 0.86)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: narrow ? '12px' : '24px',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.97, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, y: 12 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={(event) => event.stopPropagation()}
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 320px',
          gridTemplateRows: narrow ? 'minmax(220px, 45%) minmax(0, 1fr)' : 'minmax(0, 1fr)',
          width: 'min(1240px, 100%)',
          height: 'min(760px, 100%)',
          // Without these the flex item's automatic minimum size lets the spec
          // panel's long values widen the modal past the viewport, pushing the
          // close button off-screen on narrow layouts.
          minWidth: 0,
          maxWidth: '100%',
          background: COLORS.surface,
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: '18px',
          overflow: 'hidden',
        }}
      >
        {/* Viewport: reference photo beside the live procedural render. */}
        <div style={{ position: 'relative', display: 'flex', minWidth: 0, minHeight: 0 }}>
          {splitReference && (
            <div
              style={{
                position: 'relative',
                width: '38%',
                borderRight: `1px solid ${COLORS.border}`,
                background: '#000',
              }}
            >
              <img
                src={asset.reference}
                alt={`Source reference photo for ${asset.name}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.92 }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  ...label,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'rgba(8, 8, 10, 0.7)',
                }}
              >
                Source image
              </span>
            </div>
          )}

          <div
            style={{
              position: 'relative',
              flex: 1,
              minWidth: 0,
              background: 'radial-gradient(circle at 50% 40%, #26262f 0%, #0a0a0d 74%)',
            }}
          >
            <AssetCanvas
              asset={asset}
              lightMode={lightMode}
              wireframe={wireframe}
              autoRotate={autoRotate}
              quality="detail"
            />
            <span
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                ...label,
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(8, 8, 10, 0.7)',
              }}
            >
              Procedural render · {lightMode} light
            </span>
            {!narrow && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '12px',
                  ...label,
                  fontSize: '9px',
                }}
              >
                Drag to orbit · scroll to zoom
              </span>
            )}

            {narrow && showReference && (
              <img
                src={asset.reference}
                alt={`Source reference photo for ${asset.name}`}
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  // Explicit height: the global `img { height: 100% }` rule in
                  // styles.css beats aspect-ratio.
                  width: '84px',
                  height: '84px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: `1px solid ${COLORS.borderStrong}`,
                }}
              />
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              zIndex: 2,
              display: 'flex',
              padding: '8px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: COLORS.text,
              background: 'rgba(8, 8, 10, 0.7)',
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Spec readout, straight from the generated sculpt spec. */}
        <aside style={{ overflowY: 'auto', minHeight: 0, background: COLORS.bg }}>
          <div style={{ padding: '20px' }}>
            <p style={label}>{asset.tier} target</p>
            <h2
              style={{
                fontFamily: SANS,
                fontSize: '26px',
                fontWeight: 600,
                color: COLORS.text,
                margin: '6px 0 0',
              }}
            >
              {asset.name}
            </h2>
          </div>

          {/* Pipeline provenance. This is the section that stops the page from
              implying every model was verified against its reference. */}
          <div style={sectionStyle}>
            <p style={{ ...label, marginBottom: '10px' }}>Pipeline status</p>
            <Row
              name="source"
              value={
                asset.provenance === 'img2threejs'
                  ? 'img2threejs (gated)'
                  : 'legacy spec (ungated)'
              }
            />
            <Row name="reviews" value={String(asset.reviewCount)} />
            {asset.reviewCount > 0 ? (
              <>
                <Row name="last action" value={asset.reviewAction} />
                <Row
                  name="ai vision"
                  value={`${asset.aiVisionScore?.toFixed(2)} / 0.70 required`}
                />
              </>
            ) : null}
            <p
              style={{
                fontFamily: SANS,
                fontSize: '12px',
                lineHeight: 1.55,
                color: asset.reviewCount > 0 ? COLORS.textMuted : COLORS.accent,
                margin: '12px 0 0',
              }}
            >
              {asset.reviewCount > 0
                ? asset.reviewSummary
                : 'This model has never been compared against its reference photo. Its component tree was hand-authored from a glance at the image, so the pass label below was never earned.'}
            </p>
          </div>

          <div style={sectionStyle}>
            <p style={{ ...label, marginBottom: '10px' }}>Look-dev pass</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {LIGHT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  title={mode.hint}
                  onClick={() => setLightMode(mode.id)}
                  style={chip(lightMode === mode.id)}
                >
                  {mode.id}
                </button>
              ))}
            </div>
            <p
              style={{
                fontFamily: SANS,
                fontSize: '12px',
                lineHeight: 1.5,
                color: COLORS.textMuted,
                margin: '12px 0 0',
              }}
            >
              {LIGHT_MODES.find((mode) => mode.id === lightMode)?.hint}
            </p>
          </div>

          <div style={sectionStyle}>
            <p style={{ ...label, marginBottom: '10px' }}>View</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button type="button" onClick={() => setWireframe((on) => !on)} style={chip(wireframe)}>
                <Box size={11} style={{ verticalAlign: '-1px', marginRight: '5px' }} />
                wireframe
              </button>
              <button type="button" onClick={() => setAutoRotate((on) => !on)} style={chip(autoRotate)}>
                <RotateCw size={11} style={{ verticalAlign: '-1px', marginRight: '5px' }} />
                turntable
              </button>
              <button
                type="button"
                onClick={() => setShowReference((on) => !on)}
                style={chip(showReference)}
              >
                <ImageIcon size={11} style={{ verticalAlign: '-1px', marginRight: '5px' }} />
                reference
              </button>
            </div>
          </div>

          <div style={sectionStyle}>
            <p style={{ ...label, marginBottom: '6px' }}>Structure</p>
            <Row name="components" value={String(asset.componentCount)} />
            <Row name="materials" value={String(asset.materialCount)} />
            <Row name="primitives" value={countsToText(asset.primitives)} />
            <Row name="roles" value={countsToText(asset.roles)} />
          </div>

          <div style={sectionStyle}>
            <p style={{ ...label, marginBottom: '10px' }}>Material palette</p>
            <div style={{ display: 'grid', gap: '7px' }}>
              {asset.swatches.map((swatch) => (
                <div
                  key={swatch.name}
                  style={{ display: 'flex', alignItems: 'center', gap: '9px' }}
                >
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '4px',
                      flexShrink: 0,
                      background: swatch.color,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  />
                  <span style={{ fontFamily: SANS, fontSize: '12px', color: COLORS.text }}>
                    {swatch.name}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: '10px',
                      color: COLORS.textMuted,
                      marginLeft: 'auto',
                    }}
                  >
                    {swatch.color}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={sectionStyle}>
            <p style={{ ...label, marginBottom: '10px' }}>Sculpt pipeline</p>
            <div style={{ display: 'grid', gap: '5px' }}>
              {asset.passOrder.map((pass) => {
                const done = asset.completedPasses.includes(pass);
                const current = asset.pass === pass;
                return (
                  <div
                    key={pass}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontFamily: MONO,
                      fontSize: '11px',
                      color: current ? COLORS.accent : done ? COLORS.text : COLORS.textMuted,
                    }}
                  >
                    <span
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: current ? COLORS.accent : done ? COLORS.text : COLORS.border,
                      }}
                    />
                    {pass}
                    {current && <span style={{ marginLeft: 'auto' }}>current</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={sectionStyle}>
            <p style={{ ...label, marginBottom: '6px' }}>Budget</p>
            <Row name="texture" value={`${asset.textureSize}px`} />
            <Row name="triangles" value={asset.targetTriangles.toLocaleString()} />
            <Row name="fps target" value={String(asset.fpsTarget)} />
            <Row name="suitability" value={asset.suitability} />
          </div>
        </aside>
      </motion.div>
    </motion.div>
  );
}
