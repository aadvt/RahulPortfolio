'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Maximize2 } from 'lucide-react';
import type { ShowcaseAsset } from '@/data/showcaseAssets';
import AssetCanvas from './AssetCanvas';
import { COLORS, MONO, SANS, label } from './styles';

interface Props {
  asset: ShowcaseAsset;
  index: number;
  paused: boolean;
  onOpen: (asset: ShowcaseAsset) => void;
}

const stageStyle: CSSProperties = {
  position: 'relative',
  aspectRatio: '4 / 3',
  borderRadius: '12px',
  overflow: 'hidden',
  background: 'radial-gradient(circle at 50% 42%, #24242c 0%, #0c0c0f 72%)',
};

const nameStyle: CSSProperties = {
  fontFamily: SANS,
  fontSize: '19px',
  fontWeight: 600,
  color: COLORS.text,
  letterSpacing: '-0.01em',
};

const statStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: '11px',
  color: COLORS.textMuted,
};

/** Gap between card builds. Generating a model blocks the main thread, so the
 *  four of them are spread out rather than fired on the same tick. */
const BUILD_STAGGER_MS = 450;

export default function AssetCard({ asset, index, paused, onOpen }: Props) {
  const [hovered, setHovered] = useState(false);
  const [live, setLive] = useState(false);
  const reviewed = asset.reviewCount > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setLive(true), index * BUILD_STAGGER_MS);
    return () => window.clearTimeout(timer);
  }, [index]);

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(asset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      aria-label={`Inspect the ${asset.name} model`}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '14px',
        borderRadius: '16px',
        cursor: 'pointer',
        font: 'inherit',
        background: hovered ? COLORS.surfaceRaised : COLORS.surface,
        border: `1px solid ${hovered ? COLORS.borderStrong : COLORS.border}`,
        transition: 'background 200ms ease, border-color 200ms ease, transform 200ms ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
      }}
    >
      <div style={stageStyle}>
        {live ? (
          <AssetCanvas
            asset={asset}
            lightMode="neutral"
            autoRotate={!paused}
            quality="card"
            frameloop={paused ? 'never' : 'always'}
          />
        ) : (
          // The source photo holds the frame until the generator has run.
          <img
            src={asset.reference}
            alt={`Reference photo for ${asset.name}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.35,
              filter: 'grayscale(1)',
            }}
          />
        )}

        <span
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            ...label,
            padding: '4px 8px',
            borderRadius: '6px',
            background: 'rgba(8, 8, 10, 0.66)',
            backdropFilter: 'blur(6px)',
          }}
        >
          {asset.tier}
        </span>

        <span
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            display: 'flex',
            alignItems: 'center',
            padding: '6px',
            borderRadius: '6px',
            color: COLORS.text,
            background: 'rgba(8, 8, 10, 0.66)',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 200ms ease',
          }}
        >
          <Maximize2 size={13} />
        </span>

        {/* Provenance, bottom-left. A model that has never been scored against
            its reference must not look the same as one that has. */}
        <span
          title={
            reviewed
              ? `${asset.reviewCount} vision-scored review(s); latest action ${asset.reviewAction}`
              : 'Never compared against its reference photo'
          }
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            ...label,
            padding: '4px 8px',
            borderRadius: '6px',
            color: reviewed ? COLORS.accent : COLORS.textMuted,
            background: 'rgba(8, 8, 10, 0.72)',
            backdropFilter: 'blur(6px)',
          }}
        >
          {reviewed
            ? `${asset.pass} · vision ${asset.aiVisionScore?.toFixed(2)}`
            : 'unreviewed'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '12px',
          marginTop: '14px',
        }}
      >
        <span style={nameStyle}>{asset.name}</span>
        <span style={statStyle}>
          {asset.componentCount} parts · {asset.materialCount} mats
        </span>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
        {asset.swatches.map((swatch) => (
          <span
            key={swatch.name}
            title={`${swatch.name} ${swatch.color}`}
            style={{
              width: '100%',
              height: '4px',
              borderRadius: '2px',
              background: swatch.color,
            }}
          />
        ))}
      </div>
    </motion.button>
  );
}
