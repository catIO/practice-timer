# Plan: User-Prompted Update Notification (Toast)

This plan outlines the steps to transition the service worker update flow from an automatic silent reload to a user-friendly, Radix UI-based toast notification with an **"Update"** action button.

## Proposed Changes

### 1. Service Worker (`client/public/sw.js`)
* **Remove automatic activation:** Remove `self.skipWaiting()` from the `'install'` event listener so that a newly installed service worker waits in the background until prompted.
* **Listen for update message:** Listen for a custom `'message'` event from the client side containing the type `'SKIP_WAITING'`, and invoke `self.skipWaiting()` only upon receiving it.

```diff
 // Install event - cache static assets
 self.addEventListener('install', (event) => {
-  self.skipWaiting();
   event.waitUntil(
     caches.open(CACHE_NAME)
       .then(cache => {
```

```javascript
// Message listener (append to sw.js)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

---

### 2. Service Worker Registration (`client/src/main.tsx`)
* **Dispatch custom event:** When a new service worker is found and successfully installs (entering the `installed`/`waiting` state), dispatch a custom window-level DOM event `sw-update-ready` with the registration details.
* **Retain reload listener:** Keep the `controllerchange` listener active, as it will naturally trigger the reload once the user clicks "Update" and the waiting service worker calls `skipWaiting()`.

```diff
   window.addEventListener('load', () => {
     navigator.serviceWorker.register('/sw.js')
       .then(registration => {
         console.log('SW registered: ', registration);
         
+        // Handle update checks and dispatch event when waiting
+        const listenForWaiting = (reg: ServiceWorkerRegistration) => {
+          reg.addEventListener('updatefound', () => {
+            const installingWorker = reg.installing;
+            if (installingWorker) {
+              installingWorker.addEventListener('statechange', () => {
+                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
+                  window.dispatchEvent(new CustomEvent('sw-update-ready', { detail: reg }));
+                }
+              });
+            }
+          });
+          // Also dispatch if a worker is already waiting from a previous session
+          if (reg.waiting) {
+            window.dispatchEvent(new CustomEvent('sw-update-ready', { detail: reg }));
+          }
+        };
+
+        listenForWaiting(registration);
+
         // Check for updates when app becomes visible
         document.addEventListener('visibilitychange', () => {
           if (document.visibilityState === 'visible') {
             registration.update().then(newReg => {
+              if (newReg) listenForWaiting(newReg);
             });
           }
         });
```

---

### 3. Toast Component (`client/src/App.tsx`)
* **Show Toast Notification:** Add an effect listener to `App.tsx` (or a main Layout component) that listens for the custom `sw-update-ready` event.
* **Radix UI Action:** Use the app's existing `useToast` hook and `ToastAction` component to present a persistent toast notification with an **"Update"** button that sends the `SKIP_WAITING` message to the waiting service worker.

```typescript
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

// Inside App component:
const { toast } = useToast();

useEffect(() => {
  const handleUpdate = (e: Event) => {
    const registration = (e as CustomEvent).detail as ServiceWorkerRegistration;
    const waitingWorker = registration.waiting;

    if (waitingWorker) {
      toast({
        title: "Update Available",
        description: "A new version of the app is ready. Click Update to apply changes.",
        action: (
          <ToastAction
            altText="Update"
            onClick={() => {
              waitingWorker.postMessage({ type: 'SKIP_WAITING' });
            }}
          >
            Update
          </ToastAction>
        ),
        duration: Infinity, // Persist until resolved
      });
    }
  };

  window.addEventListener('sw-update-ready', handleUpdate);
  return () => window.removeEventListener('sw-update-ready', handleUpdate);
}, [toast]);
```

---

## Verification Plan

### Manual Verification
1. Open the application in development mode or preview.
2. Modify a visible element in the frontend.
3. Build the application and register the updated service worker (by incrementing `CACHE_NAME` in `sw.js` or triggering `registration.update()`).
4. Verify that the **"Update Available"** toast appears on screen.
5. Click **"Update"** and verify that the page reloads and displays the updated frontend elements successfully.
