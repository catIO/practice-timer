import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Settings, Bell, Lock } from 'lucide-react';

interface iOSBackgroundInstructionsProps {
  isVisible?: boolean;
  onDismiss?: () => void;
}

export function iOSBackgroundInstructions({ isVisible = false, onDismiss }: iOSBackgroundInstructionsProps) {
  const [isIOS, setIsIOS] = useState(false);
  const [isIPad, setIsIPad] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS device
    const userAgent = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // Detect iPad specifically
    const detectIPad = (): boolean => {
      if (/iPad/.test(navigator.userAgent)) {
        return true;
      }
      if (/Macintosh/.test(navigator.userAgent)) {
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
          const minDimension = Math.min(window.screen.width, window.screen.height);
          const maxDimension = Math.max(window.screen.width, window.screen.height);
          if (minDimension >= 768 && maxDimension >= 1024) {
            return true;
          }
        }
      }
      return false;
    };
    setIsIPad(detectIPad());

    // Check if app is running in standalone mode (added to home screen)
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const openSettings = () => {
    if (isIOS) {
      // Try to open iOS Settings app
      if ('openSettings' in window) {
        (window as any).openSettings();
      } else {
        // Fallback: show instructions
        alert('Please go to Settings > Safari > Advanced > Website Data and ensure this site has permission for notifications and background operation.');
      }
    }
  };

  const addToHomeScreen = () => {
    if (isIOS) {
      alert('To add to home screen:\n1. Tap the Share button (square with arrow)\n2. Tap "Add to Home Screen"\n3. Tap "Add"\n\nThis will enable better background operation.');
    }
  };

  if (!isVisible || (!isIOS && !isIPad)) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mx-auto mb-6 border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Info className="h-5 w-5" />
          iOS Optimization
        </CardTitle>
        <CardDescription className="text-orange-700">
          For the best experience on {isIPad ? 'iPad' : 'iOS'}, follow these steps:
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add to Home Screen */}
        {!isStandalone && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              <strong>Add to Home Screen:</strong> This enables better background operation and prevents the timer from stopping when you switch apps.
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 w-full"
                onClick={addToHomeScreen}
              >
                How to Add to Home Screen
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Notifications */}
        <Alert>
          <Bell className="h-4 w-4" />
          <AlertDescription>
            <strong>Enable Notifications:</strong> Get sound alerts when your timer completes, even when the app is in the background.
            {notificationPermission === 'default' && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 w-full"
                onClick={requestNotificationPermission}
              >
                Enable Notifications
              </Button>
            )}
            {notificationPermission === 'denied' && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 w-full"
                onClick={openSettings}
              >
                Open Settings
              </Button>
            )}
          </AlertDescription>
        </Alert>

        {/* Safari Settings */}
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            <strong>Safari Settings:</strong> Ensure this site has permission for:
            <ul className="mt-2 ml-4 list-disc text-sm">
              <li>Microphone (for audio)</li>
              <li>Background App Refresh</li>
              <li>Notifications</li>
            </ul>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full"
              onClick={openSettings}
            >
              Safari Settings
            </Button>
          </AlertDescription>
        </Alert>

        {/* Dismiss button */}
        {onDismiss && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full"
            onClick={onDismiss}
          >
            Got it, don't show again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
