// Sound effects for the timer application

// Sound effect types
type SoundEffect = 'start' | 'end' | 'reset' | 'skip';

// Sound effect buffers cache
let audioBuffers: Record<SoundEffect, AudioBuffer | null> = {
  start: null,
  end: null,
  reset: null,
  skip: null
};

// Audio context singleton
let audioContext: AudioContext | null = null;

// Get or create audio context
const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Create oscillator-based sounds
const createStartSound = async (ctx: AudioContext): Promise<AudioBuffer> => {
  // Cheerful ascending notes
  const bufferLength = ctx.sampleRate * 0.8; // 0.8 seconds
  const buffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  // Create cheerful ascending tones
  for (let i = 0; i < bufferLength; i++) {
    // Base frequency starts at 440Hz and rises
    const frequency = 440 + (i / bufferLength) * 400;
    
    // Amplitude envelope with fade in/out
    const fadeIn = Math.min(1, i / (ctx.sampleRate * 0.05));
    const fadeOut = Math.min(1, (bufferLength - i) / (ctx.sampleRate * 0.2));
    const amplitude = 0.3 * fadeIn * fadeOut;
    
    // Generate sine wave
    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / ctx.sampleRate);
  }
  
  return buffer;
};

const createEndSound = async (ctx: AudioContext): Promise<AudioBuffer> => {
  // Achievement sound - pleasant chime
  const bufferLength = ctx.sampleRate * 1.0; // 1 second
  const buffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  // Create chime sound
  for (let i = 0; i < bufferLength; i++) {
    // Combine multiple frequencies for a rich chime sound
    const t = i / ctx.sampleRate;
    const f1 = 880; // Base note
    const f2 = 1320; // Fifth
    const f3 = 1760; // Octave
    
    // Amplitude envelope with fade out
    const fadeOut = Math.exp(-3 * t);
    const amplitude = 0.2 * fadeOut;
    
    // Combine frequencies
    data[i] = amplitude * (
      Math.sin(2 * Math.PI * f1 * t) * 0.6 +
      Math.sin(2 * Math.PI * f2 * t) * 0.3 +
      Math.sin(2 * Math.PI * f3 * t) * 0.1
    );
  }
  
  return buffer;
};

const createResetSound = async (ctx: AudioContext): Promise<AudioBuffer> => {
  // Quick reset sound - short descending tone
  const bufferLength = ctx.sampleRate * 0.3; // 0.3 seconds
  const buffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  // Create descending tone
  for (let i = 0; i < bufferLength; i++) {
    // Descending frequency
    const frequency = 600 - (i / bufferLength) * 200;
    
    // Amplitude envelope with quick fade out
    const fadeOut = Math.min(1, (bufferLength - i) / (ctx.sampleRate * 0.1));
    const amplitude = 0.2 * fadeOut;
    
    // Generate sine wave
    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / ctx.sampleRate);
  }
  
  return buffer;
};

const createSkipSound = async (ctx: AudioContext): Promise<AudioBuffer> => {
  // Quick skip sound - short blip
  const bufferLength = ctx.sampleRate * 0.2; // 0.2 seconds
  const buffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  // Create blip sound
  for (let i = 0; i < bufferLength; i++) {
    // Quick rising frequency
    const frequency = 500 + (i / bufferLength) * 300;
    
    // Amplitude envelope with quick fade in/out
    const envelope = Math.sin(Math.PI * i / bufferLength);
    const amplitude = 0.2 * envelope;
    
    // Generate sine wave
    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / ctx.sampleRate);
  }
  
  return buffer;
};

// Get or create audio buffer for a specific sound effect
const getAudioBuffer = async (effect: SoundEffect): Promise<AudioBuffer> => {
  const ctx = getAudioContext();
  
  if (!audioBuffers[effect]) {
    switch (effect) {
      case 'start':
        audioBuffers[effect] = await createStartSound(ctx);
        break;
      case 'end':
        audioBuffers[effect] = await createEndSound(ctx);
        break;
      case 'reset':
        audioBuffers[effect] = await createResetSound(ctx);
        break;
      case 'skip':
        audioBuffers[effect] = await createSkipSound(ctx);
        break;
    }
  }
  
  return audioBuffers[effect]!;
};

// Play a sound effect
export const playSound = async (effect: SoundEffect): Promise<void> => {
  try {
    const ctx = getAudioContext();
    const buffer = await getAudioBuffer(effect);
    
    // Create source node
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // Connect to output
    source.connect(ctx.destination);
    
    // Play sound
    source.start(0);
  } catch (error) {
    console.error(`Error playing ${effect} sound:`, error);
  }
};

// Resume audio context if suspended (needed for browsers that require user interaction)
export const resumeAudioContext = (): Promise<void> => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    return ctx.resume();
  }
  return Promise.resolve();
};