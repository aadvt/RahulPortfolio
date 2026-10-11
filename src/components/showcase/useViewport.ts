'use client';

import { useEffect, useState } from 'react';

/** Below this the detail viewer stacks instead of running canvas beside panel. */
const NARROW_BREAKPOINT = 900;

/**
 * The showcase styles inline rather than through a stylesheet, so breakpoints
 * are read in JS. Starts wide and corrects on mount — the components it feeds
 * are client-only, so there is no SSR mismatch to worry about.
 */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT}px)`);
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return narrow;
}
