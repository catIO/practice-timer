import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TextWithLinks } from "@/components/TextWithLinks";
import {
  getDailyBreakdown,
  getTodaySeconds,
  getThisWeekSeconds,
  getLastWeekSeconds,
  formatDuration,
  formatDate,
  getPieceTimeForRange,
  getThisWeekRange,
  getLastWeekRange,
  PieceTimeSummary
} from "@/lib/practiceLog";
import { getPracticePlan } from "@/lib/practicePlan";
import { getSettings } from "@/lib/localStorage";
import { useTimerStore } from "@/stores/timerStore";
import "@/assets/headerBlur.css";

export default function PracticeLog() {
  // Subscribe to timeRemaining to seamlessly trigger re-renders every second
  // while the timer runs, dynamically refreshing the localStorage readouts below.
  const timeRemaining = useTimerStore((state) => state.timeRemaining);

  const settings = getSettings();
  const weekStartsOn = settings?.weekStartsOn ?? "monday";
  const last10Days = getDailyBreakdown().slice(0, 10);
  const todaySeconds = getTodaySeconds();
  const thisWeekSeconds = getThisWeekSeconds(weekStartsOn);
  const lastWeekSeconds = getLastWeekSeconds(weekStartsOn);

  const [selectedWeek, setSelectedWeek] = useState<'this' | 'last'>('this');
  const [pieceSummaries, setPieceSummaries] = useState<PieceTimeSummary[]>([]);

  useEffect(() => {
    const planItems = getPracticePlan();
    const range = selectedWeek === 'this' ? getThisWeekRange(weekStartsOn) : getLastWeekRange(weekStartsOn);
    const summaries = getPieceTimeForRange(range.start, range.end, planItems);
    summaries.sort((a, b) => b.seconds - a.seconds);
    setPieceSummaries(summaries);
  }, [selectedWeek, weekStartsOn, timeRemaining]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          Total practice time
        </h2>
        <div className="rounded-xl border border-white/5 bg-slate-900/30 p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Today
              </p>
              <p className="text-2xl font-bold text-primary">
                {formatDuration(todaySeconds)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                This week
              </p>
              <p className="text-2xl font-bold text-primary">
                {formatDuration(thisWeekSeconds)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Last week
              </p>
              <p className="text-2xl font-bold text-primary">
                {formatDuration(lastWeekSeconds)}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-foreground">
            Weekly breakdown by piece
          </h2>
          <div className="flex gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/40">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs rounded",
                selectedWeek === 'this' ? "bg-background text-primary shadow-sm font-semibold" : "text-muted-foreground"
              )}
              onClick={() => setSelectedWeek('this')}
            >
              This Week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs rounded",
                selectedWeek === 'last' ? "bg-background text-primary shadow-sm font-semibold" : "text-muted-foreground"
              )}
              onClick={() => setSelectedWeek('last')}
            >
              Last Week
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-900/30 p-4 space-y-4">
          {pieceSummaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No piece-specific time logged for this period.
            </p>
          ) : (
            <div className="space-y-4">
              {pieceSummaries.map((summary) => {
                const practicedMins = Math.round(summary.seconds / 60);
                const isWeekly = summary.allocationPeriod === 'week';
                
                let targetMins = 0;
                if (summary.allocatedTime) {
                  targetMins = isWeekly ? summary.allocatedTime : summary.allocatedTime * 7;
                }
                
                const percent = targetMins > 0 ? (practicedMins / targetMins) * 100 : 0;
                const roundedPercent = Math.round(percent);
                const exceeded = targetMins > 0 && practicedMins > targetMins;
                
                const progressText = targetMins > 0 
                  ? `${practicedMins} / ${targetMins} min (${roundedPercent}%)` 
                  : `${practicedMins} min (No limit)`;
                
                return (
                  <div key={summary.itemId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="truncate text-foreground max-w-[200px]">
                        <TextWithLinks text={summary.itemName} />
                      </span>
                      <span className={cn(
                        "font-mono",
                        exceeded ? "text-amber-500 font-bold" : "text-muted-foreground"
                      )}>
                        {progressText} {exceeded && "(limit exceeded)"}
                      </span>
                    </div>
                    
                    {targetMins > 0 && (
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden relative">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            exceeded ? "bg-amber-500" : "bg-primary"
                          )}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          Daily breakdown
        </h2>
        {last10Days.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No practice sessions logged yet. Complete work sessions to
            track your time.
          </p>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <ul className="space-y-2">
              {last10Days.map(({ date, seconds }) => (
                <li
                  key={date}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/30 px-4 py-3"
                >
                  <span className="text-sm font-medium">
                    {formatDate(date)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatDuration(seconds)}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
