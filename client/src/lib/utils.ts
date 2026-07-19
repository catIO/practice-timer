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

/**
 * Parses a URL string and returns a clean, human-readable preview.
 * Strips 'http://', 'https://', and 'www.' prefixes, and truncates
 * the path/query/hash if the total length exceeds 60 characters,
 * ensuring that the domain name itself is always fully visible.
 */
export function getUrlPreview(urlStr: string): string {
  if (!urlStr) return "";
  try {
    let cleanUrl = urlStr.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const parsed = new URL(cleanUrl);
    // Strip 'www.' if present
    const domain = parsed.hostname.replace(/^www\./i, '');
    
    // Construct path + search + hash
    const pathAndQuery = parsed.pathname + parsed.search + parsed.hash;
    
    const maxTotalLength = 60;
    const formattedUrl = domain + (pathAndQuery === '/' ? '' : pathAndQuery);
    
    if (formattedUrl.length <= maxTotalLength) {
      return formattedUrl;
    }
    
    // Keep domain visible and truncate path
    const domainLength = domain.length;
    if (domainLength >= maxTotalLength - 10) {
      // If domain itself is extremely long, truncate the whole string
      return formattedUrl.slice(0, maxTotalLength - 3) + "...";
    }
    
    // Otherwise, truncate path/query part, ensuring domain is intact
    const allowedPathLength = maxTotalLength - domainLength - 3; // 3 for "..."
    const truncatedPath = pathAndQuery.slice(0, allowedPathLength) + "...";
    return domain + truncatedPath;
  } catch (e) {
    if (urlStr.length > 60) {
      return urlStr.slice(0, 57) + "...";
    }
    return urlStr;
  }
}

