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

export function encodeReportToken(snapshot: ReportSnapshot): string {
  return base64UrlEncode(JSON.stringify(snapshot));
}

export function decodeReportToken(token: string): ReportSnapshot | null {
  try {
    const json = base64UrlDecode(token);
    const data = JSON.parse(json) as ReportSnapshot;
    if (data?.v === 1 && Array.isArray(data?.items)) return data;
  } catch {
    // invalid or corrupted
  }
  return null;
}

export function getReportShareUrl(snapshot: ReportSnapshot): string {
  const token = encodeReportToken(snapshot);
  return `${typeof window !== "undefined" ? window.location.origin : ""}/report/${token}`;
}
