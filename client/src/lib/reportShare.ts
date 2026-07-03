/**
 * Shareable practice plan progress report – snapshot encoding for URL.
 * Report page uses noindex, nofollow; only people with the link can view.
 */

import type { PracticePlanItem } from "./practicePlan";
import type { RepertoirePiece } from "./repertoire.types";
import { supabase } from "./supabaseClient";
import { nanoid } from "nanoid";

export interface ReportSnapshotItem {
  id?: string;
  text: string;
  checked: boolean;
  blockType?: string;
  children: ReportSnapshotItem[];
  segmentGoal?: string;
  allocatedTime?: number;
  allocationPeriod?: 'day' | 'week';
  repertoirePieceId?: string;
}

export interface ReportLogEntry {
  itemId: string;
  itemName: string;
  seconds: number;
}

export interface ReportLogSummary {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalSeconds: number;
  pieces: ReportLogEntry[];
}

export interface ReportSnapshot {
  v: number;
  date: string; // ISO
  title?: string;
  items: ReportSnapshotItem[];
  logSummary?: ReportLogSummary;
  embeddedPieces?: Record<string, RepertoirePiece>;
}

function itemToSnapshot(item: PracticePlanItem): ReportSnapshotItem {
  return {
    text: item.text,
    checked: item.checked ?? false,
    blockType: item.blockType,
    children: item.children.map(itemToSnapshot),
    repertoirePieceId: item.repertoirePieceId,
    ...(item.blockType === 'segment' ? {
      id: item.id,
      segmentGoal: item.segmentGoal,
      allocatedTime: item.allocatedTime,
      allocationPeriod: item.allocationPeriod,
    } : {}),
  };
}

export function createReportSnapshot(
  items: PracticePlanItem[],
  title?: string,
  logSummary?: ReportLogSummary,
  repertoirePieces?: RepertoirePiece[]
): ReportSnapshot {
  const snapshot: ReportSnapshot = {
    v: 1,
    date: new Date().toISOString(),
    title: title ?? "Practice Plan & Progress Report",
    items: items.map(itemToSnapshot),
    logSummary,
  };

  if (repertoirePieces && repertoirePieces.length > 0) {
    const embeddedPieceIds = new Set<string>();
    const collectPieceIds = (item: PracticePlanItem) => {
      if (item.repertoirePieceId) {
        embeddedPieceIds.add(item.repertoirePieceId);
      }
      item.children.forEach(collectPieceIds);
    };
    items.forEach(collectPieceIds);

    const embeddedPieces: Record<string, RepertoirePiece> = {};
    repertoirePieces.forEach((piece) => {
      if (embeddedPieceIds.has(piece.id)) {
        embeddedPieces[piece.id] = piece;
      }
    });

    if (Object.keys(embeddedPieces).length > 0) {
      snapshot.embeddedPieces = embeddedPieces;
    }
  }

  return snapshot;
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

export async function shareReport(snapshot: ReportSnapshot, id?: string): Promise<string> {
  const finalId = id || nanoid(10);

  // If supabase is configured, save the report there
  if (supabase) {
    try {
      // Check if user is logged in
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id || null;

      const { error } = await supabase
        .from("shared_reports")
        .insert({ id: finalId, user_id: userId, data: snapshot });

      if (!error) {
        // If shared anonymously, save the ID locally for later migration on login
        if (!userId && typeof window !== "undefined") {
          try {
            const localReports = JSON.parse(localStorage.getItem("local_shared_reports") || "[]");
            if (!localReports.includes(finalId)) {
              localReports.push(finalId);
              localStorage.setItem("local_shared_reports", JSON.stringify(localReports));
            }
          } catch (e) {
            console.warn("[shareReport] Failed to write to localStorage:", e);
          }
        }
        return getShortShareUrl(finalId);
      }
      console.warn("[shareReport] Supabase insert failed, trying fallback:", error);
    } catch (err) {
      console.warn("[shareReport] Supabase error, trying fallback:", err);
    }
  }

  // Fallback to Netlify Blobs in production if Supabase fails or is not configured
  if (!import.meta.env.DEV) {
    try {
      const response = await fetch("/.netlify/functions/share-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...snapshot, id: finalId }),
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
      } catch { }
      console.warn("[shareReport] Blobs failed:", response.status, errJson.detail || errBody);
    } catch (e) {
      console.warn("[shareReport] Fetch failed:", e);
    }
  }

  // Final fallback: generate a long token URL
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

