import { useState, useEffect } from 'react';

export type AppRoute =
  | { type: 'main' }
  | { type: 'overlay'; panelId: string };

/**
 * Parses a URL hash string into an AppRoute.
 * Examples:
 *   "" -> { type: 'main' }
 *   "#" -> { type: 'main' }
 *   "#/" -> { type: 'main' }
 *   "#/overlay/abc-123" -> { type: 'overlay', panelId: 'abc-123' }
 *   "#/overlay/abc-123?params" -> { type: 'overlay', panelId: 'abc-123' }
 */
export function parseHash(rawHash: string): AppRoute {
  const hash = (rawHash || '').trim().replace(/^#\/?/, '');
  const match = hash.match(/^overlay\/([^/?#]+)/i);
  if (match) {
    return {
      type: 'overlay',
      panelId: decodeURIComponent(match[1]),
    };
  }
  return { type: 'main' };
}

/**
 * Hook that subscribes to window hashchange events and provides current AppRoute.
 */
export function useHashRoute(initialHash?: string): AppRoute {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseHash(
      initialHash !== undefined
        ? initialHash
        : typeof window !== 'undefined'
          ? window.location.hash
          : ''
    )
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return route;
}
