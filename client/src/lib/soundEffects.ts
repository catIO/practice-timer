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

// Initialize audio context
const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Initialize audio context after user interaction
export const initializeAudioContext = async () => {
  try {
    console.log('Initializing audio context...');
    const context = getAudioContext();
    console.log('Audio context state:', context.state);
    
    // Check if we're on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (context.state === 'suspended') {
      console.log('Resuming suspended audio context...');
      
      if (isIOS) {
        // Use iOS-specific unlock
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
    
    // Add global audio unlock listener for iOS
    if (isIOS && !audioUnlockListenerAdded) {
      addGlobalAudioUnlockListener();
      audioUnlockListenerAdded = true;
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing audio context:', error);
    return false;
  }
};

// Add global listener to unlock audio on any user interaction
const addGlobalAudioUnlockListener = () => {
  const unlockAudio = async () => {
    try {
      const context = getAudioContext();
      if (context.state === 'suspended') {
        console.log('iOS: Unlocking audio on user interaction...');
        await initializeAudioForIOS();
      }
    } catch (error) {
      console.error('Error unlocking audio on user interaction:', error);
    }
  };

  // Add listeners for various user interactions
  const events = ['touchstart', 'touchend', 'click', 'keydown', 'scroll'];
  events.forEach(event => {
    document.addEventListener(event, unlockAudio, { once: true, passive: true });
  });
  
  console.log('iOS: Added global audio unlock listeners');
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
    // Create a new audio context if we don't have one
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume the audio context
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
      audioContextResumed = true;
    }
    
    // For iOS, we need to ensure the context is running
    if (audioContext.state === 'running') {
      audioContextResumed = true;
    }
    
    audioContextInitialized = true;
    return true;
  } catch (error) {
    console.error('Error resuming audio context:', error);
    return false;
  }
};

// iOS-compatible audio initialization using HTML5 Audio
export const initializeAudioForIOS = async (): Promise<boolean> => {
  try {
    console.log('iOS: Using HTML5 Audio for iOS compatibility...');
    
    // Create a silent HTML5 audio element to unlock audio
    const silentAudio = new Audio();
    silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    silentAudio.volume = 0;
    
    // Try to play the silent audio
    try {
      await silentAudio.play();
      console.log('iOS: HTML5 Audio unlock successful');
      return true;
    } catch (playError) {
      console.log('iOS: HTML5 Audio unlock failed, trying Web Audio API...');
      
      // Fallback to Web Audio API
      const context = getAudioContext();
      
      if (context.state === 'suspended') {
        // Create a silent oscillator to unlock audio
        const silentOscillator = context.createOscillator();
        const silentGain = context.createGain();
        
        silentOscillator.connect(silentGain);
        silentGain.connect(context.destination);
        
        // Set volume to 0 (silent)
        silentGain.gain.setValueAtTime(0, context.currentTime);
        
        // Start and immediately stop the silent oscillator
        silentOscillator.start(context.currentTime);
        silentOscillator.stop(context.currentTime + 0.1);
        
        // Resume the context
        await context.resume();
        
        // Wait a bit for the unlock to take effect
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('iOS: Web Audio API state after unlock:', context.state);
      return context.state === 'running';
    }
  } catch (error) {
    console.error('Error initializing audio for iOS:', error);
    return false;
  }
};

// Play a sound effect
export const playSound = async (effect: SoundEffect, numberOfBeeps: number = 3, volume: number = 50, soundType: SoundType = 'beep'): Promise<void> => {
  try {
    console.log(`Attempting to play ${effect} sound with ${numberOfBeeps} beeps at volume ${volume} with sound type ${soundType}...`);
    
    // Convert volume from 0-100 to 0-1 range with increased maximum volume
    // Apply a non-linear curve to increase volume at higher settings
    const normalizedVolume = Math.pow(volume / 100, 0.7) * 1.5;
    
    // Get audio context and ensure it's ready for iOS
    const context = getAudioContext();
    console.log('Audio context state before playing:', context.state);
    
    // For iOS, ensure audio context is properly initialized
    if (context.state === 'suspended') {
      console.log('Audio context suspended, attempting to resume for iOS...');
      await initializeAudioForIOS();
    }
    
    // Double-check context state
    if (context.state !== 'running') {
      console.warn('Audio context not running, attempting to resume...');
      await context.resume();
    }
    
    // For end sound, play multiple beeps
    if (effect === 'end') {
      console.log(`Playing ${numberOfBeeps} beeps...`);
      // Play all beeps in the loop
      for (let i = 0; i < numberOfBeeps; i++) {
        console.log(`Playing beep ${i + 1} of ${numberOfBeeps}`);
        
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
      console.log(`Finished playing all ${numberOfBeeps} beeps`);
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
  } catch (error) {
    console.error('Error playing sound:', error);
    throw error;
  }
};

// Set master volume (0.0 to 1.0)
export const setVolume = (volume: number): void => {
  masterVolume = Math.max(0, Math.min(1, volume));
  console.log(`Master volume set to ${masterVolume}`);
};