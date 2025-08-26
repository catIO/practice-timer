import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';

interface IOSBackgroundInstructionsProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export function iOSBackgroundInstructions({ isVisible, onDismiss }: IOSBackgroundInstructionsProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-md w-full">
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📱</span>
            iOS Practice Timer Setup
          </CardTitle>
          <CardDescription>
            Optimize your iPad for background timer operation while practicing music
          </CardDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 text-blue-600 rounded-full p-1 mt-0.5">
                <span className="text-sm font-bold">1</span>
              </div>
              <div>
                <h4 className="font-semibold">Add to Home Screen</h4>
                <p className="text-sm text-muted-foreground">
                  Tap the share button (📤) and select "Add to Home Screen" for better background performance
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 text-blue-600 rounded-full p-1 mt-0.5">
                <span className="text-sm font-bold">2</span>
              </div>
              <div>
                <h4 className="font-semibold">Enable Background App Refresh</h4>
                <p className="text-sm text-muted-foreground">
                  Go to Settings → General → Background App Refresh → Enable for Safari
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 text-blue-600 rounded-full p-1 mt-0.5">
                <span className="text-sm font-bold">3</span>
              </div>
              <div>
                <h4 className="font-semibold">Allow Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  Grant notification permissions when prompted for timer completion alerts
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 text-blue-600 rounded-full p-1 mt-0.5">
                <span className="text-sm font-bold">4</span>
              </div>
              <div>
                <h4 className="font-semibold">Keep Wi-Fi Connected</h4>
                <p className="text-sm text-muted-foreground">
                  Ensure stable internet connection for reliable background operation
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-orange-100 text-orange-600 rounded-full p-1 mt-0.5">
                <span className="text-sm font-bold">!</span>
              </div>
              <div>
                <h4 className="font-semibold text-orange-600">Practice Timer Tips</h4>
                <p className="text-sm text-muted-foreground">
                  • Start the timer, then switch to your music app or score viewer<br/>
                  • The timer will continue running in the background<br/>
                  • You'll get notifications when sessions complete<br/>
                  • Return to the app to see accurate time remaining
                </p>
              </div>
            </div>
          </div>
          
          <div className="pt-2">
            <Button onClick={onDismiss} className="w-full">
              Got it!
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
