import { useState, useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

export type AppRoute =
  | { type: 'main' }
  | { type: 'overlay'; panelId: string };

/**
 * Resolves current route based on Tauri window label, URL query/path, or hash.
 */
export function resolveCurrentRoute(rawHash?: string): AppRoute {
  // 1. In Tauri, check window label first (e.g. "overlay_abc-123")
  try {
    const label = getCurrentWebviewWindow().label;
    if (label && label.startsWith('overlay_')) {
      const panelId = label.replace(/^overlay_/, '');
      if (panelId) {
        return { type: 'overlay', panelId };
      }
    }
  } catch {
    // Outside Tauri
  }

  // 2. Check query params (?overlay=xxx or ?id=xxx)
  if (typeof window !== 'undefined' && window.location?.search) {
    const params = new URLSearchParams(window.location.search);
    const searchId = params.get('overlay') || params.get('id');
    if (searchId) {
      return { type: 'overlay', panelId: decodeURIComponent(searchId) };
    }
  }

  // 3. Check hash string
  const hash =
    rawHash !== undefined
      ? rawHash
      : typeof window !== 'undefined'
        ? window.location.hash
        : '';
  return parseHash(hash);
}

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
  const [route, setRoute] = useState<AppRoute>(() => resolveCurrentRoute(initialHash));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Defensive re-check shortly after mount: on some platforms the Tauri IPC
    // bridge (window.__TAURI_INTERNALS__) may not be fully initialized at the
    // very first synchronous script execution, causing getCurrentWebviewWindow()
    // to throw or return stale data during the initial render. Re-resolving
    // once after mount corrects the route if the first attempt was wrong.
    const recheckTimer = setTimeout(() => {
      setRoute((prev) => {
        const resolved = resolveCurrentRoute(window.location.hash);
        if (
          resolved.type !== prev.type ||
          (resolved.type === 'overlay' &&
            prev.type === 'overlay' &&
            resolved.panelId !== prev.panelId)
        ) {
          return resolved;
        }
        return prev;
      });
    }, 50);

    const handleHashChange = () => {
      setRoute(resolveCurrentRoute(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      clearTimeout(recheckTimer);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return route;
}
