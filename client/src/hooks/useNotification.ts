import { useCallback, useRef } from 'react';

export function useNotification() {
  const audioRef = useRef<AudioContext | null>(null);

  // Create audio context if not already created
  const getAudioContext = () => {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioRef.current;
  };

  // Play notification sound
  const playSound = useCallback(() => {
    try {
      const audioContext = getAudioContext();
      
      // Create oscillator node for beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 800;
      gainNode.gain.value = 0.5;
      
      const now = audioContext.currentTime;
      
      // Schedule sound with beep pattern
      oscillator.start(now);
      oscillator.stop(now + 0.3);
      
      // Create another beep after a short delay
      const oscillator2 = audioContext.createOscillator();
      oscillator2.connect(gainNode);
      oscillator2.type = 'sine';
      oscillator2.frequency.value = 800;
      
      oscillator2.start(now + 0.4);
      oscillator2.stop(now + 0.7);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, []);

  // Trigger device vibration if supported
  const vibrate = useCallback(() => {
    if ('vibrate' in navigator) {
      // Vibrate pattern: 200ms vibration, 100ms pause, 200ms vibration
      navigator.vibrate([200, 100, 200]);
    }
  }, []);

  return { playSound, vibrate };
}
