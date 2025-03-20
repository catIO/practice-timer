import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
  const progress = (currentIteration / totalIterations) * 100;
  
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Iteration Progress</h3>
        <Badge 
          variant={mode === 'work' ? "default" : "secondary"}
          className="text-xs"
        >
          {currentIteration} of {totalIterations}
        </Badge>
      </div>
      
      <Progress value={progress} className="h-2" />
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Current: {mode === 'work' ? 'Work' : 'Break'}</span>
        <span>
          {currentIteration === totalIterations && mode === 'break' 
            ? 'Last iteration' 
            : `${totalIterations - currentIteration} ${mode === 'work' ? 'more to go' : 'remaining'}`}
        </span>
      </div>
    </div>
  );
}