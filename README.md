# Practice Timer

A practice timer application built with React, TypeScript, and Vite.

## Features

- **Pomodoro Timer**: Work and break sessions with customizable durations
- **Iteration Tracking**: Track multiple work/break cycles
- **Sound Notifications**: Audio alerts when sessions complete
- **Browser Notifications**: Desktop notifications for session completion
- **PWA Support**: Install as a Progressive Web App
- **iOS Background Support**: Enhanced background functionality for iOS devices
- **Dark Mode**: Automatic theme switching
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## iOS Background Functionality

### Overview

This app includes enhanced background functionality specifically designed to work around iOS limitations for web apps. While iOS has strict restrictions on background execution for web applications, we've implemented several strategies to maximize timer reliability.

### What Works on iOS

✅ **PWA Installation**: Install the app to your home screen for better performance  
✅ **Background Notifications**: Receive notifications when timer completes  
✅ **State Persistence**: Timer state is saved and restored when app becomes active  
✅ **Audio Alerts**: Sound notifications work when app is in background (limited time)  
✅ **Background Sync**: Service worker attempts to maintain timer state  

### iOS Limitations

❌ **Continuous Background Execution**: iOS prevents web apps from running continuously in background  
❌ **Accurate Background Timers**: Timer accuracy decreases when app is backgrounded  
❌ **Wake Locks**: iOS doesn't support wake locks for web apps  
❌ **Background Audio**: Limited to a few minutes of background audio playback  

### iOS Optimization Features

The app includes several iOS-specific optimizations:

1. **Background Timer Utility**: Calculates accurate time based on start timestamp
2. **State Synchronization**: Syncs timer state when app becomes active
3. **Service Worker Background Sync**: Attempts to maintain timer state in background
4. **Enhanced Notifications**: Rich notifications with action buttons
5. **PWA Manifest**: Optimized for iOS installation and background performance

### iOS Setup Instructions

When using the app on iOS, you'll see optimization tips that guide you through:

1. **Install as App**: Add to home screen for better background performance
2. **Enable Notifications**: Allow notifications for timer completion alerts
3. **Check Volume**: Ensure device volume is on for audio alerts
4. **Background App Refresh**: Enable in iOS Settings for better background performance

### Best Practices for iOS Users

- **Install as PWA**: Use "Add to Home Screen" for the best experience
- **Keep App Active**: Minimize backgrounding for most accurate timing
- **Enable Notifications**: Allow notifications to get alerts when timer completes
- **Check Timer on Return**: The app will sync and show accurate time when you return
- **Use Audio Alerts**: Keep volume on to hear completion sounds

### Technical Implementation

The iOS background functionality includes:

- **Background Timer Class**: Manages timer state and calculates accurate elapsed time
- **Service Worker**: Handles background sync and notifications
- **State Persistence**: Saves timer state to localStorage for restoration
- **Visibility API**: Detects when app becomes active/inactive
- **Timestamp-based Calculation**: Uses start time to calculate accurate elapsed time

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## Technologies Used

- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Query** for data fetching
- **Service Workers** for PWA functionality
- **Web Workers** for timer accuracy

## Browser Support

- Chrome/Edge (full PWA support)
- Safari (iOS/macOS with limitations)
- Firefox (good PWA support)
- Mobile browsers (varies by platform)

## License

ISC