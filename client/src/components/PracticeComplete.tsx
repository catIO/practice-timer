import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PracticeCompleteProps {
  currentIteration: number;
  totalIterations: number;
  onStartNewSession: () => void;
}

export default function PracticeComplete({
  currentIteration,
  totalIterations,
  onStartNewSession
}: PracticeCompleteProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 min-h-[400px]">
      {/* Progress indicator */}
      <div className="text-center space-y-1">
        <h2 className="text-3xl font-bold text-white">
          {totalIterations} of {totalIterations} sessions completed
        </h2>
      </div>

      {/* Achievement icon */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-green-500/30 flex items-center justify-center">
            <Trophy className="w-12 h-12 text-green-400" />
          </div>
        </div>
      </div>

      {/* Completion message */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-white">
          Practice Complete!
        </h1>
        <p className="text-lg text-white/70">
          You've completed all {totalIterations} work sessions
        </p>
      </div>

      {/* Start new session button */}
      <Button
        onClick={onStartNewSession}
        size="lg"
        className="px-8 py-3 text-base font-semibold"
      >
        Start New Session
      </Button>
    </div>
  );
}
