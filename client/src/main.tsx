import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from "@/components/ui/toaster";
import { useTimerStore } from "@/stores/timerStore";

import "./lib/authListener";
// In dev: unregister any existing SW so cached production assets don't block Vite
if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

// Request durable storage so the browser won't silently evict our data under quota pressure.
if (navigator.storage?.persist) {
  navigator.storage.persist();
}

// Register service worker only in production (avoids aggressive caching during dev)
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    // Don't reload if timer is running - avoid interrupting an active session
    const isRunning = useTimerStore.getState().isRunning;
    if (isRunning) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
        
        // Handle update checks and dispatch event when waiting
        const listenForWaiting = (reg: ServiceWorkerRegistration) => {
          reg.addEventListener('updatefound', () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  window.dispatchEvent(new CustomEvent('sw-update-ready', { detail: reg }));
                }
              });
            }
          });
          // Also dispatch if a worker is already waiting from a previous session
          if (reg.waiting) {
            window.dispatchEvent(new CustomEvent('sw-update-ready', { detail: reg }));
          }
        };

        listenForWaiting(registration);

        // Check for updates when app becomes visible
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().then(newReg => {
              const reg = (newReg as ServiceWorkerRegistration | undefined) || registration;
              if (reg.waiting) {
                window.dispatchEvent(new CustomEvent('sw-update-ready', { detail: reg }));
              }
            }).catch(err => {
              console.error('SW update check failed:', err);
            });
          }
        });

        // Also check for updates periodically (every 5 minutes)
        setInterval(() => {
          registration.update().then(newReg => {
            const reg = (newReg as ServiceWorkerRegistration | undefined) || registration;
            if (reg.waiting) {
              window.dispatchEvent(new CustomEvent('sw-update-ready', { detail: reg }));
            }
          }).catch(err => {
            console.log('Periodic SW update check skipped/failed:', err);
          });
        }, 5 * 60 * 1000);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>
);
