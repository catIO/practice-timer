import { cn } from "@/lib/utils";

interface IterationTrackerProps {
  currentIteration: number;
  totalIterations: number;
  mode: 'work' | 'break';
}

export default function IterationTracker({
  currentIteration,
  totalIterations,
  mode
}: IterationTrackerProps) {
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="text-base font-medium text-white/80">
        {mode === 'work' ? 'Work Session' : 'Break'} •  {currentIteration} of {totalIterations}
      </div>
      <div className="flex space-x-2">
        {Array.from({ length: totalIterations }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "w-5 h-5 rounded-full transition-all duration-300",
              index + 1 === currentIteration
                ? mode === 'work' 
                  ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                  : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                : index + 1 < currentIteration
                ? "bg-white/30"
                : "bg-white/10"
            )}
          />
        ))}
      </div>
    </div>
  );
}