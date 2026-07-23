import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { D, E, rtlFadeUp, useMotionDisabled, T } from '../../motion';

export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduced = useMotionDisabled();
  const dir = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';

  const variants = reduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : rtlFadeUp;

  const transition = reduced ? T.instant : { duration: D.normal / 1000, ease: E.standard };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        custom={dir}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
