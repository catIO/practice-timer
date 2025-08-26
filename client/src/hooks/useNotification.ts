import { useCallback } from 'react';
import { playSound as playSoundEffect, resumeAudioContext, initializeAudioForIOS, SoundType, SoundEffect } from '@/lib/soundEffects';
import { useToast } from '@/hooks/use-toast';
import { SettingsType } from '@/lib/timerService';

// Check if Notification API is available
const isNotificationSupported = typeof Notification !== 'undefined';

export function useNotification() {
  const { toast } = useToast();

  const requestNotificationPermission = useCallback(async () => {
    try {
      // Check if notifications are supported
      if (!isNotificationSupported) {
        console.log('Notification API not supported in this context');
        return false;
      }

      // Check if notifications are already granted
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        return true;
      }

      if (typeof Notification !== 'undefined') {
        const permission = await Notification.requestPermission();
        console.log('Notification permission status:', permission);
        return permission === 'granted';
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, []);

  const showNotification = useCallback(async (title: string, options: NotificationOptions = {}) => {
    try {
      // Check if notifications are supported
      if (!isNotificationSupported) {
        console.log('Notification API not supported, skipping notification');
        return;
      }

      if (typeof Notification !== 'undefined') {
        console.log('Current notification permission:', Notification.permission);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title, {
            body: options?.body,
            tag: options?.tag || 'default',
            requireInteraction: options?.requireInteraction || false,
            // Add notification sound for iOS background audio
            icon: '/favicon.ico', // Add icon for better notification
            badge: '/favicon.ico', // Add badge for iOS
            // Use default notification sound (works on iOS)
            silent: false, // Ensure sound plays
          });
        } else {
          console.log('Notifications not granted, requesting permission...');
          const granted = await requestNotificationPermission();
          if (granted) {
            new Notification(title, {
              body: options?.body,
              tag: options?.tag || 'default',
              requireInteraction: options?.requireInteraction || false,
              // Add notification sound for iOS background audio
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              // Use default notification sound (works on iOS)
              silent: false, // Ensure sound plays
            });
          }
        }
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [requestNotificationPermission]);

  const showTimerCompletionNotification = useCallback(async (settings: { numberOfBeeps: number; volume: number; soundType: string }) => {
    try {
      console.log('Showing timer completion notification with sound...');
      
      // Check if notifications are supported
      if (!isNotificationSupported) {
        console.log('Notification API not supported, skipping timer completion notification');
        return;
      }
      
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        // Create multiple notifications to simulate multiple beeps
        const numberOfBeeps = Math.min(settings.numberOfBeeps, 3); // Limit to 3 for notifications
        
        for (let i = 0; i < numberOfBeeps; i++) {
          setTimeout(() => {
            new Notification('Timer Complete!', {
              body: i === 0 ? 'Your timer has finished!' : `Beep ${i + 1}`,
              tag: `timer-complete-${i}`,
              requireInteraction: false,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              silent: false, // This will play the default notification sound
            });
          }, i * 500); // Space out the beeps
        }
        
        console.log(`Timer completion notification sent with ${numberOfBeeps} beeps`);
      } else {
        console.log('Notifications not granted, requesting permission...');
        const granted = await requestNotificationPermission();
        if (granted) {
          // Retry with permission granted
          showTimerCompletionNotification(settings);
        }
      }
    } catch (error) {
      console.error('Error showing timer completion notification:', error);
    }
  }, [requestNotificationPermission]);

  const playSound = useCallback(async (settings: { numberOfBeeps: number; volume: number; soundType: string }) => {
    try {
      console.log('Playing sound with settings:', settings);
      
      // For iOS, use the improved audio initialization
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        console.log('iOS detected, using iOS-compatible audio initialization');
        await initializeAudioForIOS();
      } else {
        // Ensure audio context is resumed before playing sound
        await resumeAudioContext();
      }
      
      // Play sound with retry mechanism
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await playSoundEffect('end', settings.numberOfBeeps, settings.volume, settings.soundType as SoundType);
          console.log('Sound played successfully');
          break;
        } catch (soundError) {
          retryCount++;
          console.error(`Sound playback attempt ${retryCount} failed:`, soundError);
          
          if (retryCount < maxRetries) {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
            // Try to resume audio context again
            if (isIOS) {
              await initializeAudioForIOS();
            } else {
              await resumeAudioContext();
            }
          } else {
            throw soundError;
          }
        }
      }
    } catch (error) {
      console.error('Error playing sound after retries:', error);
      toast({
        title: "Sound Playback Issue",
        description: "Failed to play sound. Please check your browser's audio settings.",
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [toast]);

  return {
    showNotification,
    showTimerCompletionNotification,
    requestNotificationPermission,
    playSound,
  };
}
