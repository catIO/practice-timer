import { useEffect, useCallback, useState, useRef } from "react";
import Timer from "@/components/Timer";
import TimerControls from "@/components/TimerControls";
import IterationTracker from "@/components/IterationTracker";
import PracticeComplete from "@/components/PracticeComplete";
import { useTimer } from "@/hooks/useTimer";
import { useNotification } from "@/hooks/useNotification";
import { playSound } from "@/lib/soundEffects";
import { useToast } from "@/hooks/use-toast";
import { SettingsType } from "@/lib/timerService";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { resumeAudioContext } from "@/lib/soundEffects";
import { getSettings } from "@/lib/localStorage";
import { iOSBackgroundInstructions } from "@/components/IOSBackgroundInstructions";
import { cleanupWakeLockFallback } from "@/lib/wakeLockFallback";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/stores/timerStore";
import { PracticePlanPane } from "@/components/PracticePlanPane";
import { TextWithLinks } from "@/components/TextWithLinks";

import "@/assets/headerBlur.css";

const stripMarkdownLinks = (str: string) => {
  return str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
};

export default function Home() {
  const navigate = useNavigate();
  const activePieceName = useTimerStore((state) => state.activePieceName);
  const pieceTimeRemaining = useTimerStore((state) => state.pieceTimeRemaining);
  const clearPiece = useTimerStore((state) => state.clearPiece);
  const isPiecePaused = useTimerStore((state) => state.isPiecePaused);
  const togglePausePiece = useTimerStore((state) => state.togglePausePiece);

  const formatSeconds = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  // Get settings from local storage
  const settings: SettingsType = getSettings();
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [planPaneOpen, setPlanPaneOpen] = useState(false);
  // Setup notifications and toast
  const { toast } = useToast();
  const { showNotification, showTimerCompletionNotification } = useNotification();

  // Initialize audio context on user interaction
  const initializeAudio = async () => {
    if (!audioInitialized) {
      try {
        const resumed = await resumeAudioContext();
        if (resumed) {
          setAudioInitialized(true);
          console.log('Audio context initialized on user interaction');
        } else {
          console.error('Failed to initialize audio context on user interaction');
          toast({
            title: "Audio Initialization Failed",
            description: "Please ensure your browser allows audio playback for this site.",
            variant: "destructive",
            duration: 5000,
          });
        }
      } catch (error) {
        console.error('Error initializing audio:', error);
        toast({
          title: "Audio Initialization Failed",
          description: "Please ensure your browser allows audio playback for this site.",
          variant: "destructive",
          duration: 5000,
        });
      }
    }
  };

  // Audio will be initialized only when the play button is clicked
  // This prevents unnecessary audio initialization on other interactions like skip, reset, etc.

  const {
    timeRemaining,
    totalTime,
    isRunning,
    mode,
    startTimer,
    pauseTimer,
    resetTimer,
    skipTimer,
    currentIteration,
    totalIterations,
    isPracticeComplete,
    startNewSession
  } = useTimer({
    initialSettings: settings,
    onComplete: useCallback(async () => {
      try {

        // Timer completion callback
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        const detectIPad = (): boolean => {
          if (/iPad/.test(navigator.userAgent)) {
            return true;
          }
          if (/Macintosh/.test(navigator.userAgent)) {
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
              const minDimension = Math.min(window.screen.width, window.screen.height);
              const maxDimension = Math.max(window.screen.width, window.screen.height);
              if (minDimension >= 768 && maxDimension >= 1024) {
                return true;
              }
            }
          }
          return false;
        };
        const isIPad = detectIPad();



        if (isIOS || isIPad) {
          // iOS: Try notification sounds first, then direct audio as fallback



          // Try notification first
          try {
            await showTimerCompletionNotification({
              numberOfBeeps: settings.numberOfBeeps,
              volume: settings.volume,
              soundType: settings.soundType
            });
          } catch (error) {
            // Notification error
          }

          // Also try direct audio playback as fallback
          try {

            // Force re-initialize audio context for iPad
            await initializeAudio();

            // Add a small delay to ensure audio context is ready
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try the complex audio system first
            await playSound('end', settings.numberOfBeeps, settings.volume, settings.soundType as any);


            // Also try a simple HTML5 audio fallback for iPad
            try {


              const audio = new Audio();
              audio.volume = settings.volume / 100;

              // Create a simple beep sound using oscillator
              const context = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = context.createOscillator();
              const gainNode = context.createGain();

              oscillator.connect(gainNode);
              gainNode.connect(context.destination);

              oscillator.frequency.setValueAtTime(800, context.currentTime);
              gainNode.gain.setValueAtTime(settings.volume / 100, context.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

              oscillator.start(context.currentTime);
              oscillator.stop(context.currentTime + 0.5);


            } catch (simpleAudioError) {

            }
          } catch (audioError) {

          }
        } else {
          // Non-iOS: Use regular audio

          try {
            await playSound('end', settings.numberOfBeeps, settings.volume, settings.soundType as any);

          } catch (error) {

          }
        }


        try {
          toast({
            title: 'Timer Complete',
            description: 'Your timer has finished!',
          });

        } catch (toastError) {

        }


      } catch (error) {

      }
    }, [settings.numberOfBeeps, settings.volume, settings.soundType, toast, showTimerCompletionNotification, audioInitialized, initializeAudio])
  });

  // Handle reset all (reset to first iteration)
  const handleResetAll = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Handle reset current (keep current iteration)
  const handleResetCurrent = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Handle skip current session - disable button while skipping to prevent rapid clicks
  const { isSkipping } = useTimerStore();
  const handleSkip = useCallback(() => {
    // Don't allow skip if already skipping
    if (isSkipping) {
      console.log('Skip already in progress, ignoring click');
      return;
    }
    skipTimer();
  }, [skipTimer, isSkipping]);

  // Cleanup wake locks when component unmounts
  useEffect(() => {
    return () => {
      cleanupWakeLockFallback();
    };
  }, []);

  // Handle start timer
  const handleStart = useCallback(async () => {
    // Initialize audio context first when play button is clicked
    console.log('Play button clicked - initializing audio for cross-platform compatibility');

    try {
      await initializeAudio();
    } catch (error) {
      console.error('Error initializing audio on play button:', error);
    }

    // Then start the timer
    startTimer();
  }, [startTimer, initializeAudio]);

  // Handle pause timer
  const handlePause = useCallback(() => {
    pauseTimer();
  }, [pauseTimer]);

  // Handle piece timer play/pause — also starts main timer if it's not running
  const handlePiecePlayPause = useCallback(async () => {
    if (!isRunning) {
      await handleStart();
      if (isPiecePaused) {
        togglePausePiece();
      }
    } else {
      togglePausePiece();
    }
  }, [isRunning, isPiecePaused, handleStart, togglePausePiece]);

  // Handle settings navigation
  const handleSettingsClick = useCallback(() => {
    if (isRunning) {
      pauseTimer();
    }
    navigate('/settings');
  }, [isRunning, pauseTimer, navigate]);

  // Handle practice log navigation
  const handlePracticeLogClick = useCallback(() => {
    // Allowing timer to continue running while user checks their practice log
    navigate('/practice-log');
  }, [navigate]);


  // Monitor wake lock status
  useEffect(() => {
    const checkWakeLockStatus = () => {
      // Check if any wake lock is active
      const hasNativeWakeLock = 'wakeLock' in navigator;
      const hasWakeLockFallback = document.querySelector('[data-wake-lock="active"]');

      setWakeLockActive(hasNativeWakeLock || !!hasWakeLockFallback);
    };

    // Check initially
    checkWakeLockStatus();

    // Check periodically when timer is running
    const intervalId = isRunning ? setInterval(checkWakeLockStatus, 5000) : null;

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning]);



  if (!planPaneOpen) {
    return (
      <div className="text-foreground font-sans min-h-screen">
        <div className="max-w-2xl mx-auto pt-8">
          <div className="rounded-2xl p-6 bg-gradient-to-t from-gray-800/40 to-black bg-[length:100%_200%] bg-[position:90%_100%] backdrop-blur-sm">
            <header className="relative p-4 flex items-center justify-between overflow-hidden">
              <div className="relative z-10 flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Link to="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
                    <svg
                      className="h-6 w-auto fill-current"
                      viewBox="0 0 46 79"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M20.7463 39.5L1.33284 67.4349C0.536414 68.5779 0.0956646 69.8593 0.0138686 71.1723C-0.0679757 72.4759 0.21219 73.8015 0.860683 75.0421C1.50601 76.2763 2.43777 77.265 3.5585 77.9452C4.68857 78.6285 5.99183 79 7.37697 79H38.623C40.0082 79 41.3114 78.6285 42.4415 77.9452C43.5622 77.2651 44.4908 76.2795 45.1393 75.0421C45.7878 73.8015 46.0648 72.4759 45.9861 71.1723C45.9043 69.8593 45.4604 68.581 44.6672 67.4349L25.2537 39.5L44.6672 11.5651C45.4636 10.4221 45.9043 9.14066 45.9861 7.82767C46.068 6.5241 45.7878 5.19853 45.1393 3.95792C44.494 2.72368 43.5622 1.73496 42.4415 1.05481C41.3114 0.371548 40.0082 0 38.623 0H7.37697C5.99183 0 4.68865 0.371548 3.5585 1.05481C2.43785 1.73492 1.50917 2.72046 0.860683 3.95792C0.212206 5.19853 -0.0647845 6.5241 0.0138686 7.82767C0.095713 9.14066 0.539573 10.419 1.33284 11.5651L20.7463 39.5Z"
                      />
                    </svg>
                    <h1 className="text-2xl font-bold">Practice Mate</h1>
                  </Link>
                  {/* Wake Lock Status Indicator */}
                  {isRunning && (
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      wakeLockActive ? "bg-gray-400 animate-pulse" : "bg-gray-600"
                    )} title={wakeLockActive ? "Wake lock active" : "Wake lock inactive"} />
                  )}
                  {/* Audio Status Indicator */}
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    audioInitialized ? "bg-green-400" : "bg-gray-600"
                  )} title={audioInitialized ? "Audio ready" : "Audio not ready"} />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary hover:text-primary/80"
                    onClick={() => navigate("/practice-plan")}
                    aria-label="Practice plan"
                    title="Practice plan"
                  >
                    <span className="material-icons">assignment_add</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary hover:text-primary/80"
                    onClick={() => navigate("/repertoire")}
                    aria-label="Repertoire"
                    title="Repertoire"
                  >
                    <span className="material-icons">library_music</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary hover:text-primary/80"
                    onClick={handlePracticeLogClick}
                    aria-label="View practice log"
                    title="Practice log"
                  >
                    <span className="material-icons font-semibold">history</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary hover:text-primary/80"
                    onClick={handleSettingsClick}
                  >
                    <span className="material-icons">settings</span>
                  </Button>
                </div>
              </div>
            </header>

            <main className="p-6">
              <div className="space-y-8">
                {isPracticeComplete ? (
                  <PracticeComplete
                    currentIteration={currentIteration}
                    totalIterations={totalIterations}
                    onStartNewSession={startNewSession}
                  />
                ) : (
                  <div className="flex flex-col items-center space-y-6">
                    {activePieceName && (
                      <div className="w-full max-w-sm rounded-lg bg-muted/40 border border-border/40 p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex flex-col min-w-0 items-start">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Active Piece</span>
                          <span className="text-sm font-semibold truncate text-foreground max-w-[180px]" title={activePieceName ? stripMarkdownLinks(activePieceName) : ""}>
                            <TextWithLinks text={activePieceName || ""} />
                          </span>
                          <span className="text-lg font-bold text-primary font-mono mt-0.5">{formatSeconds(pieceTimeRemaining)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={handlePiecePlayPause}
                            title={(isPiecePaused || !isRunning) ? "Resume piece timer" : "Pause piece timer"}
                          >
                            <span className="material-icons text-sm">{(isPiecePaused || !isRunning) ? "play_arrow" : "pause"}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-semibold"
                            onClick={() => { clearPiece(); }}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    )}

                    <Timer
                      timeRemaining={timeRemaining}
                      totalTime={totalTime}
                      mode={mode}
                      isRunning={isRunning}
                    />

                    <TimerControls
                      isRunning={isRunning}
                      onStart={handleStart}
                      onPause={handlePause}
                      onReset={handleResetAll}
                      onSkip={handleSkip}
                      skipDisabled={isSkipping}
                    />

                    <IterationTracker
                      currentIteration={currentIteration}
                      totalIterations={totalIterations}
                      mode={mode}
                    />
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PracticePlanPane
      open={planPaneOpen}
      onOpenChange={setPlanPaneOpen}
      timeRemaining={timeRemaining}
      totalTime={totalTime}
      mode={mode}
      isRunning={isRunning}
      isPracticeComplete={isPracticeComplete}
      onStart={handleStart}
      onPause={handlePause}
      onSkip={skipTimer}
      onStartNewSession={startNewSession}
    />
  );
}
