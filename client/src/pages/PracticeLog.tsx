import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getDailyBreakdownByWeek,
  getTodaySeconds,
  getThisWeekSeconds,
  formatDuration,
  formatDate,
} from "@/lib/practiceLog";
import { getSettings } from "@/lib/localStorage";
import "@/assets/headerBlur.css";

export default function PracticeLog() {
  const settings = getSettings();
  const weekStartsOn = settings?.weekStartsOn ?? "monday";
  const weekGroups = getDailyBreakdownByWeek(weekStartsOn);
  const todaySeconds = getTodaySeconds();
  const thisWeekSeconds = getThisWeekSeconds(weekStartsOn);

  return (
    <div className="text-foreground font-sans min-h-screen">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="rounded-2xl p-6 bg-gradient-to-t from-gray-800/40 to-black bg-[length:100%_200%] bg-[position:90%_100%] backdrop-blur-sm">
          <header className="relative p-4 flex items-center justify-between overflow-hidden">
            <div className="relative z-10 flex items-center justify-between w-full">
              <h1 className="text-2xl font-bold text-primary">Practice Time</h1>
              <Button variant="ghost" size="icon" asChild>
                <Link to="/">
                  <span className="material-icons text-primary hover:text-primary/80">
                    arrow_back
                  </span>
                </Link>
              </Button>
            </div>
          </header>

          <section className="p-6">
            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-xl font-semibold text-foreground">
                  Total practice time
                </h2>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="grid grid-cols-2 gap-4">
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
                </div>
                </div>
              </div>
              <div>
                <h2 className="mb-3 text-xl font-semibold text-foreground">
                  Daily breakdown
                </h2>
                {weekGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No practice sessions logged yet. Complete work sessions to
                    track your time.
                  </p>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {weekGroups.map(({ weekStart, weekLabel, days }) => (
                        <div key={weekStart}>
                          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {weekLabel}
                          </p>
                          <ul className="space-y-2">
                            {days.map(({ date, seconds }) => (
                              <li
                                key={date}
                                className="flex items-center justify-between rounded-lg border px-3 py-2"
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
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
