/**
 * Practice plan - nested todo list, stored in localStorage
 */

const PRACTICE_PLAN_KEY = "practice-timer-plan";

export type BlockType =
  | "text"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bullet"
  | "number"
  | "todo";

export interface PracticePlanItem {
  id: string;
  text: string;
  checked: boolean;
  children: PracticePlanItem[];
  /** When true, renders as a section header (no checkbox, bold). */
  isHeader?: boolean;
  /** Block style; default 'todo'. Headings set isHeader true. */
  blockType?: BlockType;
}

function generateId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

import { getSettings } from "./localStorage";

function generateDefaultPlan(): PracticePlanItem[] {
  const settings = getSettings();
  const iterations = settings.iterations;

  const items: PracticePlanItem[] = [];
  for (let i = 0; i < iterations; i++) {
    items.push({
      id: generateId(),
      text: `Practice Session ${i + 1}`,
      checked: false,
      children: [],
      blockType: "heading1",
      isHeader: true,
    });
    // Add empty text line after header
    items.push({
      id: generateId(),
      text: "",
      checked: false,
      children: [],
      blockType: "text",
      isHeader: false,
    });
  }
  return items;
}

function cloneItem(item: PracticePlanItem): PracticePlanItem {
  return {
    ...item,
    isHeader: item.isHeader ?? (item.blockType != null && (item.blockType === "heading1" || item.blockType === "heading2" || item.blockType === "heading3")),
    children: item.children.map(cloneItem),
  };
}

function normalizeItem(item: PracticePlanItem): PracticePlanItem {
  const blockType = item.blockType ?? "todo";
  const isHeader = blockType === "heading1" || blockType === "heading2" || blockType === "heading3";
  return {
    ...item,
    blockType,
    isHeader: item.isHeader ?? isHeader,
    children: item.children.map(normalizeItem),
  };
}

export function getPracticePlan(): PracticePlanItem[] {
  try {
    const stored = localStorage.getItem(PRACTICE_PLAN_KEY);
    let raw: PracticePlanItem[];
    if (stored) {
      const parsed = JSON.parse(stored);
      raw = Array.isArray(parsed) ? parsed : generateDefaultPlan().map(cloneItem);
    } else {
      raw = generateDefaultPlan();
    }
    return raw.map(normalizeItem);
  } catch {
    return generateDefaultPlan().map(normalizeItem);
  }
}

export function savePracticePlan(items: PracticePlanItem[]): void {
  try {
    localStorage.setItem(PRACTICE_PLAN_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Failed to save practice plan:", e);
  }
}

export function resetPracticePlanChecks(items: PracticePlanItem[]): PracticePlanItem[] {
  return items.map((item) => ({
    ...item,
    checked: false,
    children: resetPracticePlanChecks(item.children),
  }));
}

function updateItemInTree(
  items: PracticePlanItem[],
  id: string,
  updater: (item: PracticePlanItem) => PracticePlanItem
): PracticePlanItem[] {
  return items.map((item) => {
    if (item.id === id) return updater(item);
    return {
      ...item,
      children: updateItemInTree(item.children, id, updater),
    };
  });
}

function deleteItemFromTree(
  items: PracticePlanItem[],
  id: string
): PracticePlanItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => ({
      ...item,
      children: deleteItemFromTree(item.children, id),
    }));
}

function addChildToItem(
  items: PracticePlanItem[],
  parentId: string,
  text: string
): PracticePlanItem[] {
  return items.map((item) => {
    if (item.id === parentId) {
      return {
        ...item,
        children: [
          ...item.children,
          {
            id: generateId(),
            text: text || "New item",
            checked: false,
            children: [],
            isHeader: false,
          },
        ],
      };
    }
    return {
      ...item,
      children: addChildToItem(item.children, parentId, text),
    };
  });
}

function getHeadingLevel(blockType?: BlockType): number {
  if (blockType === "heading1") return 1;
  if (blockType === "heading2") return 2;
  if (blockType === "heading3") return 3;
  return 99; // Not a header
}

export const practicePlanApi = {
  get: getPracticePlan,
  save: savePracticePlan,
  resetChecks: (items: PracticePlanItem[]): PracticePlanItem[] => {
    const next = resetPracticePlanChecks(items);
    savePracticePlan(next);
    return next;
  },
  toggleCheck: (items: PracticePlanItem[], id: string): PracticePlanItem[] => {
    const next = updateItemInTree(items, id, (item) =>
      item.isHeader ? item : { ...item, checked: !item.checked }
    );
    savePracticePlan(next);
    return next;
  },
  updateText: (items: PracticePlanItem[], id: string, text: string): PracticePlanItem[] => {
    const next = updateItemInTree(items, id, (item) => ({ ...item, text }));
    savePracticePlan(next);
    return next;
  },
  delete: (items: PracticePlanItem[], id: string): PracticePlanItem[] => {
    const next = deleteItemFromTree(items, id);
    savePracticePlan(next);
    return next;
  },
  addRoot: (items: PracticePlanItem[], text?: string): PracticePlanItem[] => {
    const next = [
      ...items,
      {
        id: generateId(),
        text: text || "New item",
        checked: false,
        children: [],
        isHeader: false,
      },
    ];
    savePracticePlan(next);
    return next;
  },
  addRootHeader: (items: PracticePlanItem[], text?: string): PracticePlanItem[] => {
    const next = [
      ...items,
      {
        id: generateId(),
        text: text || "New header",
        checked: false,
        children: [],
        isHeader: true,
      },
    ];
    savePracticePlan(next);
    return next;
  },
  addRootHeaderAt: (
    items: PracticePlanItem[],
    position: "top" | "bottom",
    text?: string
  ): PracticePlanItem[] => {
    const header: PracticePlanItem = {
      id: generateId(),
      text: text || "New header",
      checked: false,
      children: [],
      isHeader: true,
      blockType: "heading1",
    };
    const next =
      position === "top" ? [header, ...items] : [...items, header];
    savePracticePlan(next);
    return next;
  },
  addChild: (items: PracticePlanItem[], parentId: string, text?: string): PracticePlanItem[] => {
    const next = addChildToItem(items, parentId, text ?? "New sub-item");
    savePracticePlan(next);
    return next;
  },
  insertRootAt: (
    items: PracticePlanItem[],
    index: number,
    blockType: BlockType,
    initialText?: string
  ): PracticePlanItem[] => {
    const newItem = createBlock(blockType, initialText);
    const i = Math.max(0, Math.min(index, items.length));
    const next = [...items.slice(0, i), newItem, ...items.slice(i)];
    savePracticePlan(next);
    return next;
  },
  indent: (items: PracticePlanItem[], id: string): PracticePlanItem[] => {
    const path = findPathToId(items, id);
    if (path == null || path.length === 0) return items;
    if (path.length === 1) {
      const rootIndex = path[0];
      if (rootIndex <= 0) return items;
      const { items: without, removed } = removeAtPath(items, path);
      if (removed == null) return items;
      const prevIndex = rootIndex - 1;
      const next = without.map((item, i) =>
        i === prevIndex
          ? { ...item, children: [...item.children, removed] }
          : item
      );
      savePracticePlan(next);
      return next;
    }
    const parentPath = path.slice(0, -1);
    const childIndex = path[path.length - 1];
    if (childIndex <= 0) return items;
    const { items: without, removed } = removeAtPath(items, path);
    if (removed == null) return items;
    const next = insertChildAtPath(without, [...parentPath, childIndex - 1], removed, "end");
    savePracticePlan(next);
    return next;
  },
  unindent: (items: PracticePlanItem[], id: string): PracticePlanItem[] => {
    const path = findPathToId(items, id);
    if (path == null || path.length <= 1) return items;
    const { items: without, removed } = removeAtPath(items, path);
    if (removed == null) return items;
    const parentPath = path.slice(0, -1);
    const parentIndex = parentPath[0];
    const next = insertRootAfter(without, parentIndex, removed);
    savePracticePlan(next);
    return next;
  },
  insertBlockAfter: (
    items: PracticePlanItem[],
    afterItemId: string,
    blockType: BlockType,
    initialText?: string
  ): PracticePlanItem[] => {
    const path = findPathToId(items, afterItemId);
    if (path == null || path.length === 0) return items;
    const newItem = createBlock(blockType, initialText);
    if (path.length === 1) {
      const rootIndex = path[0];
      const next = insertRootAfter(items, rootIndex, newItem);
      savePracticePlan(next);
      return next;
    }
    const parentPath = path.slice(0, -1);
    const insertAtIndex = path[path.length - 1] + 1;
    const next = insertChildAtIndex(items, parentPath, insertAtIndex, newItem);
    savePracticePlan(next);
    return next;
  },
  insertBlockBefore: (
    items: PracticePlanItem[],
    beforeItemId: string,
    blockType: BlockType,
    initialText?: string
  ): PracticePlanItem[] => {
    const path = findPathToId(items, beforeItemId);
    if (path == null || path.length === 0) return items;
    const newItem = createBlock(blockType, initialText);
    if (path.length === 1) {
      const rootIndex = path[0];
      const next = [...items.slice(0, rootIndex), newItem, ...items.slice(rootIndex)];
      savePracticePlan(next);
      return next;
    }
    const parentPath = path.slice(0, -1);
    const insertAtIndex = path[path.length - 1];
    const next = insertChildAtIndex(items, parentPath, insertAtIndex, newItem);
    savePracticePlan(next);
    return next;
  },
  updateBlockType: (items: PracticePlanItem[], id: string, blockType: BlockType): PracticePlanItem[] => {
    const next = updateItemInTree(items, id, (item) => {
      const isHeader = blockType === "heading1" || blockType === "heading2" || blockType === "heading3";
      return { ...item, blockType, isHeader };
    });
    savePracticePlan(next);
    return next;
  },
  reorder: (items: PracticePlanItem[], activeId: string, overId: string): PracticePlanItem[] => {
    const activePath = findPathToId(items, activeId);
    const overPath = findPathToId(items, overId);

    if (!activePath || !overPath) return items;

    // Check if siblings by comparing parent paths
    const activeParentPath = activePath.slice(0, -1);
    const overParentPath = overPath.slice(0, -1);

    const isSiblings =
      activeParentPath.length === overParentPath.length &&
      activeParentPath.every((val, index) => val === overParentPath[index]);

    if (isSiblings) {
      const oldIndex = activePath[activePath.length - 1];
      const newIndex = overPath[overPath.length - 1];

      // NEW SECTION MOVE LOGIC
      // Get the list containing these siblings
      const parentList = getParamsAt(items, activeParentPath);

      const activeItem = parentList[oldIndex];
      const activeHeadingLevel = getHeadingLevel(activeItem.blockType);

      // If active item is a header, we want to move it AND its "section" (subsequent non-header items)
      // Section ends at next item with same or higher (lower number) heading level
      let count = 1;
      if (activeHeadingLevel < 99) {
        for (let i = oldIndex + 1; i < parentList.length; i++) {
          const sibling = parentList[i];
          const siblingLevel = getHeadingLevel(sibling.blockType);
          // Stop if sibling is a header of same or higher importance (smaller number)
          // e.g. if we are H2 (lev 2), stop at H1 (lev 1) or H2 (lev 2).
          // Continue if H3 (lev 3) or Text (lev 99).
          if (siblingLevel <= activeHeadingLevel) {
            break;
          }
          count++;
        }
      }

      // If count > 1, we are moving a range.
      // DND-Kit gives us a simple 'oldIndex' and 'newIndex' assuming single item swap.
      // If we move a block, we need to treat newIndex carefully.
      // Usually dragging DOWN: insert AFTER newIndex.
      // Dragging UP: insert BEFORE newIndex.

      const next = moveRangeInTree(items, activeParentPath, oldIndex, newIndex, count);
      savePracticePlan(next);
      return next;
    }

    return items;
  },
};

function createBlock(blockType: BlockType, initialText?: string): PracticePlanItem {
  const isHeader =
    blockType === "heading1" || blockType === "heading2" || blockType === "heading3";
  const defaultText: Record<BlockType, string> = {
    text: "Text",
    heading1: "Heading 1",
    heading2: "Heading 2",
    heading3: "Heading 3",
    bullet: "List item",
    number: "List item",
    todo: "To-do",
  };
  return {
    id: generateId(),
    text: initialText !== undefined ? initialText : defaultText[blockType],
    checked: false,
    children: [],
    isHeader,
    blockType,
  };
}

function insertChildAtIndex(
  items: PracticePlanItem[],
  parentPath: number[],
  index: number,
  toInsert: PracticePlanItem
): PracticePlanItem[] {
  const [i, ...rest] = parentPath;
  if (i < 0 || i >= items.length) return items;
  if (rest.length === 0) {
    const parent = items[i];
    const children = [...parent.children];
    children.splice(Math.max(0, Math.min(index, children.length)), 0, toInsert);
    return items.map((item, idx) =>
      idx === i ? { ...item, children } : item
    );
  }
  const newChildren = insertChildAtIndex(items[i].children, rest, index, toInsert);
  return items.map((item, idx) =>
    idx === i ? { ...item, children: newChildren } : item
  );
}

function findPathToId(
  items: PracticePlanItem[],
  id: string,
  path: number[] = []
): number[] | null {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) return [...path, i];
    const found = findPathToId(items[i].children, id, [...path, i]);
    if (found) return found;
  }
  return null;
}

function removeAtPath(
  items: PracticePlanItem[],
  path: number[]
): { items: PracticePlanItem[]; removed: PracticePlanItem | null } {
  if (path.length === 0) return { items, removed: null };
  const [index, ...rest] = path;
  if (index < 0 || index >= items.length) return { items, removed: null };
  if (rest.length === 0) {
    const removed = items[index];
    const next = items.filter((_, i) => i !== index);
    return { items: next, removed };
  }
  const { items: newChildren, removed } = removeAtPath(items[index].children, rest);
  const next = items.map((item, i) =>
    i === index ? { ...item, children: newChildren } : item
  );
  return { items: next, removed };
}

function insertChildAtPath(
  items: PracticePlanItem[],
  path: number[],
  toInsert: PracticePlanItem,
  where: "end"
): PracticePlanItem[] {
  const [index, ...rest] = path;
  if (index < 0 || index >= items.length) return items;
  if (rest.length === 0) {
    return items.map((item, i) =>
      i === index ? { ...item, children: [...item.children, toInsert] } : item
    );
  }
  const newChildren = insertChildAtPath(items[index].children, rest, toInsert, where);
  return items.map((item, i) => (i === index ? { ...item, children: newChildren } : item));
}

function insertRootAfter(
  items: PracticePlanItem[],
  afterIndex: number,
  toInsert: PracticePlanItem
): PracticePlanItem[] {
  const i = Math.max(0, Math.min(afterIndex + 1, items.length));
  return [...items.slice(0, i), toInsert, ...items.slice(i)];
}

/** Get the array at the given path */
function getParamsAt(items: PracticePlanItem[], path: number[]): PracticePlanItem[] {
  let current = items;
  for (const i of path) {
    current = current[i].children;
  }
  return current;
}

function moveRangeInTree(
  items: PracticePlanItem[],
  parentPath: number[],
  fromIndex: number,
  toIndex: number,
  count: number
): PracticePlanItem[] {
  if (parentPath.length === 0) {
    return arrayMoveRange(items, fromIndex, toIndex, count);
  }
  const [index, ...rest] = parentPath;
  return items.map((item, i) => {
    if (i === index) {
      return {
        ...item,
        children: moveRangeInTree(item.children, rest, fromIndex, toIndex, count)
      };
    }
    return item;
  });
}

/** 
 * Move a range of items from `from` index to `to` index.
 * Note: `to` is the index we want the *first* item of the group to land at, 
 * OR it's the index we dropped ONTO.
 * dnd-kit assumes "swap" or "place before/after". 
 * 
 * If we drag group A (idx 2-4) to loose item B (idx 8). `to` will be 8.
 * We want A to appear at 8?
 */
function arrayMoveRange<T>(array: T[], from: number, to: number, count: number): T[] {
  const newArray = array.slice();

  // Extract the chunk
  const chunk = newArray.splice(from, count);

  // Adjust insertion point: 
  // If we removed items BEFORE the target, the indices shifted down by 'count'.

  // But Dnd-kit `to` is based on the *original* indices usually?
  // Actually dnd-kit `over` is the item we are over.

  // Let's assume standard behavior:
  // If moving down (from < to): Insert after. The gap left by 'from' shifts 'to' down? 
  // No, if I remove at 2, item at 8 becomes 8-count?

  // `dnd-kit/sortable` `arrayMove` uses:
  // newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);

  // If moving DOWN: from=0, to=2. Remove 0. Item at 2 is now at 1. Insert at 2.
  // Result: 1, 2, 0. (Original 0 moved to end of 2).

  // With ranges:
  // Remove chunk at `from`.
  // If `to` > `from`, `to` index needs to shift down by `count`?

  // Wait, if I drag Item 0 (size 3) to Item 5.
  // array: 0, 1, 2, 3, 4, 5, 6
  // chunk: 0, 1, 2. Remainder: 3, 4, 5, 6.
  // I dropped "0" onto "5". Target is "5".
  // Index of 5 in remainder is 2.
  // Insert at 2? -> 3, 4, 0, 1, 2, 5, 6.
  // That places it BEFORE 5.

  // Usually we expect it to swap positions.

  let insertAt = to;
  if (from < to) {
    // Moving down. We removed `count` items before `to`.
    // So the target index in the `newArray` (after splice) is `to - count`?
    // BUT `to` might be INSIDE the chunk if we aren't careful? 
    // No, `to` is `over.id`. `over` cannot be dragged item (active.id). 
    // Can `over` be a child of dragged item? No, assuming reduced siblings list.

    insertAt -= count;

    // Also, we usually want to insert AFTER the target when moving down?
    // arrayMove behavior: splice(to, 0, item).
    // Example: [A, B, C]. Move A(0) to C(2).
    // Remove A. [B, C]. C is at 1.
    // Insert at 2?? [B, C, A]. Yes.
    // So if (from < to), we insert at `to`?
    // Wait. If remove A. C is at 1. To=2.
    // So we insert at 2.

    // With range: [A, A2, B, C]. Move A(0, count 2) to C(3).
    // Remove A, A2. [B, C]. C is at 1.
    // To=3. 
    // If we insert at 3? [B, C, undefined, A, A2]. Index out of bounds.

    // We need to map `to` to the new array coordinates.
    // logic: `to` is index in OLD array.
    // items UP TO `to` are shifted by `count` if they were after `from`.

    // Simple logic:
    // If we move DOWN, we want to place it AFTER the `to` item.
    // If we move UP, we want to place it BEFORE the `to` item.

    // Actually standard dnd-kit arrayMove logic:
    // return [...array.slice(0, from), ...array.slice(from + 1, to + 1), item, ...array.slice(to + 1)];
    // (Simplified logic)

    insertAt = to - count + 1; // Basic guess
  }

  // Let's use simpler index math:
  // If dragging Down (from < to):
  // We want to insert AFTER the item that was at `to`.
  // Since `to` was > `from`, the item at `to` has shifted down by `count`.
  // index in new array = `to - count`.
  // We want to insert AFTER it, so `to - count + 1`.

  // If dragging Up (from > to):
  // Checks out?
  // [A, B, C, D]. Drag C(2) to A(0).
  // Remove C. [A, B, D].
  // Insert at 0. [C, A, B, D].
  // so insertAt = to.

  if (from < to) {
    insertAt = to - count + 1;
  } else {
    insertAt = to;
  }

  newArray.splice(insertAt, 0, ...chunk);
  return newArray;
}
