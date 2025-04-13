import React, { useState, useEffect } from 'react';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { playSound } from "@/lib/soundEffects";
import { SoundType } from "@/lib/soundEffects";

interface VolumeSliderProps {
  initialVolume: number;
  soundType: SoundType;
  onVolumeChange: (volume: number) => void;
}

const VolumeSlider: React.FC<VolumeSliderProps> = ({ 
  initialVolume, 
  soundType, 
  onVolumeChange 
}) => {
  const [volume, setVolume] = useState(initialVolume);
  const [isUpdating, setIsUpdating] = useState(false);

  // Update local volume when initialVolume changes
  useEffect(() => {
    setVolume(initialVolume);
  }, [initialVolume]);

  const handleValueChange = (value: number[]) => {
    if (isUpdating) return;
    
    const newVolume = value[0];
    setVolume(newVolume);
    setIsUpdating(true);
    
    // Notify parent component
    onVolumeChange(newVolume);
    
    // Play preview sound
    playSound('end', 1, newVolume, soundType)
      .catch(error => {
        console.error('Error playing preview sound:', error);
      });
    
    // Reset updating flag after a delay
    setTimeout(() => {
      setIsUpdating(false);
    }, 100);
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="volume" className="text-sm font-medium">
          Volume
        </label>
        <span className="text-sm text-muted-foreground">
          {volume}%
        </span>
      </div>
      <Slider
        id="volume"
        min={0}
        max={100}
        step={1}
        value={[volume]}
        onValueChange={handleValueChange}
        className="w-full"
      />
    </div>
  );
};

export default VolumeSlider; 