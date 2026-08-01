import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
  type Transition,
} from 'framer-motion';
import { useLocation } from 'react-router-dom';

export const D = {
  instant: 0,
  fast: 120,
  normal: 180,
  slow: 280,
} as const;

export const E = {
  standard: [0.4, 0, 0.2, 1] as const,
  enter: [0, 0, 0.2, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  spring: { type: 'spring' as const, stiffness: 420, damping: 32 },
} as const;

export const T = {
  page: { duration: D.normal / 1000, ease: E.standard } as Transition,
  spring: E.spring as Transition,
  fast: { duration: D.fast / 1000, ease: E.standard } as Transition,
  instant: { duration: 0 } as Transition,
} as const;

export function useMotionDisabled(): boolean {
  const reduced = useReducedMotion();
  return reduced ?? false;
}

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const rtlFadeUp: Variants = {
  hidden: (dir: 'ltr' | 'rtl' = 'rtl') => ({
    opacity: 0,
    x: dir === 'rtl' ? 10 : -10,
  }),
  visible: { opacity: 1, x: 0 },
  exit: (dir: 'ltr' | 'rtl' = 'rtl') => ({
    opacity: 0,
    x: dir === 'rtl' ? -6 : 6,
  }),
};

export const drawerRight: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0 },
  exit: { x: '100%' },
};

export const popover: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.92, y: -4 },
};

export const backdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const stagger = (staggerChildren = 0.04): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren } },
  exit: {},
});

export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4, transition: { duration: D.fast / 1000 } },
};

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  initialFocusRef?: React.RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const el = containerRef.current;
    const getFocusable = () => Array.from(
      el.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(item => {
      if (item.getAttribute('aria-hidden') === 'true') return false;
      const styles = window.getComputedStyle(item);
      return styles.visibility !== 'hidden' && styles.display !== 'none' && item.getClientRects().length > 0;
    });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (e.shiftKey && (current === first || !el.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !el.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    }

    el.addEventListener('keydown', handleKeyDown);
    const preferredTarget = initialFocusRef?.current;
    if (preferredTarget && el.contains(preferredTarget)) {
      preferredTarget.focus();
    } else if (!el.contains(document.activeElement)) {
      const first = getFocusable()[0];
      (first || el).focus();
    }

    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [active, containerRef, initialFocusRef]);
}

export function useKeyboardNav(
  isOpen: boolean,
  onClose: () => void,
  menuRef: React.RefObject<HTMLElement | null>,
  itemsRef: React.RefObject<(HTMLElement | null)[]>,
) {
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1);
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      const items = itemsRef.current?.filter(Boolean) ?? [];
      if (items.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % items.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + items.length) % items.length);
          break;
        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setActiveIndex(items.length - 1);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          onClose();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, itemsRef]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const items = itemsRef.current?.filter(Boolean) ?? [];
    items[activeIndex]?.focus();
  }, [activeIndex, itemsRef]);

  return { activeIndex, setActiveIndex };
}
