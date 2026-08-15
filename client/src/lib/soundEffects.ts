// Sound effects for the timer application
export type SoundEffect = 'start' | 'end' | 'reset' | 'skip';
export type SoundType = 'beep' | 'bell' | 'chime' | 'digital' | 'woodpecker';

export interface SoundEffectParams {
  effect: SoundEffect;
  numberOfBeeps: number;
  volume: number;
  soundType: SoundType;
}

let masterVolume = 0.5;
let audioContext: AudioContext | null = null;
let lastPlaySoundTime = 0;

export const detectIPad = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (/iPad/.test(navigator.userAgent)) return true;
  if (/Macintosh/.test(navigator.userAgent) && (navigator.maxTouchPoints > 1 || 'ontouchstart' in window)) {
    return true;
  }
  return false;
};

export const detectIOS = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || detectIPad();
};

export const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  }
  return audioContext;
};

// Helper to normalize volume from 0-100 range to 0.0-1.0 range with natural quadratic response
export const getNormalizedVolume = (volume: number): number => {
  const volumeInRange = volume <= 1 && volume > 0 ? volume * 100 : volume;
  const linearVolume = Math.min(100, Math.max(0, volumeInRange)) / 100;
  return Math.pow(linearVolume, 2);
};

// Unlock AudioContext permanently on user gesture for iOS/iPadOS Safari and all modern browsers
export const unlockAudioContext = async (): Promise<boolean> => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Play 1 sample of silence to prime and unlock the Web Audio destination on iOS/Safari
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    return true;
  } catch (error) {
    console.warn('AudioContext unlock notice:', error);
    return false;
  }
};

export const initializeAudioForIOS = unlockAudioContext;
export const initializeAudioContext = unlockAudioContext;

export const resumeAudioContext = async (): Promise<boolean> => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx.state === 'running';
  } catch (error) {
    console.warn('Error resuming AudioContext:', error);
    return false;
  }
};

// Register automatic unlock on first user interaction across all devices
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const unlockEvents = ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown', 'click'];
  const handleInteraction = () => {
    unlockAudioContext().catch(() => {});
    unlockEvents.forEach((evt) => {
      document.removeEventListener(evt, handleInteraction, true);
    });
  };
  unlockEvents.forEach((evt) => {
    document.addEventListener(evt, handleInteraction, { capture: true, passive: true, once: true });
  });
}

// Web Audio oscillator sound playback with smooth decay
const playSoundWebAudio = async (
  effect: SoundEffect,
  numberOfBeeps: number = 3,
  volume: number = 50,
  soundType: SoundType = 'beep'
): Promise<void> => {
  const normalizedVolume = getNormalizedVolume(volume);
  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {}
  }

  if (effect === 'end') {
    const count = Math.max(1, numberOfBeeps);
    for (let i = 0; i < count; i++) {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = 'sine';

      switch (soundType) {
        case 'bell':
          oscillator.frequency.setValueAtTime(440, context.currentTime);
          break;
        case 'chime':
          oscillator.frequency.setValueAtTime(523.25, context.currentTime);
          break;
        case 'digital':
          oscillator.frequency.setValueAtTime(880, context.currentTime);
          break;
        case 'woodpecker':
          oscillator.frequency.setValueAtTime(300, context.currentTime);
          break;
        case 'beep':
        default:
          oscillator.frequency.setValueAtTime(880, context.currentTime);
          break;
      }

      gainNode.gain.setValueAtTime(normalizedVolume, context.currentTime);

      let decayDuration = 1.2;
      switch (soundType) {
        case 'bell':
          decayDuration = 1.5;
          break;
        case 'chime':
          decayDuration = 1.3;
          break;
        case 'digital':
          decayDuration = 0.8;
          break;
        case 'woodpecker':
          decayDuration = 0.2;
          break;
        case 'beep':
        default:
          decayDuration = 1.2;
          break;
      }

      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + decayDuration);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + decayDuration + 0.1);

      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  } else {
    // Single sound for start, reset, skip, or preview
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'sine';

    let freq = 880;
    let decay = 0.5;
    if (effect === 'start') {
      freq = 660;
      decay = 0.4;
    } else if (effect === 'reset') {
      freq = 440;
      decay = 0.4;
    } else if (effect === 'skip') {
      freq = 550;
      decay = 0.4;
    } else {
      switch (soundType) {
        case 'bell':
          freq = 440;
          decay = 1.5;
          break;
        case 'chime':
          freq = 523.25;
          decay = 1.3;
          break;
        case 'digital':
          freq = 880;
          decay = 0.8;
          break;
        case 'woodpecker':
          freq = 300;
          decay = 0.2;
          break;
        case 'beep':
        default:
          freq = 880;
          decay = 0.5;
          break;
      }
    }

    oscillator.frequency.setValueAtTime(freq, context.currentTime);
    gainNode.gain.setValueAtTime(normalizedVolume, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + decay);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + decay + 0.1);
  }
};

// Main entry point for sound playback
export const playSound = async (
  effect: SoundEffect,
  numberOfBeeps: number = 3,
  volume: number = 50,
  soundType: SoundType = 'beep'
): Promise<void> => {
  try {
    const now = Date.now();
    if (now - lastPlaySoundTime < 250) {
      return;
    }
    lastPlaySoundTime = now;

    // Validate soundType
    const validSoundType: SoundType =
      soundType === 'bell' ||
      soundType === 'chime' ||
      soundType === 'digital' ||
      soundType === 'woodpecker' ||
      soundType === 'beep'
        ? soundType
        : 'beep';

    await playSoundWebAudio(effect, numberOfBeeps, volume, validSoundType);
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

export const setVolume = (volume: number): void => {
  masterVolume = Math.max(0, Math.min(1, volume));
};