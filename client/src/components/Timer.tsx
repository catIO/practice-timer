import { useEffect, useState } from 'react';

interface TimerProps {
  timeRemaining: number;
  totalTime: number;
  mode: 'work' | 'break';
  isRunning: boolean;
}

export default function Timer({ timeRemaining, totalTime, mode, isRunning }: TimerProps) {
  const [offset, setOffset] = useState(0);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update progress circle
  useEffect(() => {
    const progress = 1 - (timeRemaining / totalTime);
    const calculatedOffset = circumference * progress;
    setOffset(calculatedOffset);
  }, [timeRemaining, totalTime, circumference]);

  return (
    <div className="relative w-64 h-64 flex items-center justify-center mb-8">
      {/* SVG Circle Progress */}
      <svg className="w-full h-full -rotate-90 absolute" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="#E0E0E0"
          strokeWidth="5"
        ></circle>
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke={mode === 'work' ? 'hsl(4, 90%, 58%)' : 'hsl(122, 39%, 49%)'}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        ></circle>
      </svg>
      
      {/* Timer display */}
      <div className="text-5xl font-bold">
        {formatTime(timeRemaining)}
      </div>
    </div>
  );
}
