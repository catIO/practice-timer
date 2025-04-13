import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/formatTime";

interface TimerProps {
  timeRemaining: number;
  totalTime: number;
  mode: 'work' | 'break';
  isRunning: boolean;
}

export default function Timer({ timeRemaining, totalTime, mode, isRunning }: TimerProps) {
  // Ensure we have valid numbers for the progress calculation
  const progress = totalTime > 0 ? ((totalTime - timeRemaining) / totalTime) * 100 : 0;
  const formattedTime = formatTime(timeRemaining || 0);
  
  // Calculate circle properties
  const size = 200;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  
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
        <div className="text-4xl font-bold text-primary">
          {formattedTime}
        </div>
      </div>
    </div>
  );
}
