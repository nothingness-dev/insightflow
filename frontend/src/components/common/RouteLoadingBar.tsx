import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Thin progress bar fixed to the top of the viewport, shown briefly whenever
 * the route changes (tab switch in the sidebar, programmatic navigate, etc).
 *
 * It does not hook into Suspense directly — lazy-loaded route chunks are
 * usually cached after the first visit, so a real "wait for the chunk"
 * progress bar would mostly show 0ms bars. Instead this gives consistent,
 * pleasant feedback on every navigation: jumps to ~30% immediately, eases
 * up to ~85% while "in flight", then snaps to 100% and fades out shortly
 * after the new page has had a chance to paint.
 */
export default function RouteLoadingBar() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the bar on the very first paint of the app — there is nothing to
    // show a transition between yet.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    timers.current.forEach(clearTimeout);
    timers.current = [];

    setVisible(true);
    setProgress(15);

    timers.current.push(setTimeout(() => setProgress(45), 60));
    timers.current.push(setTimeout(() => setProgress(70), 180));
    timers.current.push(setTimeout(() => setProgress(88), 360));
    timers.current.push(setTimeout(() => {
      setProgress(100);
      timers.current.push(setTimeout(() => setVisible(false), 220));
      timers.current.push(setTimeout(() => setProgress(0), 440));
    }, 480));

    return () => {
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, navigationType]);

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 inset-x-0 z-[100] pointer-events-none"
      style={{ height: 3 }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: 'var(--c-600)',
          boxShadow: '0 0 8px var(--c-500)',
          opacity: visible ? 1 : 0,
          transition: progress === 0
            ? 'none'
            : 'width 0.25s ease-out, opacity 0.2s ease-out',
        }}
      />
    </div>
  );
}
