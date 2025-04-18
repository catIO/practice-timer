import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/formatTime";
import { useEffect } from "react";

interface TimerProps {
  timeRemaining: number;
  totalTime: number;
  mode: 'work' | 'break';
  isRunning: boolean;
}

export default function Timer({ timeRemaining, totalTime, mode, isRunning }: TimerProps) {
  console.log('Timer component rendered with props:', { timeRemaining, totalTime, mode, isRunning });
  
  // Ensure we have valid numbers for the progress calculation
  const progress = Math.min(100, Math.max(0, totalTime > 0 ? ((totalTime - timeRemaining) / totalTime) * 100 : 0));
  const formattedTime = formatTime(timeRemaining || 0);
  
  console.log('Progress calculation:', { 
    timeRemaining, 
    totalTime, 
    progress, 
    calculation: totalTime > 0 ? ((totalTime - timeRemaining) / totalTime) * 100 : 0 
  });
  
  // Calculate circle properties
  const size = 280;
  const strokeWidth = 25;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  
  console.log('Circle properties:', { size, strokeWidth, radius, circumference, offset });
  
  // Log timer state for debugging
  useEffect(() => {
    console.log('Timer component state:', {
      timeRemaining,
      totalTime,
      mode,
      isRunning,
      progress,
      offset
    });
  }, [timeRemaining, totalTime, mode, isRunning, progress, offset]);
  
  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-muted"
          fill="none"
        />
        
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={cn(
            "transition-all duration-300 ease-in-out fill-none",
            mode === 'work' 
              ? "stroke-red-500" 
              : "stroke-green-500"
          )}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      
      {/* Timer text */}
      <div className="absolute flex items-center justify-center">
        <div className="text-5xl font-bold text-primary">
          {formattedTime}
        </div>
      </div>
    </div>
  );
}
