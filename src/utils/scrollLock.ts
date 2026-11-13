import { useEffect } from 'react';

interface SavedStyle {
  overflow: string;
  height: string;
  position: string;
  width: string;
  top: string;
  paddingRight: string;
}

let lockCount = 0;
let savedScrollY = 0;
let originalBodyStyles: SavedStyle = {
  overflow: '',
  height: '',
  position: '',
  width: '',
  top: '',
  paddingRight: '',
};
let originalHtmlOverflow = '';

/**
 * Locks the document body scroll with exact requested styles:
 * overflow: hidden; height: 100vh; position: fixed; width: 100%;
 */
export const lockBodyScroll = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  lockCount++;
  if (lockCount === 1) {
    savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

    originalBodyStyles = {
      overflow: document.body.style.overflow,
      height: document.body.style.height,
      position: document.body.style.position,
      width: document.body.style.width,
      top: document.body.style.top,
      paddingRight: document.body.style.paddingRight,
    };
    originalHtmlOverflow = document.documentElement.style.overflow;

    // Prevent layout shift by compensating for scrollbar width
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Apply strict body styles as requested
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${savedScrollY}px`;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('modal-open-scroll-locked');
    document.documentElement.classList.add('modal-open-scroll-locked');
  }
};

/**
 * Cleanly unlocks the document body scroll and restores previous configuration
 */
export const unlockBodyScroll = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = originalBodyStyles.overflow;
    document.body.style.height = originalBodyStyles.height;
    document.body.style.position = originalBodyStyles.position;
    document.body.style.width = originalBodyStyles.width;
    document.body.style.top = originalBodyStyles.top;
    document.body.style.paddingRight = originalBodyStyles.paddingRight;

    document.documentElement.style.overflow = originalHtmlOverflow;
    document.body.classList.remove('modal-open-scroll-locked');
    document.documentElement.classList.remove('modal-open-scroll-locked');

    // Restore scroll position
    window.scrollTo(0, savedScrollY);
  }
};

export const isBodyScrollLocked = () => lockCount > 0;

/**
 * React hook to lock/unlock body scroll based on an open state boolean
 */
export const useBodyScrollLock = (isOpen: boolean) => {
  useEffect(() => {
    if (!isOpen) return;

    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);
};

/**
 * Event handlers for backdrop / outer wrapper to isolate scroll
 * and prevent event propagation or background leakage
 */
export const handleBackdropTouchMove = (e: React.TouchEvent<HTMLElement>) => {
  e.stopPropagation();
  // If touching directly on backdrop (outside modal content card), prevent default touch dragging
  if (e.target === e.currentTarget) {
    if (e.cancelable) {
      e.preventDefault();
    }
  }
};

export const handleBackdropWheel = (e: React.WheelEvent<HTMLElement>) => {
  e.stopPropagation();
  // If wheel event is directly on backdrop, prevent default scrolling
  if (e.target === e.currentTarget) {
    if (e.cancelable) {
      e.preventDefault();
    }
  }
};

export const handleModalCardScroll = (
  e: React.UIEvent<HTMLElement> | React.TouchEvent<HTMLElement> | React.WheelEvent<HTMLElement>
) => {
  // Isolate events within the modal dialog box so they don't propagate to backdrop/body
  e.stopPropagation();
};

/**
 * Global Safety Net: Auto-detects any modal overlays mounted in the DOM
 * and ensures background touchmove / wheel events are completely neutralized.
 */
let isGlobalInitialized = false;

export const initGlobalModalScrollLock = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || isGlobalInitialized) return;
  isGlobalInitialized = true;

  // Intercept touchmove and wheel at document level when modal is active
  const handleDocTouchMove = (e: TouchEvent) => {
    if (!isBodyScrollLocked()) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Check if target is inside an explicitly scrollable modal container
    const scrollableContainer = target.closest(
      '.overflow-y-auto, .overflow-y-scroll, [data-scrollable="true"], .receipt-preview-wrapper'
    );

    if (!scrollableContainer) {
      // Direct touch on backdrop or non-scrollable area: prevent default
      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();
    }
  };

  const handleDocWheel = (e: WheelEvent) => {
    if (!isBodyScrollLocked()) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    const scrollableContainer = target.closest(
      '.overflow-y-auto, .overflow-y-scroll, [data-scrollable="true"], .receipt-preview-wrapper'
    );

    if (!scrollableContainer) {
      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();
    }
  };

  document.addEventListener('touchmove', handleDocTouchMove, { passive: false });
  document.addEventListener('wheel', handleDocWheel, { passive: false });
};
