import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { SettingsType } from "@/lib/timerService";
import { useDarkMode } from "@/lib/darkModeStore";

interface SettingsProps {
  settings: SettingsType;
  isLoading: boolean;
  onChange: (settings: SettingsType) => void;
}

export default function Settings({ settings, isLoading, onChange }: SettingsProps) {
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const setIsDark = useDarkMode(state => state.setIsDark);
  
  // Update local state when settings prop changes
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);
  
  // Handle toggle changes
  const handleToggleChange = (key: keyof SettingsType, value: boolean) => {
    console.log('Toggle changed:', key, value);
    const updatedSettings = { ...localSettings, [key]: value };
    // Remove userId and id from the settings object
    const { userId, id, ...settingsWithoutIds } = updatedSettings;
    console.log('Updated settings:', settingsWithoutIds);
    
    // If dark mode is being toggled, update it immediately
    if (key === 'darkMode') {
      setIsDark(value);
    }
    
    setLocalSettings(updatedSettings);
    onChange(settingsWithoutIds);
  };

  // Handle slider changes
  const handleSliderChange = (key: keyof SettingsType, value: number[]) => {
    console.log('Slider changed:', key, value);
    const updatedSettings = { ...localSettings, [key]: value[0] };
    // Remove userId and id from the settings object
    const { userId, id, ...settingsWithoutIds } = updatedSettings;
    console.log('Updated settings:', settingsWithoutIds);
    setLocalSettings(updatedSettings);
    onChange(settingsWithoutIds);
  };

  if (isLoading) {
    return (
      <div className="mt-6 pt-4 border-t border-muted">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex justify-between items-center">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-4 border-t border-muted">
      <h3 className="text-lg font-medium mb-4">Settings</h3>
      
      <div className="space-y-4">
        {/* Sound notifications toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="material-icons text-muted-foreground mr-3">notifications</span>
            <Label htmlFor="sound-toggle">Sound Notifications</Label>
          </div>
          <Switch
            id="sound-toggle"
            checked={localSettings.soundEnabled}
            onCheckedChange={(checked) => handleToggleChange('soundEnabled', checked)}
          />
        </div>

        {/* Vibration toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="material-icons text-muted-foreground mr-3">vibration</span>
            <Label htmlFor="vibration-toggle">Vibration</Label>
          </div>
          <Switch
            id="vibration-toggle"
            checked={localSettings.vibrationEnabled}
            onCheckedChange={(checked) => handleToggleChange('vibrationEnabled', checked)}
          />
        </div>

        {/* Dark Mode toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="material-icons text-muted-foreground mr-3">dark_mode</span>
            <Label htmlFor="dark-mode-toggle">Dark Mode</Label>
          </div>
          <Switch
            id="dark-mode-toggle"
            checked={localSettings.darkMode}
            onCheckedChange={(checked) => handleToggleChange('darkMode', checked)}
          />
        </div>

        {/* Work Duration Slider */}
        <div className="mt-4">
          <div className="flex justify-between mb-1">
            <Label className="text-sm text-muted-foreground">Work Duration</Label>
            <span className="text-sm font-medium">{localSettings.workDuration} min</span>
          </div>
          <Slider
            value={[localSettings.workDuration]}
            min={5}
            max={60}
            step={5}
            className="work-mode"
            onValueChange={(value) => handleSliderChange('workDuration', value)}
          />
        </div>

        {/* Break Duration Slider */}
        <div className="mt-4">
          <div className="flex justify-between mb-1">
            <Label className="text-sm text-muted-foreground">Break Duration</Label>
            <span className="text-sm font-medium">{localSettings.breakDuration} min</span>
          </div>
          <Slider
            value={[localSettings.breakDuration]}
            min={1}
            max={15}
            step={1}
            className="break-mode" 
            onValueChange={(value) => handleSliderChange('breakDuration', value)}
          />
        </div>

        {/* Iterations Slider */}
        <div className="mt-4">
          <div className="flex justify-between mb-1">
            <Label className="text-sm text-muted-foreground">Number of Iterations</Label>
            <span className="text-sm font-medium">{localSettings.iterations} cycles</span>
          </div>
          <Slider
            value={[localSettings.iterations]}
            min={1}
            max={8}
            step={1}
            className="iterations-slider"
            onValueChange={(value) => handleSliderChange('iterations', value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Number of work-break cycles to complete before reset.
          </p>
        </div>
      </div>
    </div>
  );
}
