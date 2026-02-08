# iOS Background Timer Operation Guide

## Overview

This guide explains how the Practice Mate app works on iOS devices and provides solutions for reliable background operation.

## iOS Background Limitations

iOS has strict limitations on background execution for web applications:

1. **Background App Refresh**: iOS may suspend web apps when they're not in the foreground
2. **JavaScript Execution**: Background JavaScript execution is limited
3. **Timer Accuracy**: `setInterval` and `setTimeout` may be throttled or paused
4. **Audio Context**: Audio contexts may be suspended in the background

## Solutions Implemented

### 1. iOS-Specific Background Timer

The app includes a dedicated iOS background timer implementation that:

- Uses multiple timing strategies for accuracy
- Persists timer state to localStorage
- Syncs with real time when the app becomes active
- Handles drift correction for timing accuracy
- Uses audio context to maintain background execution

### 2. Enhanced Wake Lock

Multiple wake lock strategies are implemented:

- Native Wake Lock API (when supported)
- Audio context-based wake lock
- User activity simulation
- Fullscreen mode (optional)

### 3. State Persistence

Timer state is automatically saved and restored:

- Timer duration and remaining time
- Current mode (work/break)
- Iteration progress
- Running state

## User Setup Instructions

### 1. Enable Background App Refresh

1. Open **Settings** on your iOS device
2. Go to **General** > **Background App Refresh**
3. Ensure **Background App Refresh** is turned ON
4. Find **Safari** in the list and enable it

### 2. Add to Home Screen (Recommended)

1. Open the timer app in Safari
2. Tap the **Share** button (📤)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** to install

This provides better background operation and prevents Safari from suspending the timer.

### 3. Keep Wi-Fi Connected

Ensure your device stays connected to Wi-Fi or cellular data for optimal performance.

### 4. Disable Low Power Mode (Optional)

Low Power Mode can limit background app refresh. Consider disabling it for more reliable timer operation.

## How It Works

### Background Detection

The app automatically detects when it goes to the background and:

1. Switches to a more frequent update interval (500ms)
2. Activates audio context to maintain execution
3. Persists timer state more frequently
4. Prepares for potential suspension

### Foreground Sync

When the app becomes active again:

1. Calculates actual elapsed time since backgrounding
2. Syncs timer state with real time
3. Applies drift correction if needed
4. Resumes normal operation

### Timer Completion

If the timer completes while the app is backgrounded:

1. Shows a notification (if enabled)
2. Stores completion state
3. Handles mode transitions (work → break, break → work)
4. Updates iteration count

## Troubleshooting

### Timer Seems Inaccurate

1. **Refresh the page** and start the timer again
2. **Keep the app open** for the first few seconds after starting
3. **Avoid switching apps** immediately after starting the timer
4. **Check Background App Refresh** settings

### Timer Stops When Backgrounded

1. **Enable Background App Refresh** for Safari
2. **Add the app to Home Screen** for better performance
3. **Keep Wi-Fi connected**
4. **Disable Low Power Mode**

### No Notifications

1. **Grant notification permissions** when prompted
2. **Check notification settings** in iOS Settings
3. **Ensure the app is added to Home Screen**

## Technical Details

### Audio Context Strategy

The app uses silent audio contexts to maintain background execution:

```javascript
// Create silent oscillator to keep audio context alive
const oscillator = audioContext.createOscillator();
const gainNode = audioContext.createGain();
gainNode.gain.setValueAtTime(0, audioContext.currentTime); // Silent
```

### State Persistence

Timer state is saved to localStorage with timestamps:

```javascript
const stateToPersist = {
  timeRemaining,
  startTime,
  mode,
  currentIteration,
  persistedAt: Date.now()
};
```

### Drift Correction

The app calculates and corrects timing drift:

```javascript
const actualTimeRemaining = this.calculateTimeRemaining();
const drift = actualTimeRemaining - previousTimeRemaining;
this.state.driftCorrection += drift;
```

## Best Practices

1. **Start the timer** and keep the app open for a few seconds
2. **Use "Add to Home Screen"** for the best experience
3. **Keep the device connected** to power and Wi-Fi
4. **Grant all permissions** when prompted
5. **Don't force-close Safari** while the timer is running

## Limitations

Even with these optimizations, iOS may still:

- Suspend the timer during extended background periods
- Limit background execution based on system resources
- Pause timers during low battery conditions
- Restrict background execution in certain scenarios

The app is designed to handle these limitations gracefully and provide the most reliable timer experience possible on iOS.

## Support

If you continue to experience issues:

1. Check that all setup steps have been completed
2. Try refreshing the page and starting the timer again
3. Ensure Background App Refresh is enabled
4. Consider using the "Add to Home Screen" option
5. Check that notifications are enabled

The timer will attempt to sync and correct any timing issues when you return to the app.
