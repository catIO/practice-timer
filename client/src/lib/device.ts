// Device detection utility with iPadOS desktop-mode support

export const detectIPad = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (/iPad/.test(navigator.userAgent)) return true;
  // iPadOS 13+ reports userAgent as Macintosh with multi-touch points
  if (/Macintosh/.test(navigator.userAgent) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
    return true;
  }
  return false;
};

export const detectIOS = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || detectIPad();
};

export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
};
