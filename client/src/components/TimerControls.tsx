import { Button } from "@/components/ui/button";

interface TimerControlsProps {
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
}

export default function TimerControls({ 
  isRunning, 
  onStart, 
  onPause, 
  onReset, 
  onSkip 
}: TimerControlsProps) {
  return (
    <div className="flex items-center justify-center space-x-6 mb-6">
      {/* Reset button */}
      <Button
        variant="outline"
        size="icon"
        className="w-12 h-12 rounded-full bg-muted text-foreground hover:bg-red-100 hover:text-red-500 transition-colors"
        onClick={onReset}
        aria-label="Reset timer to beginning"
        title="Reset timer to first work session"
      >
        <span className="material-icons">restart_alt</span>
      </Button>
      
      {/* Start/Pause button */}
      <Button
        variant="default"
        size="icon"
        className="w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-lg dark:text-primary-foreground/90"
        onClick={isRunning ? onPause : onStart}
        aria-label={isRunning ? "Pause timer" : "Start timer"}
      >
        <span className="material-icons text-3xl">
          {isRunning ? 'pause' : 'play_arrow'}
        </span>
      </Button>
      
      {/* Skip button */}
      <Button
        variant="outline"
        size="icon"
        className="w-12 h-12 rounded-full bg-muted text-foreground hover:bg-blue-100 hover:text-blue-500 transition-colors"
        onClick={onSkip}
        aria-label="Skip to next phase"
        title="Skip to next work/break session"
      >
        <span className="material-icons">skip_next</span>
      </Button>
    </div>
  );
}
