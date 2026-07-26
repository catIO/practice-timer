import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
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
    // Only reload if the user explicitly clicked the Update action in the toast
    if (!(window as any).__userInitiatedSWUpdate) return;
    // Don't reload if timer is running - avoid interrupting an active session
    const isRunning = useTimerStore.getState().isRunning;
    if (isRunning) return;
    refreshing = true;
    window.location.reload();
  });

  const notifyUpdateReady = (reg: ServiceWorkerRegistration) => {
    (window as any).__swWaitingRegistration = reg;
    window.dispatchEvent(new CustomEvent('sw-update-ready', { detail: reg }));
  };

  const setupRegistrationListeners = (reg: ServiceWorkerRegistration) => {
    // 1. If a worker is already waiting, dispatch immediately
    if (reg.waiting) {
      notifyUpdateReady(reg);
    }

    // 2. Attach statechange listener to an installing worker
    const attachWorkerListener = (worker: ServiceWorker) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
          notifyUpdateReady(reg);
        }
      });
    };

    if (reg.installing) {
      attachWorkerListener(reg.installing);
    }

    // 3. Watch for future updates (e.g. when reg.update() finds a new version)
    reg.addEventListener('updatefound', () => {
      if (reg.installing) {
        attachWorkerListener(reg.installing);
      }
    });
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
        setupRegistrationListeners(registration);

        // Check for updates when app becomes visible
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(err => {
              console.error('SW update check failed:', err);
            });
          }
        });

        // Also check for updates periodically (every 5 minutes)
        setInterval(() => {
          registration.update().catch(err => {
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
  </React.StrictMode>
);
