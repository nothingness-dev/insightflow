import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Wraps routed page content in a subtle fade + slide-up transition that
 * replays whenever the pathname changes. Meant to be placed just inside a
 * layout's <main>, around {children}.
 *
 * Deliberately lightweight (8px movement, ~180ms) so it reads as "smooth"
 * rather than "flashy", and stays out of the way of any animations the
 * page itself already does (e.g. modals, person-card hovers).
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
