/**
 * Shareable practice plan progress report – snapshot encoding for URL.
 * Report page uses noindex, nofollow; only people with the link can view.
 */

import type { PracticePlanItem } from "./practicePlan";

export interface ReportSnapshotItem {
  text: string;
  checked: boolean;
  blockType?: string;
  children: ReportSnapshotItem[];
}

export interface ReportSnapshot {
  v: number;
  date: string; // ISO
  title?: string;
  items: ReportSnapshotItem[];
}

function itemToSnapshot(item: PracticePlanItem): ReportSnapshotItem {
  return {
    text: item.text,
    checked: item.checked ?? false,
    blockType: item.blockType,
    children: item.children.map(itemToSnapshot),
  };
}

export function createReportSnapshot(items: PracticePlanItem[], title?: string): ReportSnapshot {
  return {
    v: 1,
    date: new Date().toISOString(),
    title: title ?? "Progress Report",
    items: items.map(itemToSnapshot),
  };
}

function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  const pad = str.length % 4;
  const base64 = (str.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, pad ? 4 - pad : 0));
  return decodeURIComponent(escape(atob(base64)));
}


import LZString from "lz-string";

export function encodeReportToken(snapshot: ReportSnapshot): string {
  const json = JSON.stringify(snapshot);
  // Using compressToEncodedURIComponent for URL safety and compactness
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeReportToken(token: string): ReportSnapshot | null {
  try {
    // Try LZ-String decompression first (new format)
    const decompressed = LZString.decompressFromEncodedURIComponent(token);
    if (decompressed) {
      const data = JSON.parse(decompressed) as ReportSnapshot;
      if (data?.v === 1 && Array.isArray(data?.items)) return data;
    }
  } catch {
    // ignore
  }

  // Fallback to old format (base64)
  try {
    const json = base64UrlDecode(token);
    const data = JSON.parse(json) as ReportSnapshot;
    if (data?.v === 1 && Array.isArray(data?.items)) return data;
  } catch {
    // invalid or corrupted
  }
  return null;
}

export async function shareReport(snapshot: ReportSnapshot): Promise<string> {
  // In dev, Blobs often unavailable. Use legacy URL to avoid 500.
  // if (import.meta.env.DEV) {
  //   return getReportShareUrl(snapshot);
  // }

  const response = await fetch("/.netlify/functions/share-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });

  if (response.ok) {
    const data = await response.json();
    return getShortShareUrl(data.id);
  }

  // Log Blobs failure for debugging
  const errBody = await response.text();
  let errJson: { error?: string; detail?: string } = {};
  try {
    errJson = JSON.parse(errBody);
  } catch {}
  console.warn("[shareReport] Blobs failed:", response.status, errJson.detail || errBody);

  // Fallback if Blobs fails (e.g. unlinked site, MissingBlobsEnvironmentError)
  return getReportShareUrl(snapshot);
}

export function getShortShareUrl(id: string): string {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/r/${id}`;
}

export function getReportShareUrl(snapshot: ReportSnapshot): string {
  // Legacy URL generation (still useful as fallback or for local dev without functions)
  const token = encodeReportToken(snapshot);
  const base = typeof window !== "undefined" ? window.location.origin : "";
  // In dev: use hash so token isn't in path (avoids "Could not proxy request" with long URLs)
  if (import.meta.env.DEV) {
    return `${base}/report#${token}`;
  }
  return `${base}/report/${token}`;
}

