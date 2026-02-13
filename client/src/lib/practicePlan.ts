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

export function generateId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

import { getSettings } from "./localStorage";

function generateDefaultPlan(): PracticePlanItem[] {
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
      // Fallback to dynamic default if stored array is empty (optional edge case)
      // but usually we trust what's stored unless we want to force reset logic.
      // For now, respect stored value if valid.
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
  /** Add a header at the top or bottom of the root list */
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
  /** Insert a block at a specific root index. Index 0 = before first, items.length = after last. */
  insertRootAt: (
    items: PracticePlanItem[],
    index: number,
    blockType: BlockType,
    initialText?: string,
    newId?: string
  ): PracticePlanItem[] => {
    const newItem = createBlock(blockType, initialText, newId);
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
  /** Insert a new block of the given type immediately after the item with id. */
  insertBlockAfter: (
    items: PracticePlanItem[],
    afterItemId: string,
    blockType: BlockType,
    initialText?: string,
    newId?: string
  ): PracticePlanItem[] => {
    const path = findPathToId(items, afterItemId);
    if (path == null || path.length === 0) return items;
    const newItem = createBlock(blockType, initialText, newId);
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
  /**
   * Insert an existing block (with its children) immediately after the item with id.
   * Used for copy/paste operations where we already have a full PracticePlanItem subtree.
   */
  insertExistingAfter: (
    items: PracticePlanItem[],
    afterItemId: string,
    toInsert: PracticePlanItem
  ): PracticePlanItem[] => {
    const path = findPathToId(items, afterItemId);
    if (path == null || path.length === 0) return items;
    if (path.length === 1) {
      const rootIndex = path[0];
      const next = insertRootAfter(items, rootIndex, toInsert);
      savePracticePlan(next);
      return next;
    }
    const parentPath = path.slice(0, -1);
    const insertAtIndex = path[path.length - 1] + 1;
    const next = insertChildAtIndex(items, parentPath, insertAtIndex, toInsert);
    savePracticePlan(next);
    return next;
  },
  /** Insert a new block of the given type immediately before the item with id. */
  insertBlockBefore: (
    items: PracticePlanItem[],
    beforeItemId: string,
    blockType: BlockType,
    initialText?: string,
    newId?: string
  ): PracticePlanItem[] => {
    const path = findPathToId(items, beforeItemId);
    if (path == null || path.length === 0) return items;
    const newItem = createBlock(blockType, initialText, newId);
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
      const next = moveItemInTree(items, activeParentPath, oldIndex, newIndex);
      savePracticePlan(next);
      return next;
    }

    // When dragging a root item over a nested item (e.g. header over another header's children),
    // collision detection may hit the child instead of the parent. Treat as: move active root
    // to the position of the root that contains over.
    if (activePath.length === 1 && overPath.length >= 1) {
      const activeRootIndex = activePath[0];
      const overRootIndex = overPath[0];
      if (activeRootIndex !== overRootIndex) {
        const next = moveItemInTree(items, [], activeRootIndex, overRootIndex);
        savePracticePlan(next);
        return next;
      }
    }

    return items;
  },
};

function createBlock(blockType: BlockType, initialText?: string, id?: string): PracticePlanItem {
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
    id: id || generateId(),
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

function moveItemInTree(
  items: PracticePlanItem[],
  parentPath: number[],
  fromIndex: number,
  toIndex: number
): PracticePlanItem[] {
  if (parentPath.length === 0) {
    return arrayMove(items, fromIndex, toIndex);
  }
  const [index, ...rest] = parentPath;
  return items.map((item, i) => {
    if (i === index) {
      return {
        ...item,
        children: moveItemInTree(item.children, rest, fromIndex, toIndex),
      };
    }
    return item;
  });
}

function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
  return newArray;
}
