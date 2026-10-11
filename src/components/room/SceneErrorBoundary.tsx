'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches errors thrown anywhere in the 3D tree so a failure surfaces as
 * readable text instead of a silent black canvas.
 */
export default class SceneErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Forwarded to the dev server log via the [browser] channel.
    console.error('[RoomScene error]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '24px',
            color: '#fca5a5',
            background: '#140a0a',
            fontFamily: 'monospace',
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          <strong style={{ color: '#f87171' }}>3D scene failed to render</strong>
          <pre style={{ maxWidth: '640px', whiteSpace: 'pre-wrap', opacity: 0.85 }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
