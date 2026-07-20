import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SettingsType, DEFAULT_SETTINGS } from "@/lib/timerService";
import { getSettings, saveSettings } from '@/lib/localStorage';
import { applyTheme } from '@/lib/theme';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useNotification } from "@/hooks/useNotification";
import { playSound } from "@/lib/soundEffects";
import { SoundType } from "@/lib/soundEffects";
import { useAuth } from "@/contexts/AuthContext";
import { updatePassword, updateDisplayName } from "@/lib/authService";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { restorePlanFromSnapshot, type ReportSnapshot } from "@/lib/reportShare";
import { practicePlanApi } from "@/lib/practicePlan";
import { supabase } from "@/lib/supabaseClient";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import "@/assets/headerBlur.css";
import { useTimerStore } from '@/stores/timerStore';
import { updateWorkerState } from '@/lib/timerWorkerSingleton';

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { requestNotificationPermission } = useNotification();
  const [localSettings, setLocalSettings] = useState<SettingsType>(getSettings() || DEFAULT_SETTINGS);
  const [isVolumeChanging, setIsVolumeChanging] = useState(false);
  const [isSoundTypeChanging, setIsSoundTypeChanging] = useState(false);
  const { isRunning } = useTimerStore();
  const { isLoggedIn, user, signOut, refreshUser } = useAuth();

  const initialTab = searchParams.get('tab') === 'account' ? 'account' : 'general';
  const [activeTab, setActiveTab] = useState<'general' | 'account'>(initialTab);

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || user?.user_metadata?.name || '');
  const [isUpdatingDisplayName, setIsUpdatingDisplayName] = useState(false);
  const [displayNameSuccess, setDisplayNameSuccess] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  // Sync activeTab when query param changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'account') {
      setActiveTab('account');
    } else if (tabParam === 'general') {
      setActiveTab('general');
    }
  }, [searchParams]);

  // Sync display name state with user metadata
  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.full_name || user.user_metadata?.name || '');
    }
  }, [user]);

  // Change tab helper that updates query parameters
  const handleTabChange = (tab: 'general' | 'account') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };



  // Handle settings update
  const handleSettingsUpdate = (updates: Partial<SettingsType>) => {
    const newSettings = { ...localSettings, ...updates };
    setLocalSettings(newSettings);

    // Save to localStorage first
    saveSettings(newSettings);

    // Then update global settings
    // updateGlobalSettings(newSettings); // This line is removed as per the edit hint

    // Apply theme
    if (newSettings.theme) {
      applyTheme(newSettings.theme);
    }

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

  const handleDisplayNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisplayNameError(null);
    setDisplayNameSuccess(false);
    setIsUpdatingDisplayName(true);

    try {
      const { error } = await updateDisplayName(displayName.trim());
      if (error) {
        setDisplayNameError(error.message);
      } else {
        setDisplayNameSuccess(true);
        await refreshUser();
        toast({
          title: "Profile Updated",
          description: "Your display name has been saved.",
        });
      }
    } catch {
      setDisplayNameError('Failed to update display name');
    } finally {
      setIsUpdatingDisplayName(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch {
      setPasswordError('Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="space-y-6">
      {isLoggedIn && (
        <div className="flex gap-2 border-b border-white/10 pb-4">
          <button
            onClick={() => handleTabChange('general')}
            className={`pb-2 px-3 text-sm font-semibold border-b-2 transition-all ${activeTab === 'general'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            General
          </button>
          <button
            onClick={() => handleTabChange('account')}
            className={`pb-2 px-3 text-sm font-semibold border-b-2 transition-all ${activeTab === 'account'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            Account
          </button>
        </div>
      )}

      {activeTab === 'account' && isLoggedIn ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-lg font-medium mb-1">Account details</h2>
            <p className="text-sm text-muted-foreground font-mono">{user?.email}</p>
          </div>

          <div className="pt-4 border-t border-white/10">
            <h3 className="text-sm font-medium mb-3">Display Name</h3>
            <form onSubmit={handleDisplayNameUpdate} className="space-y-3 max-w-md">
              {displayNameError && (
                <div className="p-3 bg-red-950/20 border border-red-850 rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-sm text-red-200">{displayNameError}</p>
                </div>
              )}
              {displayNameSuccess && (
                <div className="p-3 bg-green-950/20 border border-green-850 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  <p className="text-sm text-green-200">Display name updated successfully</p>
                </div>
              )}
              <div>
                <Label htmlFor="display-name" className="text-sm">Name</Label>
                <Input
                  id="display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name (e.g. for sharing reports with teachers)"
                  className="mt-1"
                  required
                />
              </div>
              <Button type="submit" size="sm" disabled={isUpdatingDisplayName}>
                {isUpdatingDisplayName ? 'Saving...' : 'Save Name'}
              </Button>
            </form>
          </div>

          <div className="pt-4 border-t border-white/10">
            <h3 className="text-sm font-medium mb-3">Change Password</h3>
            <form onSubmit={handlePasswordUpdate} className="space-y-3">
              {passwordError && (
                <div className="p-3 bg-red-950/20 border border-red-850 rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-sm text-red-200">{passwordError}</p>
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 bg-green-950/20 border border-green-850 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  <p className="text-sm text-green-200">Password updated successfully</p>
                </div>
              )}
              <div>
                <Label htmlFor="new-password" className="text-sm">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="mt-1"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <Label htmlFor="confirm-new-password" className="text-sm">Confirm New Password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="mt-1"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" size="sm" disabled={isUpdatingPassword}>
                {isUpdatingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </div>

          <div className="pt-4 border-t border-white/10">
            <Button variant="destructive" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Sound Settings */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Sound Settings</h2>
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="volume" className="text-sm font-medium">
                    Volume
                  </label>
                  <span className="text-sm text-muted-foreground font-mono">
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
                  <span className="w-8 text-center font-semibold font-mono">{localSettings.numberOfBeeps}</span>
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
          <div className="pt-6 border-t border-white/10">
            <h2 className="text-lg font-semibold mb-4">Timer Settings</h2>
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
                  <span className="w-16 text-center font-semibold font-mono">{localSettings.workDuration} min</span>
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
                  <span className="w-16 text-center font-semibold font-mono">{localSettings.breakDuration} min</span>
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
                  <span className="w-16 text-center font-semibold font-mono">{localSettings.iterations}</span>
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
          <div className="pt-6 border-t border-white/10">
            <h2 className="text-lg font-semibold mb-4">Display</h2>
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

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="material-icons text-muted-foreground mr-3">palette</span>
                  <Label htmlFor="theme-select">Theme</Label>
                </div>
                <div className="w-32">
                  <Select
                    value={localSettings.theme ?? 'dark'}
                    onValueChange={(value) => handleSettingsUpdate({
                      theme: value as 'light' | 'dark' | 'system'
                    })}
                  >
                    <SelectTrigger id="theme-select">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose light, dark, or system default colors.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Data Recovery */}
      {isLoggedIn && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <h3 className="text-sm font-medium text-foreground mb-1">Data Recovery</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Restore your practice plan from the last published report.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10"
            onClick={async () => {
              if (!supabase) {
                toast({ title: "Not available", description: "Database connection not configured.", variant: "destructive" });
                return;
              }
              try {
                const { data: sessionData } = await supabase.auth.getSession();
                const userId = sessionData.session?.user?.id;
                if (!userId) {
                  toast({ title: "Not logged in", description: "Please log in to restore.", variant: "destructive" });
                  return;
                }
                const { data, error } = await supabase
                  .from("shared_reports")
                  .select("data")
                  .eq("user_id", userId)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .single();
                if (error || !data) {
                  toast({ title: "No report found", description: "No published report found for your account.", variant: "destructive" });
                  return;
                }
                const snapshot = data.data as ReportSnapshot;
                const restoredPlan = restorePlanFromSnapshot(snapshot);
                practicePlanApi.save(restoredPlan);
                toast({ title: "Plan restored", description: "Your practice plan has been restored. Reload to see changes." });
              } catch (e) {
                console.error("[Settings] Restore failed:", e);
                toast({ title: "Restore failed", description: "An error occurred while restoring.", variant: "destructive" });
              }
            }}
          >
            Restore plan from report
          </Button>
        </div>
      )}
    </div>
  );
} 