import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Safe Notification API check
export function isNotificationSupported(): boolean {
  return typeof Notification !== 'undefined';
}

// Safe Notification permission check
export function getNotificationPermission(): string {
  try {
    if (!isNotificationSupported()) {
      return 'unsupported';
    }
    return Notification.permission;
  } catch (error) {
    console.log('Error accessing Notification.permission:', error);
    return 'unsupported';
  }
}
