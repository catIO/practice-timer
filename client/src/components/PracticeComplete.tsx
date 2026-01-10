import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";

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

      {/* Action button */}
      <Button
        onClick={onStartNewSession}
        className="bg-green-500 hover:bg-green-600 text-white px-8 py-6 text-lg font-medium rounded-xl flex items-center gap-3"
        size="lg"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Start New Session
      </Button>
    </div>
  );
}
