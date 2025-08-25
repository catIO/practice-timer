// Sound effects for the timer application

// Sound effect types
export type SoundEffect = 'start' | 'end' | 'reset' | 'skip';

// Sound types
export type SoundType = 'beep' | 'bell' | 'chime' | 'digital' | 'woodpecker';

// Interface for sound effect parameters
export interface SoundEffectParams {
  effect: SoundEffect;
  numberOfBeeps: number;
  volume: number;
  soundType: SoundType;
}

// Volume control (0.0 to 1.0)
let masterVolume = 0.5;

// Audio context
let audioContext: AudioContext | null = null;
let audioContextInitialized = false;
let audioContextResumed = false;
let audioUnlockListenerAdded = false;
let userGestureDetected = false;

// Initialize audio context
const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Enhanced iOS audio unlock with better iPad support
export const initializeAudioForIOS = async (): Promise<boolean> => {
  try {
    console.log('iOS: Enhanced audio unlock attempt for iPad...');
    
    // Create a new audio context specifically for iOS
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Resume if suspended
    if (context.state === 'suspended') {
      console.log('iOS: Audio context suspended, attempting to resume...');
      await context.resume();
    }
    
    // Create and play a simple sound immediately to unlock audio
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    // Set up the sound (very quiet unlock sound)
    oscillator.frequency.setValueAtTime(800, context.currentTime);
    gainNode.gain.setValueAtTime(0.1, context.currentTime); // Very quiet
    gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
    
    // Play the sound
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.1);
    
    // Wait a bit for the sound to play
    await new Promise(resolve => setTimeout(resolve, 150));
    
    console.log('iOS: Enhanced audio unlock successful, context state:', context.state);
    userGestureDetected = true;
    return true;
  } catch (error) {
    console.error('Error in enhanced iOS audio unlock:', error);
    return false;
  }
};

// Initialize audio context after user interaction
export const initializeAudioContext = async () => {
  try {
    console.log('Initializing audio context...');
    const context = getAudioContext();
    console.log('Audio context state:', context.state);
    
    // Check if we're on iOS or iPad
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isIPad = detectIPad();
    
    if (context.state === 'suspended') {
      console.log('Resuming suspended audio context...');
      
      if (isIOS || isIPad) {
        // Use enhanced iOS-specific unlock
        await initializeAudioForIOS();
      } else {
        await context.resume();
      }
      
      console.log('Audio context resumed successfully');
      audioContextResumed = true;
    } else if (context.state === 'running') {
      console.log('Audio context already running');
      audioContextResumed = true;
    }
    
    audioContextInitialized = true;
    console.log('Audio context initialized successfully');
    
    // Add global audio unlock listener for iOS/iPad
    if ((isIOS || isIPad) && !audioUnlockListenerAdded) {
      addGlobalAudioUnlockListener();
      audioUnlockListenerAdded = true;
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing audio context:', error);
    return false;
  }
};

// Enhanced global listener to unlock audio on any user interaction
const addGlobalAudioUnlockListener = () => {
  const unlockAudio = async () => {
    try {
      if (!userGestureDetected) {
        console.log('iOS: User gesture detected, unlocking audio...');
        const context = getAudioContext();
        if (context.state === 'suspended') {
          await initializeAudioForIOS();
        }
        userGestureDetected = true;
      }
    } catch (error) {
      console.error('Error unlocking audio on user interaction:', error);
    }
  };

  // Add listeners for various user interactions (more comprehensive for iPad)
  const events = ['touchstart', 'touchend', 'click', 'keydown', 'scroll', 'mousedown', 'mouseup'];
  events.forEach(event => {
    document.addEventListener(event, unlockAudio, { once: true, passive: true });
  });
  
  console.log('iOS: Added enhanced global audio unlock listeners');
};

// Enhanced iPad detection that works with new iPadOS behavior
const detectIPad = (): boolean => {
  // Check for iPad-specific user agent (older iPads)
  if (/iPad/.test(navigator.userAgent)) {
    return true;
  }
  
  // Check for new iPadOS behavior where iPad reports as Macintosh
  if (/Macintosh/.test(navigator.userAgent)) {
    // Check if it has touch support (iPad has touch, Mac doesn't)
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      // Check screen size (iPad typically has larger screen than iPhone)
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const minDimension = Math.min(screenWidth, screenHeight);
      const maxDimension = Math.max(screenWidth, screenHeight);
      
      // iPad typically has screen dimensions like 768x1024, 834x1194, etc.
      if (minDimension >= 768 && maxDimension >= 1024) {
        return true;
      }
    }
  }
  
  return false;
};

// Generate sine wave
const generateSineWave = (frequency: number, duration: number): Float32Array => {
  const sampleRate = getAudioContext().sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const amplitude = Math.exp(-2 * t); // Exponential decay
    buffer[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
  }
  
  return buffer;
};

// Generate bell sound
const generateBellSound = (duration: number): Float32Array => {
  const sampleRate = getAudioContext().sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(numSamples);
  
  // Bell frequencies (fundamental and harmonics)
  const frequencies = [440, 880, 1320, 1760];
  const amplitudes = [1.0, 0.5, 0.25, 0.125];
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // Combine multiple frequencies with different amplitudes
    for (let j = 0; j < frequencies.length; j++) {
      const amplitude = amplitudes[j] * Math.exp(-3 * t); // Faster decay for bell
      sample += amplitude * Math.sin(2 * Math.PI * frequencies[j] * t);
    }
    
    buffer[i] = sample;
  }
  
  return buffer;
};

// Generate chime sound
const generateChimeSound = (duration: number): Float32Array => {
  const sampleRate = getAudioContext().sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(numSamples);
  
  // Chime frequencies (pentatonic scale)
  const frequencies = [523.25, 587.33, 659.25, 783.99, 880.00];
  const amplitudes = [1.0, 0.8, 0.6, 0.4, 0.2];
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // Combine multiple frequencies with different amplitudes
    for (let j = 0; j < frequencies.length; j++) {
      const amplitude = amplitudes[j] * Math.exp(-2.5 * t); // Medium decay for chime
      sample += amplitude * Math.sin(2 * Math.PI * frequencies[j] * t);
    }
    
    buffer[i] = sample;
  }
  
  return buffer;
};

// Generate digital sound
const generateDigitalSound = (duration: number): Float32Array => {
  const sampleRate = getAudioContext().sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(numSamples);
  
  // Digital sound frequencies
  const frequencies = [880, 1100, 1320];
  const amplitudes = [1.0, 0.7, 0.4];
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // Combine multiple frequencies with different amplitudes
    for (let j = 0; j < frequencies.length; j++) {
      const amplitude = amplitudes[j] * Math.exp(-4 * t); // Very fast decay for digital
      sample += amplitude * Math.sin(2 * Math.PI * frequencies[j] * t);
    }
    
    buffer[i] = sample;
  }
  
  return buffer;
};

// Generate woodpecker sound
const generateWoodpeckerSound = (duration: number): Float32Array => {
  const sampleRate = getAudioContext().sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(numSamples);
  
  // Pileated Woodpecker frequencies (deep, hollow sound)
  const frequencies = [300, 225, 150];  // Slightly higher frequencies
  const amplitudes = [1.0, 0.7, 0.4];   // Same harmonic balance
  
  // Create drumming pattern (Pileated Woodpecker style)
  const tapDuration = 0.03;    // 30ms per tap (shorter, sharper taps)
  const tapInterval = 0.06;    // 60ms between taps (about 16-17 beats per second)
  const numTaps = Math.floor(duration / tapInterval);
  
  for (let tap = 0; tap < numTaps; tap++) {
    const tapStart = Math.floor(tap * tapInterval * sampleRate);
    const tapEnd = Math.floor((tap * tapInterval + tapDuration) * sampleRate);
    
    for (let i = tapStart; i < tapEnd; i++) {
      if (i < numSamples) {
        const t = (i - tapStart) / sampleRate;
        let sample = 0;
        
        // Combine frequencies with sharp attack and longer decay
        for (let j = 0; j < frequencies.length; j++) {
          // Sharp attack, longer decay for hollow sound
          const attack = Math.min(1, t * 100); // Very fast attack
          const decay = Math.exp(-8 * t);      // Slower decay for resonance
          const amplitude = amplitudes[j] * attack * decay;
          sample += amplitude * Math.sin(2 * Math.PI * frequencies[j] * t);
        }
        
        buffer[i] = sample;
      }
    }
  }
  
  return buffer;
};

// Resume audio context (compatibility function)
export const resumeAudioContext = async (): Promise<boolean> => {
  try {
    console.log('Resuming audio context...');
    
    // Check if we're on iOS or iPad
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isIPad = detectIPad();
    
    // Create a new audio context if we don't have one
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('Created new audio context, state:', audioContext.state);
    }
    
    // Resume the audio context
    if (audioContext.state === 'suspended') {
      console.log('Audio context suspended, attempting to resume...');
      
      if (isIOS || isIPad) {
        // Use iOS-specific unlock for better reliability
        await initializeAudioForIOS();
      } else {
        await audioContext.resume();
      }
      
      console.log('Audio context resumed, new state:', audioContext.state);
      audioContextResumed = true;
    } else if (audioContext.state === 'running') {
      console.log('Audio context already running');
      audioContextResumed = true;
    } else {
      console.log('Audio context state:', audioContext.state);
    }
    
    audioContextInitialized = true;
    console.log('Audio context initialization complete');
    return true;
  } catch (error) {
    console.error('Error resuming audio context:', error);
    return false;
  }
};

// iOS-specific sound playback using HTML5 Audio (more reliable)
const playSoundIOS = async (effect: SoundEffect, numberOfBeeps: number = 3, volume: number = 50, soundType: SoundType = 'beep'): Promise<void> => {
  try {
    console.log(`iOS: Playing ${effect} sound with ${numberOfBeeps} beeps at volume ${volume}`);
    
    // Ensure audio is unlocked first
    if (!userGestureDetected) {
      console.log('iOS: No user gesture detected, attempting to unlock audio...');
      await initializeAudioForIOS();
    }
    
    // Convert volume from 0-100 to 0-1 range
    const normalizedVolume = Math.min(1, volume / 100);
    
    // Generate a simple beep sound using data URL
    const sampleRate = 44100;
    const duration = 0.3; // 300ms
    const frequency = soundType === 'bell' ? 440 : 
                     soundType === 'chime' ? 523.25 : 
                     soundType === 'digital' ? 880 : 
                     soundType === 'woodpecker' ? 300 : 800;
    
    // Create a simple sine wave
    const numSamples = Math.floor(sampleRate * duration);
    const audioData = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const amplitude = Math.exp(-3 * t); // Exponential decay
      audioData[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
    }
    
    // Convert to WAV format
    const wavData = createWAV(audioData, sampleRate);
    const blob = new Blob([wavData], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    // Play the sound(s)
    if (effect === 'end') {
      // Play multiple beeps
      for (let i = 0; i < numberOfBeeps; i++) {
        console.log(`iOS: Playing beep ${i + 1} of ${numberOfBeeps}`);
        
        // Create a new audio element for each beep
        const beepAudio = new Audio(url);
        beepAudio.volume = normalizedVolume;
        
        try {
          // Ensure audio is loaded before playing
          await new Promise((resolve, reject) => {
            beepAudio.oncanplaythrough = resolve;
            beepAudio.onerror = reject;
            beepAudio.load();
          });
          
          await beepAudio.play();
          
          // Wait for the beep to finish
          await new Promise((resolve) => {
            beepAudio.onended = resolve;
            // Fallback timeout
            setTimeout(resolve, 500);
          });
          
          // Wait between beeps
          if (i < numberOfBeeps - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`iOS: Error playing beep ${i + 1}:`, error);
          // Continue with next beep even if one fails
        }
      }
      console.log(`iOS: Finished playing all ${numberOfBeeps} beeps`);
    } else {
      // For other sounds, just play once
      const audio = new Audio(url);
      audio.volume = normalizedVolume;
      
      try {
        // Ensure audio is loaded before playing
        await new Promise((resolve, reject) => {
          audio.oncanplaythrough = resolve;
          audio.onerror = reject;
          audio.load();
        });
        
        await audio.play();
        console.log('iOS: Sound played successfully');
      } catch (error) {
        console.error('iOS: Error playing sound:', error);
        throw error;
      }
    }
    
    // Clean up the blob URL
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('iOS: Error in playSoundIOS:', error);
    throw error;
  }
};

// Simple fallback audio for iPad using basic HTML5 Audio
const playSoundFallback = async (effect: SoundEffect, numberOfBeeps: number = 3, volume: number = 50, soundType: SoundType = 'beep'): Promise<void> => {
  try {
    console.log(`Fallback: Playing ${effect} sound with ${numberOfBeeps} beeps at volume ${volume}`);
    
    // Convert volume from 0-100 to 0-1 range
    const normalizedVolume = Math.min(1, volume / 100);
    
    // Create a simple beep using oscillator (if available) or fallback to basic audio
    if (effect === 'end') {
      // Play multiple beeps
      for (let i = 0; i < numberOfBeeps; i++) {
        console.log(`Fallback: Playing beep ${i + 1} of ${numberOfBeeps}`);
        
        try {
          // Try to create a simple beep using Web Audio API
          const context = new (window.AudioContext || (window as any).webkitAudioContext)();
          
          if (context.state === 'suspended') {
            await context.resume();
          }
          
          const oscillator = context.createOscillator();
          const gainNode = context.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(context.destination);
          
          oscillator.frequency.setValueAtTime(800, context.currentTime);
          gainNode.gain.setValueAtTime(normalizedVolume, context.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
          
          oscillator.start(context.currentTime);
          oscillator.stop(context.currentTime + 0.3);
          
          // Wait for the beep to finish
          await new Promise(resolve => setTimeout(resolve, 350));
          
        } catch (error) {
          console.log('Fallback: Web Audio failed, trying basic audio element:', error);
          
          // Fallback to basic audio element
          const audio = new Audio();
          audio.volume = normalizedVolume;
          
          // Create a simple data URL for a beep sound
          const sampleRate = 44100;
          const duration = 0.3;
          const frequency = 800;
          const numSamples = Math.floor(sampleRate * duration);
          const audioData = new Float32Array(numSamples);
          
          for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const amplitude = Math.exp(-3 * t);
            audioData[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
          }
          
          const wavData = createWAV(audioData, sampleRate);
          const blob = new Blob([wavData], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          
          audio.src = url;
          
          try {
            await audio.play();
            await new Promise(resolve => setTimeout(resolve, 350));
            URL.revokeObjectURL(url);
          } catch (audioError) {
            console.error('Fallback: Basic audio also failed:', audioError);
            URL.revokeObjectURL(url);
          }
        }
        
        // Wait between beeps
        if (i < numberOfBeeps - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      console.log(`Fallback: Finished playing all ${numberOfBeeps} beeps`);
    } else {
      // Single beep
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        if (context.state === 'suspended') {
          await context.resume();
        }
        
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.frequency.setValueAtTime(800, context.currentTime);
        gainNode.gain.setValueAtTime(normalizedVolume, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
        
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.3);
        
      } catch (error) {
        console.error('Fallback: Single beep failed:', error);
      }
    }
  } catch (error) {
    console.error('Fallback: Error in fallback audio:', error);
    throw error;
  }
};

// Helper function to create WAV data
const createWAV = (audioData: Float32Array, sampleRate: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(44 + audioData.length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + audioData.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, audioData.length * 2, true);
  
  // Convert float32 to int16
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, sample * 0x7FFF, true);
    offset += 2;
  }
  
  return buffer;
};

// Play a sound effect
export const playSound = async (effect: SoundEffect, numberOfBeeps: number = 3, volume: number = 50, soundType: SoundType = 'beep'): Promise<void> => {
  try {
    console.log(`Attempting to play ${effect} sound with ${numberOfBeeps} beeps at volume ${volume} with sound type ${soundType}...`);
    
    // Check if we're on iOS or iPad
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isIPad = detectIPad();
    
    console.log('Device detection:', {
      userAgent: navigator.userAgent,
      isIOS: isIOS,
      isIPad: isIPad,
      hasTouch: 'ontouchstart' in window,
      maxTouchPoints: navigator.maxTouchPoints,
      screenSize: `${window.screen.width}x${window.screen.height}`
    });
    
    if (isIOS || isIPad) {
      console.log('iOS/iPad detected, using hybrid audio approach...');
      
      // For iPad, try multiple approaches
      if (isIPad) {
        try {
          console.log('iPad detected, trying Web Audio API first...');
          await playSoundWebAudio(effect, numberOfBeeps, volume, soundType);
          return;
        } catch (error) {
          console.log('Web Audio API failed on iPad, trying HTML5 Audio:', error);
          try {
            await playSoundIOS(effect, numberOfBeeps, volume, soundType);
            return;
          } catch (iosError) {
            console.log('HTML5 Audio also failed on iPad, trying fallback:', iosError);
            await playSoundFallback(effect, numberOfBeeps, volume, soundType);
            return;
          }
        }
      } else {
        // For iPhone/iPod, use iOS-specific approach
        try {
          await playSoundIOS(effect, numberOfBeeps, volume, soundType);
          return;
        } catch (error) {
          console.log('iOS audio failed, trying fallback:', error);
          await playSoundFallback(effect, numberOfBeeps, volume, soundType);
          return;
        }
      }
    }
    
    // For non-iOS devices, use Web Audio API
    try {
      await playSoundWebAudio(effect, numberOfBeeps, volume, soundType);
    } catch (error) {
      console.log('Web Audio failed on desktop, trying fallback:', error);
      await playSoundFallback(effect, numberOfBeeps, volume, soundType);
    }
  } catch (error) {
    console.error('Error playing sound:', error);
    throw error;
  }
};

// Web Audio API implementation
const playSoundWebAudio = async (effect: SoundEffect, numberOfBeeps: number = 3, volume: number = 50, soundType: SoundType = 'beep'): Promise<void> => {
  // Convert volume from 0-100 to 0-1 range with increased maximum volume
  // Apply a non-linear curve to increase volume at higher settings
  const normalizedVolume = Math.pow(volume / 100, 0.7) * 1.5;
  
  // Get audio context and ensure it's ready
  const context = getAudioContext();
  console.log('Web Audio: Audio context state before playing:', context.state);
  
  // Enhanced audio context handling for all platforms
  if (context.state === 'suspended') {
    console.log('Web Audio: Audio context suspended, attempting to resume...');
    try {
      await context.resume();
      console.log('Web Audio: Audio context resumed successfully');
    } catch (error) {
      console.error('Web Audio: Failed to resume audio context:', error);
      throw new Error('Audio context could not be resumed');
    }
  }
  
  // Double-check context state
  if (context.state !== 'running') {
    console.warn('Web Audio: Audio context not running, attempting to resume...');
    try {
      await context.resume();
    } catch (error) {
      console.error('Web Audio: Failed to resume audio context on second attempt:', error);
      throw new Error('Audio context could not be resumed');
    }
  }
  
  // For end sound, play multiple beeps
  if (effect === 'end') {
    console.log(`Web Audio: Playing ${numberOfBeeps} beeps...`);
    // Play all beeps in the loop
    for (let i = 0; i < numberOfBeeps; i++) {
      console.log(`Web Audio: Playing beep ${i + 1} of ${numberOfBeeps}`);
      
      // Create oscillator and gain nodes
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      // Set up oscillator based on sound type
      oscillator.type = 'sine';
      
      // Set frequency based on sound type
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
          oscillator.frequency.setValueAtTime(300, context.currentTime); // Higher base frequency
          break;
        case 'beep':
        default:
          oscillator.frequency.setValueAtTime(880, context.currentTime);
          break;
      }
      
      // Set up gain node with the normalized volume
      gainNode.gain.setValueAtTime(normalizedVolume, context.currentTime);
      
      // Set decay based on sound type
      switch (soundType) {
        case 'bell':
          gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 1.5);
          break;
        case 'chime':
          gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 1.3);
          break;
        case 'digital':
          gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.8);
          break;
        case 'woodpecker':
          gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
          break;
        case 'beep':
        default:
          gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 1.2);
          break;
      }
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      // Start and stop oscillator
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 1.5);
      
      // Wait for the full duration of the beep before playing the next one
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    console.log(`Web Audio: Finished playing all ${numberOfBeeps} beeps`);
  } else {
    // For other sounds, just play once
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    // Set up oscillator based on sound type
    oscillator.type = 'sine';
    
    // Set frequency based on sound type
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
        oscillator.frequency.setValueAtTime(300, context.currentTime); // Higher base frequency
        break;
      case 'beep':
      default:
        oscillator.frequency.setValueAtTime(880, context.currentTime);
        break;
    }
    
    // Set up gain node with the normalized volume
    gainNode.gain.setValueAtTime(normalizedVolume, context.currentTime);
    
    // Set decay based on sound type
    switch (soundType) {
      case 'bell':
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 1.5);
        break;
      case 'chime':
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 1.3);
        break;
      case 'digital':
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.8);
        break;
      case 'woodpecker':
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
        break;
      case 'beep':
      default:
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
        break;
    }
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    // Start and stop oscillator
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 1.5);
  }
};

// Set master volume (0.0 to 1.0)
export const setVolume = (volume: number): void => {
  masterVolume = Math.max(0, Math.min(1, volume));
  console.log(`Master volume set to ${masterVolume}`);
};