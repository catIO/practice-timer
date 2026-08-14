import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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
  getSegmentCompletionsForRange,
  hasCompletedSegmentToday,
  hasPlayedSegmentInLast2Days,
  getCompletionPillColorClass,
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

  const [pieceSummaries, setPieceSummaries] = useState<PieceTimeSummary[]>([]);

  const thisWeekRange = getThisWeekRange(weekStartsOn);

  useEffect(() => {
    const planItems = getPracticePlan();
    const range = getThisWeekRange(weekStartsOn);
    const summaries = getPieceTimeForRange(range.start, range.end, planItems);
    
    summaries.sort((a, b) => {
      const compA = getSegmentCompletionsForRange(a.itemId, range.start, range.end);
      const compB = getSegmentCompletionsForRange(b.itemId, range.start, range.end);
      if (compA !== compB) {
        return compA - compB; // Lowest completion count first (needs practice most)
      }
      return b.seconds - a.seconds;
    });

    setPieceSummaries(summaries);
  }, [weekStartsOn, timeRemaining]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          Total practice time
        </h2>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
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
      
      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <TabsTrigger value="weekly">Weekly breakdown</TabsTrigger>
          <TabsTrigger value="daily">Daily breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-2 mt-0">
          {pieceSummaries.length === 0 ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">
                No piece-specific time logged for this week.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pieceSummaries.map((summary) => {
                const completions = getSegmentCompletionsForRange(summary.itemId, thisWeekRange.start, thisWeekRange.end);
                const playedInLast2Days = hasPlayedSegmentInLast2Days(summary.itemId);
                
                return (
                  <div
                    key={summary.itemId}
                    className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                      <span className="truncate text-foreground min-w-0 pr-2">
                        <TextWithLinks text={summary.itemName} />
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 select-none flex-wrap">
                        {completions > 0 && (
                          <span className={cn(
                            "inline-flex items-center h-[22px] px-2 rounded-full text-xs font-semibold font-mono tracking-tight shrink-0 select-none border transition-colors",
                            getCompletionPillColorClass(completions, playedInLast2Days)
                          )}>
                            <span className="material-icons text-[13px] mr-1 shrink-0 select-none" aria-hidden="true">
                              replay
                            </span>
                            {completions} {completions === 1 ? 'time' : 'times'}
                          </span>
                        )}
                        {summary.seconds > 0 && (
                          <span className="inline-flex items-center h-[22px] bg-primary/10 border border-primary/25 text-primary px-2 rounded-full text-xs font-semibold font-mono tracking-tight shrink-0 select-none">
                            {formatDuration(summary.seconds)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="daily" className="space-y-2 mt-0">
          {last10Days.length === 0 ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">
                No practice sessions logged yet. Complete work sessions to track your time.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {last10Days.map(({ date, seconds }) => (
                <li
                  key={date}
                  className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
