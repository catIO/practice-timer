import React, { useState } from 'react';
import { SettingsType } from '@/lib/timerService';
import { SoundType, playSound } from '@/lib/soundEffects';
import { SettingCard } from './SettingCard';
import { SettingRow } from './SettingRow';
import { NumberStepper } from './NumberStepper';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GeneralSettingsTabProps {
  settings: SettingsType;
  onUpdateSettings: (updates: Partial<SettingsType>) => void;
}

const SOUND_TYPE_OPTIONS: { value: SoundType; label: string }[] = [
  { value: 'beep', label: 'Beep' },
  { value: 'bell', label: 'Bell' },
  { value: 'chime', label: 'Chime' },
  { value: 'digital', label: 'Digital' },
  { value: 'woodpecker', label: 'Woodpecker' },
];

export function GeneralSettingsTab({
  settings,
  onUpdateSettings,
}: GeneralSettingsTabProps) {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const handlePreviewSound = async (
    soundType = settings.soundType as SoundType,
    volume = settings.volume
  ) => {
    if (isPlayingPreview) return;
    setIsPlayingPreview(true);
    try {
      await playSound('end', 1, volume, soundType);
    } catch (e) {
      console.error('Failed to play preview sound:', e);
    } finally {
      setIsPlayingPreview(false);
    }
  };

  const handleVolumeChange = (values: number[]) => {
    onUpdateSettings({ volume: values[0] });
  };

  const handleVolumeCommit = (values: number[]) => {
    const volume = values[0];
    onUpdateSettings({ volume });
    handlePreviewSound(settings.soundType as SoundType, volume);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Sound Settings */}
      <SettingCard
        title="Sound & Alerts"
        description="Configure audio cues and alerts for timer transitions"
        icon="volume_up"
      >
        <SettingRow
          label="Volume"
          description="Adjust notification chime and alert loudness"
        >
          <div className="flex items-center gap-3 w-48 sm:w-56">
            <Slider
              id="volume-slider"
              min={0}
              max={100}
              step={1}
              value={[settings.volume]}
              onValueChange={handleVolumeChange}
              onValueCommit={handleVolumeCommit}
              className="w-full"
              aria-label="Volume percentage"
            />
            <span className="text-xs font-mono text-muted-foreground w-9 text-right shrink-0">
              {settings.volume}%
            </span>
          </div>
        </SettingRow>

        <SettingRow
          label="Sound Type"
          description="Choose the tone played when a session finishes"
          htmlFor="sound-type-select"
        >
          <div className="flex items-center gap-2">
            <div className="w-36 sm:w-40">
              <Select
                value={
                  SOUND_TYPE_OPTIONS.some((opt) => opt.value === settings.soundType)
                    ? settings.soundType
                    : 'beep'
                }
                onValueChange={(val) => {
                  const newSound = val as SoundType;
                  onUpdateSettings({ soundType: newSound });
                  handlePreviewSound(newSound, settings.volume);
                }}
              >
                <SelectTrigger id="sound-type-select">
                  <SelectValue placeholder="Select sound" />
                </SelectTrigger>
                <SelectContent>
                  {SOUND_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 border-white/10 shrink-0"
              onClick={() => handlePreviewSound()}
              disabled={isPlayingPreview}
              title="Preview sound"
              aria-label="Preview sound"
            >
              <span className="material-icons text-sm">
                {isPlayingPreview ? 'volume_up' : 'play_arrow'}
              </span>
            </Button>
          </div>
        </SettingRow>

        <SettingRow
          label="Number of Beeps"
          description="How many times the completion alert repeats"
        >
          <NumberStepper
            value={settings.numberOfBeeps}
            min={1}
            max={5}
            step={1}
            onChange={(val) => onUpdateSettings({ numberOfBeeps: val })}
            ariaLabel="Number of beeps"
          />
        </SettingRow>
      </SettingCard>

      {/* Timer Settings */}
      <SettingCard
        title="Timer & Intervals"
        description="Set standard durations for practice and rest intervals"
        icon="timer"
      >
        <SettingRow
          label="Work Duration"
          description="Length of each focused practice session"
        >
          <NumberStepper
            value={settings.workDuration}
            min={5}
            max={60}
            step={5}
            unit="min"
            onChange={(val) => onUpdateSettings({ workDuration: val })}
            ariaLabel="Work session duration"
          />
        </SettingRow>

        <SettingRow
          label="Break Duration"
          description="Length of rest between practice sessions"
        >
          <NumberStepper
            value={settings.breakDuration}
            min={1}
            max={15}
            step={1}
            unit="min"
            onChange={(val) => onUpdateSettings({ breakDuration: val })}
            ariaLabel="Break duration"
          />
        </SettingRow>

        <SettingRow
          label="Cycles / Iterations"
          description="Number of work-break cycles before a session resets"
        >
          <NumberStepper
            value={settings.iterations}
            min={1}
            max={8}
            step={1}
            onChange={(val) => onUpdateSettings({ iterations: val })}
            ariaLabel="Number of iterations"
          />
        </SettingRow>
      </SettingCard>

      {/* Display & Screen Behavior */}
      <SettingCard
        title="Appearance & Display"
        description="Interface theme and screen behavior preferences"
        icon="palette"
      >
        <SettingRow
          label="Theme"
          description="Choose between dark, light, or system appearance"
          htmlFor="theme-select"
        >
          <div className="w-36 sm:w-40">
            <Select
              value={settings.theme ?? 'dark'}
              onValueChange={(val) =>
                onUpdateSettings({ theme: val as 'light' | 'dark' | 'system' })
              }
            >
              <SelectTrigger id="theme-select">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SettingRow>

        <SettingRow
          label="Week Starts On"
          description="Determines how practice activity is grouped by week in reports"
          htmlFor="week-starts-select"
        >
          <div className="w-36 sm:w-40">
            <Select
              value={settings.weekStartsOn ?? 'monday'}
              onValueChange={(val) =>
                onUpdateSettings({ weekStartsOn: val as 'monday' | 'sunday' })
              }
            >
              <SelectTrigger id="week-starts-select">
                <SelectValue placeholder="Week start" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monday">Monday</SelectItem>
                <SelectItem value="sunday">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SettingRow>

        <SettingRow
          label="Keep Screen Awake"
          description="Prevent your screen or device from locking while a timer is active"
          htmlFor="keep-screen-awake"
        >
          <Switch
            id="keep-screen-awake"
            checked={settings.keepScreenAwake ?? true}
            onCheckedChange={(checked) =>
              onUpdateSettings({ keepScreenAwake: checked })
            }
          />
        </SettingRow>
      </SettingCard>
    </div>
  );
}
