import {
  PlanItem,
  PlanSnapshot,
  generateId,
} from "./planTypes";
import {
  createPlanStoreApi,
  getPlanFromStorage,
  savePlanToStorage,
  savePlanSnapshot,
  getPlanSnapshots,
  resetPlanChecks,
} from "./planStoreHelpers";

const LESSON_PLAN_KEY = "practice-timer-lesson-plan";
const PERMANENT_SHARE_ID_KEY = "practice-timer-share-id";
const LAST_PUBLISHED_DATE_KEY = "practice-timer-last-published-date";
const SNAPSHOT_KEY = "practice-timer-lesson-plan-history";

export type { BlockType, PlanItem as LessonPlanItem, PlanSnapshot as LessonPlanSnapshot } from "./planTypes";

function generateDefaultLessonPlan(): PlanItem[] {
  return [
    {
      id: generateId(),
      text: "Lesson 1 Notes & Objectives",
      checked: false,
      children: [
        {
          id: generateId(),
          text: "Review warm-up routines & posture",
          checked: false,
          children: [],
          blockType: "todo",
        },
        {
          id: generateId(),
          text: "Focus areas for this week's practice",
          checked: false,
          children: [],
          blockType: "bullet",
        },
      ],
      blockType: "heading1",
      isHeader: true,
    },
  ];
}

export function getLessonPlan(): PlanItem[] {
  return getPlanFromStorage(LESSON_PLAN_KEY, generateDefaultLessonPlan);
}

export function saveLessonPlan(items: PlanItem[]): void {
  savePlanToStorage(LESSON_PLAN_KEY, items);
}

export function saveLessonSnapshot(items: PlanItem[]): void {
  savePlanSnapshot(SNAPSHOT_KEY, items);
}

export function getLessonSnapshots(): PlanSnapshot[] {
  return getPlanSnapshots(SNAPSHOT_KEY);
}

export function resetLessonPlanChecks(items: PlanItem[]): PlanItem[] {
  return resetPlanChecks(items);
}

export const lessonPlanApi = createPlanStoreApi(
  LESSON_PLAN_KEY,
  PERMANENT_SHARE_ID_KEY,
  LAST_PUBLISHED_DATE_KEY,
  generateDefaultLessonPlan
);
