import { memo } from 'react';
import { cn } from '@/lib/utils';

interface TimerDisplayProps {
  timeRemaining: number;
  totalTime: number;
  mode: 'work' | 'break';
  className?: string;
}

export const TimerDisplay = memo(function TimerDisplay({
  timeRemaining,
  totalTime,
  mode,
  className
}: TimerDisplayProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  const progress = (timeRemaining / totalTime) * 100;

  return (
    <div className={cn('relative flex flex-col items-center justify-center', className)}>
      <div className="relative w-64 h-64">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            className="text-gray-200"
            strokeWidth="8"
            stroke="currentColor"
            fill="transparent"
            r="120"
            cx="128"
            cy="128"
          />
          <circle
            className={cn(
              'transition-all duration-1000 ease-linear',
              mode === 'work' ? 'text-blue-500' : 'text-green-500'
            )}
            strokeWidth="8"
            strokeDasharray={753.6}
            strokeDashoffset={753.6 - (753.6 * progress) / 100}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="120"
            cx="128"
            cy="128"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div 
              className="text-6xl font-bold tabular-nums font-mono"
            >
              {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
            </div>
            <div className="text-lg font-medium text-gray-500 mt-2">
              {mode === 'work' ? 'Work Time' : 'Break Time'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}); 