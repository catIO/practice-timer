import { useCallback } from 'react';
import { playSound as playSoundEffect, resumeAudioContext, initializeAudioForIOS, SoundType, SoundEffect } from '@/lib/soundEffects';
import { useToast } from '@/hooks/use-toast';
import { SettingsType } from '@/lib/timerService';

export function useNotification() {
  const { toast } = useToast();

  const requestNotificationPermission = useCallback(async () => {
    try {
      // Check if notifications are already granted
      if (Notification.permission === 'granted') {
        return true;
      }

      const permission = await Notification.requestPermission();
      console.log('Notification permission status:', permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, []);

  const showNotification = useCallback(async (title: string, options: NotificationOptions = {}) => {
    try {
      console.log('Current notification permission:', Notification.permission);
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body: options?.body,
          silent: options?.silent || false,
          tag: options?.tag || 'default',
          requireInteraction: options?.requireInteraction || false,
        });
      } else {
        console.log('Notifications not granted, requesting permission...');
        const granted = await requestNotificationPermission();
        if (granted) {
          new Notification(title, {
            body: options?.body,
            silent: options?.silent || false,
            tag: options?.tag || 'default',
            requireInteraction: options?.requireInteraction || false,
          });
        }
      }
    } catch (error) {
      console.error('Error showing notification:', error);
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
    requestNotificationPermission,
    showNotification,
    playSound
  };
}
