'use client';

import dynamic from 'next/dynamic';
import type { CSSProperties } from 'react';
import { useRoomStore } from '@/store/useRoomStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import SceneErrorBoundary from './SceneErrorBoundary';

const RoomCanvas = dynamic(() => import('./RoomCanvas'), { ssr: false });

const wrapperStyle: CSSProperties = {
  width: '100%',
  height: '100vh',
  backgroundColor: '#0a0a0a',
  position: 'relative',
  overflow: 'hidden',
};

const backButtonStyle: CSSProperties = {
  position: 'absolute',
  top: '24px',
  left: '24px',
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 16px',
  borderRadius: '8px',
  backgroundColor: 'rgba(23, 23, 23, 0.8)',
  color: '#ffffff',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  fontFamily: 'inherit',
  backdropFilter: 'blur(8px)',
};

const overlayBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function modalCardStyle(accent: string): CSSProperties {
  return {
    maxWidth: '640px',
    width: '100%',
    margin: '0 16px',
    backgroundColor: '#171717',
    borderRadius: '16px',
    padding: '32px',
    border: `1px solid ${accent}4d`,
  };
}

const modalTitleStyle: CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#ffffff',
  marginBottom: '16px',
};

const modalTextStyle: CSSProperties = {
  color: '#d4d4d4',
  marginBottom: '24px',
  lineHeight: 1.6,
};

function modalPreviewStyle(accent: string): CSSProperties {
  return {
    width: '100%',
    aspectRatio: '16 / 9',
    backgroundColor: '#262626',
    borderRadius: '10px',
    border: `1px solid ${accent}80`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#737373',
  };
}

export default function RoomWrapper() {
  const { activeTarget, resetView } = useRoomStore();

  return (
    <div style={wrapperStyle}>
      <SceneErrorBoundary>
        <RoomCanvas />
      </SceneErrorBoundary>

      {/* Back Button */}
      <AnimatePresence>
        {activeTarget !== 'NONE' && (
          <motion.button
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={resetView}
            style={backButtonStyle}
          >
            <ChevronLeft size={16} />
            Back to Room
          </motion.button>
        )}
      </AnimatePresence>

      {/* PC Target Overlay */}
      <AnimatePresence>
        {activeTarget === 'PC' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={overlayBackdropStyle}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={modalCardStyle('#a855f7')}
            >
              <h2 style={modalTitleStyle}>Video Editing Portfolio</h2>
              <p style={modalTextStyle}>
                Professional video editing workspace. This is where creative projects come to life with color grading, effects, and timeline magic.
              </p>
              <div style={modalPreviewStyle('#a855f7')}>Portfolio Content</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shoes Target Overlay */}
      <AnimatePresence>
        {activeTarget === 'SHOES' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={overlayBackdropStyle}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={modalCardStyle('#3b82f6')}
            >
              <h2 style={modalTitleStyle}>Dance Showcase</h2>
              <p style={modalTextStyle}>
                Where movement meets artistry. These are the kicks that've walked through countless performances and creative collaborations.
              </p>
              <div style={modalPreviewStyle('#3b82f6')}>Dance Portfolio</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
