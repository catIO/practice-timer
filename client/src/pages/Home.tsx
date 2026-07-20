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
import { stripMarkdownLinks } from "@/lib/richText";

import "@/assets/headerBlur.css";

export default function Home() {
  const navigate = useNavigate();
  const activePieceName = useTimerStore((state) => state.activePieceName);
  const pieceTimeRemaining = useTimerStore((state) => state.pieceTimeRemaining);
  const clearPiece = useTimerStore((state) => state.clearPiece);
  const isPiecePaused = useTimerStore((state) => state.isPiecePaused);
  const togglePausePiece = useTimerStore((state) => state.togglePausePiece);
  const isPieceOvertime = useTimerStore((state) => state.isPieceOvertime);
  const pieceOvertimeRunning = useTimerStore((state) => state.pieceOvertimeRunning);
  const startPieceOvertime = useTimerStore((state) => state.startPieceOvertime);
  const stopPieceOvertime = useTimerStore((state) => state.stopPieceOvertime);

  const formatSeconds = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  // Get settings from local storage
  const settings: SettingsType = getSettings();
  const audioInitialized = useTimerStore((state) => state.audioInitialized);
  const setAudioInitialized = useTimerStore((state) => state.setAudioInitialized);
  const [wakeLockActive, setWakeLockActive] = useState(false);
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
    if (isPracticeComplete) {
      // All sessions done — only the piece-only overtime interval should run.
      if (pieceOvertimeRunning) {
        stopPieceOvertime();
      } else {
        startPieceOvertime();
      }
      return;
    }
    if (isPieceOvertime) {
      // Main session ended (on break); toggle the piece-only overtime interval.
      if (pieceOvertimeRunning) {
        stopPieceOvertime();
      } else {
        startPieceOvertime();
      }
      return;
    }
    if (!isRunning) {
      await handleStart();
      if (isPiecePaused) {
        togglePausePiece();
      }
    } else {
      togglePausePiece();
    }
  }, [isPracticeComplete, isPieceOvertime, pieceOvertimeRunning, startPieceOvertime, stopPieceOvertime,
    isRunning, isPiecePaused, handleStart, togglePausePiece]);

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
      // Check if a wake lock is actually held (not just API presence)
      const hasNativeWakeLock = !!document.querySelector('[data-wake-lock="active"]');
      const hasWakeLockFallback = document.documentElement.getAttribute('data-wake-lock') === 'active';

      setWakeLockActive(hasNativeWakeLock || hasWakeLockFallback);
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



  return (
    <div className="space-y-8">
      {isPracticeComplete ? (
        <>
          {activePieceName && (
            <div className="w-full max-w-sm mx-auto rounded-lg bg-muted/40 border border-border/40 p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col min-w-0 items-start">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Active Piece (Overtime)</span>
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
                  title={pieceOvertimeRunning ? "Pause piece timer" : "Continue piece timer"}
                >
                  <span className="material-icons text-sm">
                    {pieceOvertimeRunning ? "pause" : "play_arrow"}
                  </span>
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
          <PracticeComplete
            currentIteration={currentIteration}
            totalIterations={totalIterations}
            onStartNewSession={handleResetAll}
          />
        </>
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
                  title={
                    isPieceOvertime
                      ? (pieceOvertimeRunning ? "Pause piece timer" : "Continue piece timer")
                      : ((isPiecePaused || !isRunning) ? "Resume piece timer" : "Pause piece timer")
                  }
                >
                  <span className="material-icons text-sm">
                    {isPieceOvertime
                      ? (pieceOvertimeRunning ? "pause" : "play_arrow")
                      : ((isPiecePaused || !isRunning) ? "play_arrow" : "pause")}
                  </span>
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
  );
}
