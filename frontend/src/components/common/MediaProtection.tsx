import { useEffect } from 'react';

// Canvas is intentionally excluded so QR-code saving remains available.
const PROTECTED_MEDIA_SELECTOR = 'img, picture, video';

function isProtectedMedia(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(PROTECTED_MEDIA_SELECTOR));
}

/**
 * Blocks the browser's built-in image saving entry points for all current and
 * future media rendered by the app. This is a deterrent, not DRM: operating
 * system screenshots and developer tools cannot be disabled by a website.
 */
export default function MediaProtection() {
  useEffect(() => {
    const preventMediaAction = (event: Event) => {
      if (isProtectedMedia(event.target)) event.preventDefault();
    };

    const preventSaveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
      }
    };

    document.addEventListener('contextmenu', preventMediaAction, true);
    document.addEventListener('dragstart', preventMediaAction, true);
    document.addEventListener('keydown', preventSaveShortcut, true);

    return () => {
      document.removeEventListener('contextmenu', preventMediaAction, true);
      document.removeEventListener('dragstart', preventMediaAction, true);
      document.removeEventListener('keydown', preventSaveShortcut, true);
    };
  }, []);

  return null;
}
