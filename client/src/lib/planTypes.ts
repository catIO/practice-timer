export type BlockType =
  | "text"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bullet"
  | "number"
  | "divider"
  | "todo"
  | "segment";

export interface PlanItem {
  id: string;
  text: string;
  checked: boolean;
  children: PlanItem[];
  /** When true, renders as a section header (no checkbox, bold). */
  isHeader?: boolean;
  /** Block style; default 'todo'. Headings set isHeader true. */
  blockType?: BlockType;
  allocatedTime?: number; // Target duration in minutes
  allocationPeriod?: "day" | "week";
  /** Goal description for practice segment blocks. */
  segmentGoal?: string;
  /** ID of linked repertoire piece, if any. */
  repertoirePieceId?: string;
  /** Practice video recording link (e.g. YouTube, Vimeo). */
  videoUrl?: string;
}

export interface PlanSnapshot {
  ts: number; // Unix ms
  items: PlanItem[];
}

export function generateId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
