// Sound effects for the timer application
export type SoundEffect = 'start' | 'end' | 'reset' | 'skip' | 'segment-end';
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
let silentSource: AudioBufferSourceNode | null = null;
let silentGain: GainNode | null = null;
let activeSoundsCount = 0;
let keepAlivePendingStop = false;

export const detectIPad = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (/iPad/.test(navigator.userAgent)) return true;
  if (/Macintosh/.test(navigator.userAgent) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
    return true;
  }
  return false;
};

export const detectIOS = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || detectIPad();
};

export const _resetAudioForTesting = (): void => {
  audioContext = null;
  silentSource = null;
  silentGain = null;
  activeSoundsCount = 0;
  lastPlaySoundTime = 0;
  keepAlivePendingStop = false;
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

// Synchronously unlock AudioContext within user gesture for iOS/iPadOS Safari & desktop
export const unlockAudioContext = (): boolean => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Play 1 sample of silence synchronously within the gesture
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

export const initializeAudioForIOS = async (): Promise<boolean> => {
  return unlockAudioContext();
};

export const initializeAudioContext = async (): Promise<boolean> => {
  return unlockAudioContext();
};

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

// Suspend AudioContext to allow iOS display auto-lock when idle and not actively playing audio
export const suspendAudioContext = async (): Promise<void> => {
  try {
    if (activeSoundsCount > 0 || silentSource) return;
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running') {
      await ctx.suspend();
    }
  } catch (e) {
    console.warn('suspendAudioContext notice:', e);
  }
};

const teardownSilenceKeepAlive = (): void => {
  if (silentSource) {
    try {
      silentSource.stop();
      silentSource.disconnect();
    } catch {}
    silentSource = null;
  }
  if (silentGain) {
    try {
      silentGain.disconnect();
    } catch {}
    silentGain = null;
  }
};

// Keep Web Audio engine alive on iOS Safari during active timer countdown
export const startSilenceKeepAlive = (): void => {
  try {
    const ctx = getAudioContext();
    if (!ctx || silentSource) return;

    keepAlivePendingStop = false;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const buffer = ctx.createBuffer(1, ctx.sampleRate || 44100, ctx.sampleRate || 44100);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.00001, ctx.currentTime);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);

    silentSource = source;
    silentGain = gain;
  } catch (e) {
    console.warn('startSilenceKeepAlive notice:', e);
  }
};

// Stop silent keepalive loop when countdown ceases without interrupting active sound playback.
// If sounds are currently playing/decaying, teardown is deferred until all beeps complete.
export const stopSilenceKeepAlive = (): void => {
  try {
    if (activeSoundsCount > 0) {
      keepAlivePendingStop = true;
      return;
    }
    keepAlivePendingStop = false;
    teardownSilenceKeepAlive();
  } catch (e) {
    console.warn('stopSilenceKeepAlive notice:', e);
  }
};

// Register automatic unlock on first user interaction across all devices
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const unlockEvents = ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown', 'click'];
  const handleInteraction = () => {
    unlockAudioContext();
    unlockEvents.forEach((evt) => {
      document.removeEventListener(evt, handleInteraction, true);
    });
  };
  unlockEvents.forEach((evt) => {
    document.addEventListener(evt, handleInteraction, { capture: true, passive: true, once: true });
  });
}

const getSoundParams = (
  soundType: SoundType,
  effect: SoundEffect
): { freq: number; decay: number; interval: number } => {
  if (effect === 'start') {
    return { freq: 660, decay: 0.4, interval: 0.5 };
  }
  if (effect === 'reset') {
    return { freq: 440, decay: 0.4, interval: 0.5 };
  }
  if (effect === 'skip') {
    return { freq: 550, decay: 0.4, interval: 0.5 };
  }
  if (effect === 'segment-end') {
    return { freq: 523.25, decay: 2.8, interval: 2.8 };
  }

  switch (soundType) {
    case 'bell':
      return { freq: 440, decay: 1.5, interval: 1.2 };
    case 'chime':
      return { freq: 523.25, decay: 1.3, interval: 1.2 };
    case 'digital':
      return { freq: 880, decay: 0.8, interval: 1.0 };
    case 'woodpecker':
      return { freq: 300, decay: 0.2, interval: 0.25 };
    case 'beep':
    default:
      return { freq: 880, decay: 1.2, interval: 1.2 };
  }
};

// Web Audio oscillator sound playback with hardware timeline scheduling.
// Pre-schedules all beeps directly on AudioContext timeline so background throttling
// or suspended JS setTimeout cannot cut off or delay subsequent beeps.
const playSoundWebAudio = async (
  effect: SoundEffect,
  numberOfBeeps: number = 3,
  volume: number = 50,
  soundType: SoundType = 'beep'
): Promise<void> => {
  const normalizedVolume = getNormalizedVolume(volume);
  const context = getAudioContext();
  if (!context) return;

  activeSoundsCount++;
  try {
    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch (e) {
        console.warn('[soundEffects] resume failed:', e);
      }
    }

    const { freq, decay, interval } = getSoundParams(soundType, effect);
    const count = effect === 'end' ? Math.max(1, numberOfBeeps) : 1;
    const startGain = Math.max(0.0001, normalizedVolume);
    const minGain = 0.0001;

    const baseStartTime = Math.max(context.currentTime, 0) + 0.02;

    if (effect === 'segment-end') {
      // Option A: Resonant Singing Bowl / Bell with rich acoustic overtones and 2.8s decay
      const segmentDecay = 2.8;
      const beepStartTime = baseStartTime;
      const sustainEnd = beepStartTime + 0.12; // 120ms initial peak sustain hold
      const beepDecayEnd = beepStartTime + segmentDecay;
      const beepStopTime = beepDecayEnd + 0.05;

      let baseFreq = 523.25; // C5 default
      if (soundType === 'bell') baseFreq = 440; // A4
      else if (soundType === 'chime') baseFreq = 587.33; // D5
      else if (soundType === 'digital') baseFreq = 880;
      else if (soundType === 'woodpecker') baseFreq = 440;
      else baseFreq = 659.25; // E5

      // Harmonic ratios & relative balance (fundamental, fifth, octave, bell shimmer overtone)
      const partials = [
        { ratio: 1.0, gainMult: 0.65 },
        { ratio: 1.5, gainMult: 0.25 },
        { ratio: 2.0, gainMult: 0.15 },
        { ratio: 2.76, gainMult: 0.10 },
      ];

      for (const partial of partials) {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(baseFreq * partial.ratio, beepStartTime);

        gainNode.gain.setValueAtTime(startGain * partial.gainMult, beepStartTime);
        gainNode.gain.setValueAtTime(startGain * partial.gainMult, sustainEnd);
        gainNode.gain.exponentialRampToValueAtTime(minGain, beepDecayEnd);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(beepStartTime);
        oscillator.stop(beepStopTime);
      }

      const totalDurationSeconds = segmentDecay + 0.1;
      await new Promise((resolve) => setTimeout(resolve, Math.ceil(totalDurationSeconds * 1000)));
    } else {
      for (let i = 0; i < count; i++) {
        const beepStartTime = baseStartTime + i * interval;
        const beepDecayEnd = beepStartTime + decay;
        const beepStopTime = beepDecayEnd + 0.05;

        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, beepStartTime);

        gainNode.gain.setValueAtTime(startGain, beepStartTime);
        gainNode.gain.exponentialRampToValueAtTime(minGain, beepDecayEnd);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(beepStartTime);
        oscillator.stop(beepStopTime);
      }

      // Wait until all scheduled beeps and decays have completed before resolving
      const totalDurationSeconds = (count - 1) * interval + decay + 0.1;
      await new Promise((resolve) => setTimeout(resolve, Math.ceil(totalDurationSeconds * 1000)));
    }
  } finally {
    activeSoundsCount--;
    if (activeSoundsCount <= 0) {
      activeSoundsCount = 0;
      if (keepAlivePendingStop) {
        keepAlivePendingStop = false;
        teardownSilenceKeepAlive();
      }
      // Suspend AudioContext after all sounds finish decaying so iOS / iPadOS does not
      // treat the idle AudioContext as an active media session preventing screen sleep.
      if (!silentSource && context && context.state === 'running') {
        context.suspend().catch(() => {});
      }
    }
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