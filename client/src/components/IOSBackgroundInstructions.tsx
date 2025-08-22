import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Smartphone, Volume2, Bell, Settings, CheckCircle, XCircle } from 'lucide-react';

interface IOSBackgroundInstructionsProps {
  isVisible?: boolean;
  onDismiss?: () => void;
}

export function IOSBackgroundInstructions({ isVisible = false, onDismiss }: IOSBackgroundInstructionsProps) {
  const [isIOS, setIsIOS] = useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if app is running as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Check notification permission
    setHasNotifications(Notification.permission === 'granted');

    // Check if PWA is installed (rough detection)
    const isInstalled = standalone || window.navigator.standalone;
    setIsPWAInstalled(!!isInstalled);
  }, []);

  if (!isVisible || !isIOS) {
    return null;
  }

  const steps = [
    {
      id: 'install',
      title: 'Install as App',
      description: 'Add to Home Screen for better background performance',
      icon: Smartphone,
      completed: isPWAInstalled,
      action: () => {
        // Show installation instructions
        const instructions = document.createElement('div');
        instructions.innerHTML = `
          <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 20px; border-radius: 10px; max-width: 300px; text-align: center;">
              <h3>Install Practice Timer</h3>
              <p>1. Tap the Share button <span style="font-size: 20px;">📤</span></p>
              <p>2. Scroll down and tap "Add to Home Screen"</p>
              <p>3. Tap "Add" to install</p>
              <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 10px; padding: 10px 20px; background: #007AFF; color: white; border: none; border-radius: 5px;">Got it!</button>
            </div>
          </div>
        `;
        document.body.appendChild(instructions);
      }
    },
    {
      id: 'notifications',
      title: 'Enable Notifications',
      description: 'Get notified when timer completes',
      icon: Bell,
      completed: hasNotifications,
      action: async () => {
        try {
          const permission = await Notification.requestPermission();
          setHasNotifications(permission === 'granted');
        } catch (error) {
          console.error('Failed to request notification permission:', error);
        }
      }
    },
    {
      id: 'volume',
      title: 'Check Volume',
      description: 'Ensure device volume is on for audio alerts',
      icon: Volume2,
      completed: true, // We can't detect volume, so always show as completed
      action: () => {
        // Show volume check instructions
        alert('Please ensure your device volume is turned on to hear timer alerts.');
      }
    },
    {
      id: 'background',
      title: 'Background App Refresh',
      description: 'Enable in iOS Settings for better background performance',
      icon: Settings,
      completed: false, // We can't detect this setting
      action: () => {
        // Show background app refresh instructions
        const instructions = document.createElement('div');
        instructions.innerHTML = `
          <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 20px; border-radius: 10px; max-width: 300px; text-align: center;">
              <h3>Enable Background App Refresh</h3>
              <p>1. Open iOS Settings</p>
              <p>2. Go to General > Background App Refresh</p>
              <p>3. Find Safari (or your browser) and enable it</p>
              <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 10px; padding: 10px 20px; background: #007AFF; color: white; border: none; border-radius: 5px;">Got it!</button>
            </div>
          </div>
        `;
        document.body.appendChild(instructions);
      }
    }
  ];

  const completedSteps = steps.filter(step => step.completed).length;
  const totalSteps = steps.length;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">iOS Optimization</CardTitle>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-8 w-8 p-0"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardDescription>
          Optimize your experience for background timer functionality
        </CardDescription>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {completedSteps}/{totalSteps} Complete
          </Badge>
          {isStandalone && (
            <Badge variant="default" className="bg-green-500">
              PWA Installed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            iOS has limitations for web apps in the background. These steps will help maximize timer reliability.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  step.completed
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className={`p-2 rounded-full ${
                  step.completed ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {step.completed ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Icon className="h-4 w-4 text-gray-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium text-sm ${
                    step.completed ? 'text-green-800' : 'text-gray-900'
                  }`}>
                    {step.title}
                  </h4>
                  <p className={`text-xs ${
                    step.completed ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {step.description}
                  </p>
                </div>
                {!step.completed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={step.action}
                    className="text-xs"
                  >
                    Setup
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Note:</strong> Even with these optimizations, iOS may still pause the timer when the app is backgrounded for extended periods.</p>
          <p>The timer will attempt to sync when you return to the app.</p>
        </div>
      </CardContent>
    </Card>
  );
}
