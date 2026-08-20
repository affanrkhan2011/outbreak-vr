export const isDesktopInputDevice = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const mobileUserAgent = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  return !mobileUserAgent && (!hasCoarsePointer || navigator.maxTouchPoints === 0);
};
