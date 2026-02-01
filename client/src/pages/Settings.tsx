import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SettingsType, DEFAULT_SETTINGS } from "@/lib/timerService";
import { getSettings, saveSettings } from '@/lib/localStorage';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useNotification } from "@/hooks/useNotification";
import { playSound, initializeAudioForIOS } from "@/lib/soundEffects";
import { SoundType } from "@/lib/soundEffects";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import "@/assets/headerBlur.css";
import { useTimerStore } from '@/stores/timerStore';
import { updateWorkerState } from '@/lib/timerWorkerSingleton';

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { requestNotificationPermission } = useNotification();
  const [localSettings, setLocalSettings] = useState<SettingsType>(getSettings() || DEFAULT_SETTINGS);
  const [isVolumeChanging, setIsVolumeChanging] = useState(false);
  const [isSoundTypeChanging, setIsSoundTypeChanging] = useState(false);
  const { isRunning } = useTimerStore();
  


  // Handle settings update
  const handleSettingsUpdate = (updates: Partial<SettingsType>) => {
    // Always ensure dark mode is enabled
    const newSettings = { ...localSettings, ...updates, darkMode: true };
    setLocalSettings(newSettings);
    
    // Save to localStorage first
    saveSettings(newSettings);
    
    // Then update global settings
    // updateGlobalSettings(newSettings); // This line is removed as per the edit hint
    
    // Ensure dark mode is always applied
    document.documentElement.classList.add('dark');

    // If timer duration settings changed, reset the timer only if it's not running
    if (
      (updates.workDuration !== undefined ||
      updates.breakDuration !== undefined ||
      updates.iterations !== undefined) &&
      !isRunning // Only reset if timer is not running
    ) {
      console.log('Settings: Timer duration changed and timer is not running, resetting timer');
      const { setTimeRemaining, setTotalTime, setMode, setCurrentIteration, setTotalIterations, setSettings: setStoreSettings } = useTimerStore.getState();
      
      // Update store settings first
      setStoreSettings(newSettings);
      
      // Calculate new duration in seconds
      const newDuration = newSettings.workDuration * 60;
      
      // Then update timer state
      setTimeRemaining(newDuration);
      setTotalTime(newDuration);
      setMode('work');
      setCurrentIteration(1);
      setTotalIterations(newSettings.iterations);
      
      // Update worker state with the same values
      updateWorkerState(
        newDuration,
        false, // isRunning
        'work',
        1,
        newSettings.iterations
      );
      
      console.log('Settings: Updated timer state:', {
        timeRemaining: newDuration,
        totalTime: newDuration,
        mode: 'work',
        currentIteration: 1,
        totalIterations: newSettings.iterations
      });
    } else if (
      updates.workDuration !== undefined ||
      updates.breakDuration !== undefined ||
      updates.iterations !== undefined
    ) {
      console.log('Settings: Timer duration changed but timer is running, will apply on next session');
      // Just update the settings, don't reset the timer
      const { setSettings: setStoreSettings } = useTimerStore.getState();
      setStoreSettings(newSettings);
    }

    toast({
      title: "Settings Saved",
      description: "Your settings have been saved successfully.",
    });
  };

  // Handle volume change with preview sound
  const handleVolumeChange = async (value: number[]) => {
    const newVolume = value[0];
    const newSettings = {
      ...localSettings,
      volume: newVolume
    };
    
    // Update settings
    setLocalSettings(newSettings);
    
    
    
    playSound('end', 1, newVolume, localSettings.soundType as SoundType)
      .catch(error => {
        console.error('Error playing preview sound:', error);
      });
  };

  // Save volume setting when slider interaction ends
  const handleVolumeChangeComplete = () => {
    saveSettings(localSettings);
    // updateGlobalSettings(localSettings); // This line is removed as per the edit hint
  };

  // Handle sound type change with preview
  const handleSoundTypeChange = async (value: string) => {
    const newSoundType = value as SoundType;
    const newSettings = {
      ...localSettings,
      soundType: newSoundType
    };
    
    // Update settings
    setLocalSettings(newSettings);
    
    // For iOS, try to unlock audio on sound type change
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      console.log('iOS: Sound type change detected, trying direct sound test...');
      
      // Try to play a sound directly in the user gesture context
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('iOS: Audio context created, state:', context.state);
        
        if (context.state === 'suspended') {
          await context.resume();
          console.log('iOS: Audio context resumed');
        }
        
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.frequency.setValueAtTime(800, context.currentTime);
        gainNode.gain.setValueAtTime(0.5, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
        
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.3);
        
        console.log('iOS: Direct sound test completed');
      } catch (error) {
        console.error('iOS: Direct sound test failed:', error);
      }
    }
    
    playSound('end', 1, localSettings.volume, newSoundType)
      .catch(error => {
        console.error('Error playing preview sound:', error);
      });
  };

  // Save sound type setting when selection is made
  const handleSoundTypeChangeComplete = () => {
    saveSettings(localSettings);
    // updateGlobalSettings(localSettings); // This line is removed as per the edit hint
  };

  return (
    <div className="text-foreground font-sans min-h-screen">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="rounded-2xl p-6 bg-gradient-to-t from-gray-800/40 to-black bg-[length:100%_200%] bg-[position:90%_100%] backdrop-blur-sm">
          <header className="relative p-4 flex items-center justify-between overflow-hidden">
            <div className="relative z-10 flex items-center justify-between w-full">
              <h1 className="text-2xl font-bold text-primary">Settings</h1>
              <Button variant="ghost" size="icon" asChild>
                <Link to="/">
                  <span className="material-icons text-primary hover:text-primary/80">arrow_back</span>
                </Link>
              </Button>
            </div>
          </header>

          <section className="p-6">
            <div className="space-y-6">
              {/* Sound Settings */}
              <div>
                <h2 className="text-lg font-medium mb-4">Sound Settings</h2>
                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="volume" className="text-sm font-medium">
                        Volume
                      </label>
                      <span className="text-sm text-muted-foreground">
                        {localSettings.volume}%
                      </span>
                    </div>
                    <Slider
                      id="volume"
                      min={0}
                      max={100}
                      step={1}
                      value={[localSettings.volume]}
                      onValueChange={handleVolumeChange}
                      onValueCommit={handleVolumeChangeComplete}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="material-icons text-muted-foreground mr-3">music_note</span>
                      <Label htmlFor="sound-type-select">Sound Type</Label>
                    </div>
                    <div className="w-48">
                      <Select
                        value={localSettings.soundType || 'beep'}
                        onValueChange={handleSoundTypeChange}
                        onOpenChange={(open) => {
                          if (!open) {
                            handleSoundTypeChangeComplete();
                          }
                        }}
                      >
                        <SelectTrigger id="sound-type-select">
                          <SelectValue placeholder="Select sound type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beep">Beep</SelectItem>
                          <SelectItem value="bell">Bell</SelectItem>
                          <SelectItem value="chime">Chime</SelectItem>
                          <SelectItem value="digital">Digital</SelectItem>
                          <SelectItem value="woodpecker">Woodpecker</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="material-icons text-muted-foreground mr-3">notifications</span>
                      <Label htmlFor="beeps-count">Number of Beeps</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSettingsUpdate({
                          ...localSettings,
                          numberOfBeeps: Math.max(1, localSettings.numberOfBeeps - 1)
                        })}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center">{localSettings.numberOfBeeps}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSettingsUpdate({
                          ...localSettings,
                          numberOfBeeps: Math.min(5, localSettings.numberOfBeeps + 1)
                        })}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timer Settings */}
              <div>
                <h2 className="text-lg font-medium mb-4">Timer Settings</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="material-icons text-muted-foreground mr-3">timer</span>
                      <Label>Work Duration</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSettingsUpdate({
                          ...localSettings,
                          workDuration: Math.max(5, localSettings.workDuration - 5)
                        })}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center">{localSettings.workDuration} min</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSettingsUpdate({
                          ...localSettings,
                          workDuration: Math.min(60, localSettings.workDuration + 5)
                        })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="material-icons text-muted-foreground mr-3">coffee</span>
                      <Label>Break Duration</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSettingsUpdate({
                          ...localSettings,
                          breakDuration: Math.max(1, localSettings.breakDuration - 1)
                        })}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center">{localSettings.breakDuration} min</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSettingsUpdate({
                          ...localSettings,
                          breakDuration: Math.min(15, localSettings.breakDuration + 1)
                        })}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="material-icons text-muted-foreground mr-3">repeat</span>
                      <Label>Number of Iterations</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSettingsUpdate({
                          ...localSettings,
                          iterations: Math.max(1, localSettings.iterations - 1)
                        })}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center">{localSettings.iterations}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSettingsUpdate({
                          ...localSettings,
                          iterations: Math.min(8, localSettings.iterations + 1)
                        })}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Number of work-break cycles to complete before reset.
                  </p>
                </div>
              </div>

              {/* Display Settings */}
              <div>
                <h2 className="text-lg font-medium mb-4">Display</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="material-icons text-muted-foreground mr-3">calendar_view_week</span>
                      <Label htmlFor="week-starts">Week starts on</Label>
                    </div>
                    <div className="w-32">
                      <Select
                        value={localSettings.weekStartsOn ?? 'monday'}
                        onValueChange={(value) => handleSettingsUpdate({
                          ...localSettings,
                          weekStartsOn: value as 'monday' | 'sunday'
                        })}
                      >
                        <SelectTrigger id="week-starts">
                          <SelectValue placeholder="Week start" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monday">Monday</SelectItem>
                          <SelectItem value="sunday">Sunday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Affects how practice time is grouped by week.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
} 