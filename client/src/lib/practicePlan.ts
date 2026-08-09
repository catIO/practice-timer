/**
 * Practice plan - nested todo list, stored in localStorage
 */

import { BlockType, PlanItem, PlanSnapshot, generateId } from "./planTypes";
import {
  createPlanStoreApi,
  getPlanFromStorage,
  savePlanToStorage,
  savePlanSnapshot,
  getPlanSnapshots,
  resetPlanChecks,
} from "./planStoreHelpers";
import { getSettings } from "./localStorage";

const PRACTICE_PLAN_KEY = "practice-timer-plan";
const PERMANENT_SHARE_ID_KEY = "practice-timer-share-id";
const LAST_PUBLISHED_DATE_KEY = "practice-timer-last-published-date";
const SNAPSHOT_KEY = "practice-timer-plan-history";

export type { BlockType, PlanItem as PracticePlanItem, PlanSnapshot } from "./planTypes";
export { generateId };

function generateDefaultPracticePlan(): PlanItem[] {
  const settings = getSettings();
  const iterations = settings.iterations;

  return Array.from({ length: iterations }, (_, i) => ({
    id: generateId(),
    text: `Work session ${i + 1}`,
    checked: false,
    children: [],
    blockType: "heading1",
    isHeader: true,
  }));
}

export function getPracticePlan(): PlanItem[] {
  return getPlanFromStorage(PRACTICE_PLAN_KEY, generateDefaultPracticePlan);
}

export function savePracticePlan(items: PlanItem[]): void {
  savePlanToStorage(PRACTICE_PLAN_KEY, items);
}

export function saveSnapshot(items: PlanItem[]): void {
  savePlanSnapshot(SNAPSHOT_KEY, items);
}

export function getSnapshots(): PlanSnapshot[] {
  return getPlanSnapshots(SNAPSHOT_KEY);
}

export function resetPracticePlanChecks(items: PlanItem[]): PlanItem[] {
  return resetPlanChecks(items);
}

export const practicePlanApi = createPlanStoreApi(
  PRACTICE_PLAN_KEY,
  PERMANENT_SHARE_ID_KEY,
  LAST_PUBLISHED_DATE_KEY,
  generateDefaultPracticePlan
);
