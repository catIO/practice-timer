# Practice Mate

A practice timer, planning, and logging application for musicians — built with React, TypeScript, and Vite, deployed on Netlify.

## Features

- **Pomodoro Timer**: Work and break sessions with customizable durations
- **Iteration Tracking**: Track multiple work/break cycles
- **Segment Timer**: Per-piece countdown within a session — set a daily/weekly goal for each practice plan item, and a dedicated timer tracks time remaining, auto-checks the item on completion, and supports overtime mode
- **Practice Plans**: Create and manage structured practice routines with drag-and-drop reordering
- **Practice Log**: Record and review past practice sessions with per-piece breakdowns
- **Repertoire Management**: Track pieces with notes, scores, and YouTube links
- **Shared Reports**: Generate shareable practice reports
- **Sound Notifications**: Audio alerts when sessions complete
- **Browser Notifications**: Desktop notifications for session completion
- **PWA Support**: Install as a Progressive Web App
- **iOS Background Support**: Enhanced background functionality for iOS devices
- **Dark Mode**: Automatic theme switching
- **Wake Lock**: Prevents screen lock while the timer is running
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui (Radix primitives) |
| State | Zustand, TanStack React Query |
| Auth & DB | Supabase |
| Backend | Netlify Functions (serverless) |
| Timer | Web Workers for accuracy, Service Workers for PWA |
| Deployment | Netlify |

## Project Structure

```
client/          → React SPA (Vite)
  src/
    components/  → UI components
    pages/       → Route pages
    hooks/       → Custom hooks (timer, notifications, etc.)
    lib/         → Services & utilities
    stores/      → Zustand stores
    workers/     → Web Worker for timer
  public/        → PWA manifest, service worker, icons
netlify/
  functions/     → Serverless API endpoints
server/          → Local dev server (Express)
shared/          → Shared schema
supabase/
  migrations/    → Database migrations
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts both the Express server and the Vite dev server concurrently.

### Build

```bash
npm run build
```

### Testing

```bash
# Run all tests (client + Netlify functions)
npm run test:all

# Run client tests in watch mode
npm run test

# Run client tests once
npm run test:run

# Run Netlify function tests only
npm run test:functions
```

Tests use [Vitest](https://vitest.dev/) with React Testing Library for component tests and jsdom for the browser environment.

### Deployment

The app deploys to Netlify. Push to the connected branch and Netlify builds automatically using the config in `netlify.toml`.

## iOS Background Functionality

### Overview

This app includes enhanced background functionality specifically designed to work around iOS limitations for web apps. While iOS has strict restrictions on background execution for web applications, we've implemented several strategies to maximize timer reliability.

### What Works on iOS

✅ **PWA Installation**: Install the app to your home screen for better performance  
✅ **Background Notifications**: Receive notifications when timer completes  
✅ **State Persistence**: Timer state is saved and restored when app becomes active  
✅ **Audio Alerts**: Sound notifications work when app is in background (limited time)  
✅ **Background Sync**: Service worker attempts to maintain timer state  
✅ **iOS-Specific Timer**: Dedicated background timer implementation for iOS devices  
✅ **Enhanced Wake Lock**: Multiple strategies to prevent screen timeout  

### iOS Limitations

❌ **Continuous Background Execution**: iOS prevents web apps from running continuously in background  
❌ **Accurate Background Timers**: Timer accuracy decreases when app is backgrounded  
❌ **Wake Locks**: iOS doesn't support wake locks for web apps  
❌ **Background Audio**: Limited to a few minutes of background audio playback  

### iOS Optimization Features

The app includes several iOS-specific optimizations:

1. **iOS Background Timer**: Dedicated timer implementation with drift correction
2. **iOS Wake Lock**: Multiple strategies to prevent screen timeout
3. **State Synchronization**: Syncs timer state when app becomes active
4. **Service Worker Background Sync**: Attempts to maintain timer state in background
5. **Enhanced Notifications**: Rich notifications with action buttons
6. **PWA Manifest**: Optimized for iOS installation and background performance

### iOS Setup Instructions

When using the app on iOS, you'll see optimization tips that guide you through:

1. **Enable Background App Refresh**: Go to Settings > General > Background App Refresh
2. **Install as App**: Add to home screen for better background performance
3. **Enable Notifications**: Allow notifications for timer completion alerts
4. **Keep Wi-Fi Connected**: Ensure stable internet connection
5. **Disable Low Power Mode**: For more reliable background operation

### Best Practices for iOS Users

- **Install as PWA**: Use "Add to Home Screen" for the best experience
- **Keep App Active**: Minimize backgrounding for most accurate timing
- **Enable Notifications**: Allow notifications to get alerts when timer completes
- **Check Timer on Return**: The app will sync and show accurate time when you return
- **Use Audio Alerts**: Keep volume on to hear completion sounds

### Technical Implementation

The iOS background functionality includes:

- **iOS Background Timer Class**: Manages timer state with drift correction and real-time sync
- **iOS Wake Lock**: Audio context and user activity simulation to prevent screen timeout
- **Service Worker**: Handles background sync and notifications
- **State Persistence**: Saves timer state to localStorage for restoration
- **Visibility API**: Detects when app becomes active/inactive
- **Timestamp-based Calculation**: Uses start time to calculate accurate elapsed time

### Detailed iOS Guide

For comprehensive information about iOS background operation, troubleshooting, and technical details, see [iOS Background Timer Operation Guide](docs/iOS-Background.md).

## Browser Support

- Chrome/Edge (full PWA support)
- Safari (iOS/macOS with limitations — see [iOS Background Guide](docs/iOS-Background.md))
- Firefox (good PWA support)
- Mobile browsers (varies by platform)

## License

ISC