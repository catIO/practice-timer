import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, Settings, Smartphone, Wifi, Battery } from 'lucide-react';

interface iOSBackgroundInstructionsProps {
  isVisible?: boolean;
  onDismiss?: () => void;
}

export function iOSBackgroundInstructions({ isVisible = false, onDismiss }: iOSBackgroundInstructionsProps) {
  const [isIOS, setIsIOS] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Detect iOS device
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);
    
    // Show instructions if on iOS and component is visible
    if (isIOSDevice && isVisible) {
      setShowInstructions(true);
    }
  }, [isVisible]);

  if (!isIOS || !showInstructions) {
    return null;
  }

  const steps = [
    {
      icon: Settings,
      title: "Enable Background App Refresh",
      description: "Go to Settings > General > Background App Refresh and ensure it's turned ON for Safari.",
      detail: "This allows the timer to continue running when the app is in the background."
    },
    {
      icon: Smartphone,
      title: "Add to Home Screen",
      description: "Tap the Share button in Safari and select 'Add to Home Screen' to install the app.",
      detail: "This provides better background operation and prevents Safari from suspending the timer."
    },
    {
      icon: Wifi,
      title: "Keep Wi-Fi Connected",
      description: "Ensure your device stays connected to Wi-Fi or cellular data.",
      detail: "A stable internet connection helps maintain timer accuracy in the background."
    },
    {
      icon: Battery,
      title: "Low Power Mode",
      description: "Consider disabling Low Power Mode for more reliable background operation.",
      detail: "Low Power Mode can limit background app refresh and affect timer accuracy."
    }
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Info className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-blue-900">iOS Background Timer Setup</CardTitle>
        </div>
        <CardDescription className="text-blue-700">
          To ensure your timer works reliably when the browser is in the background on your iPad, 
          please follow these steps:
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Important:</strong> iOS has strict background execution limits. 
            These settings help maximize timer reliability when the app is not in the foreground.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-4 p-4 bg-white rounded-lg border border-blue-100">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <step.icon className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{step.title}</h3>
                  <Badge variant="secondary" className="text-xs">Step {index + 1}</Badge>
                </div>
                <p className="text-sm text-gray-700 mb-1">{step.description}</p>
                <p className="text-xs text-gray-500 italic">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-yellow-800 mb-1">Additional Tips</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Keep the app open in Safari for the first few seconds after starting the timer</li>
                <li>• Avoid switching to other apps immediately after starting the timer</li>
                <li>• If the timer seems inaccurate, try refreshing the page and starting again</li>
                <li>• Consider using the "Add to Home Screen" option for the best experience</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button 
            onClick={() => setShowInstructions(false)}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Got it, don't show again
          </Button>
          {onDismiss && (
            <Button 
              variant="outline" 
              onClick={onDismiss}
              className="flex-1"
            >
              Dismiss
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default iOSBackgroundInstructions;
