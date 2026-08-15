import { BlockType, PlanItem, PlanSnapshot, generateId } from "./planTypes";
import { logSegmentCompletion, removeSegmentCompletionToday } from "./practiceLog";
import { scheduleUserDataPush } from "./userDataSync";

const MAX_SNAPSHOTS = 5;

export function cloneItem(item: PlanItem): PlanItem {
  return {
    ...item,
    isHeader:
      item.isHeader ??
      (item.blockType != null &&
        (item.blockType === "heading1" ||
          item.blockType === "heading2" ||
          item.blockType === "heading3")),
    children: item.children.map(cloneItem),
  };
}

export function normalizeItem(item: PlanItem): PlanItem {
  const blockType = item.blockType ?? "todo";
  const isHeader =
    blockType === "heading1" || blockType === "heading2" || blockType === "heading3";
  return {
    ...item,
    blockType,
    isHeader: item.isHeader ?? isHeader,
    children: item.children.map(normalizeItem),
  };
}

export function getPlanFromStorage(
  storageKey: string,
  defaultGenerator: () => PlanItem[]
): PlanItem[] {
  try {
    const stored = localStorage.getItem(storageKey);
    let raw: PlanItem[];
    if (stored) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(stored);
      } catch (parseErr) {
        console.error(`[planStore] Invalid JSON in localStorage key ${storageKey}:`, parseErr);
        raw = defaultGenerator().map(cloneItem);
        return raw.map(normalizeItem);
      }
      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          console.warn(`[planStore] Stored value is string for key ${storageKey}`);
          raw = defaultGenerator().map(cloneItem);
          return raw.map(normalizeItem);
        }
      }
      if (!Array.isArray(parsed)) {
        console.warn(`[planStore] Stored value is not array for key ${storageKey}`);
        raw = defaultGenerator().map(cloneItem);
      } else {
        raw = parsed as PlanItem[];
      }
    } else {
      raw = defaultGenerator();
    }
    return raw.map(normalizeItem);
  } catch (e) {
    console.error(`[planStore] Failed to load from localStorage (${storageKey}):`, e);
    return defaultGenerator().map(normalizeItem);
  }
}

export function savePlanToStorage(storageKey: string, items: PlanItem[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch (e) {
    console.error(`Failed to save plan to ${storageKey}:`, e);
  }
}

export function savePlanSnapshot(snapshotKey: string, items: PlanItem[]): void {
  try {
    const raw = localStorage.getItem(snapshotKey);
    const existing: PlanSnapshot[] = raw ? JSON.parse(raw) : [];
    const next = [...existing, { ts: Date.now(), items }].slice(-MAX_SNAPSHOTS);
    localStorage.setItem(snapshotKey, JSON.stringify(next));
  } catch {
    // Quota exceeded or parse error — skip silently
  }
}

export function getPlanSnapshots(snapshotKey: string): PlanSnapshot[] {
  try {
    const raw = localStorage.getItem(snapshotKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function resetPlanChecks(items: PlanItem[]): PlanItem[] {
  return items.map((item) => ({
    ...item,
    checked: false,
    checkedDate: undefined,
    children: resetPlanChecks(item.children),
  }));
}

export function updateItemInTree(
  items: PlanItem[],
  id: string,
  updater: (item: PlanItem) => PlanItem
): PlanItem[] {
  return items.map((item) => {
    if (item.id === id) return updater(item);
    return {
      ...item,
      children: updateItemInTree(item.children, id, updater),
    };
  });
}

export function deleteItemFromTree(items: PlanItem[], id: string): PlanItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => ({
      ...item,
      children: deleteItemFromTree(item.children, id),
    }));
}

export function addChildToItem(
  items: PlanItem[],
  parentId: string,
  text: string
): PlanItem[] {
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

export function createBlock(blockType: BlockType, initialText?: string, id?: string): PlanItem {
  const isHeader =
    blockType === "heading1" || blockType === "heading2" || blockType === "heading3";
  const defaultText: Record<BlockType, string> = {
    text: "",
    heading1: "",
    heading2: "",
    heading3: "",
    bullet: "",
    number: "",
    divider: "---",
    todo: "",
    segment: "",
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

export function findPathToId(
  items: PlanItem[],
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

export function removeAtPath(
  items: PlanItem[],
  path: number[]
): { items: PlanItem[]; removed: PlanItem | null } {
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

export function insertChildAtPath(
  items: PlanItem[],
  path: number[],
  toInsert: PlanItem,
  where: "end"
): PlanItem[] {
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

export function insertChildAtIndex(
  items: PlanItem[],
  parentPath: number[],
  index: number,
  toInsert: PlanItem
): PlanItem[] {
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

export function insertRootAfter(
  items: PlanItem[],
  afterIndex: number,
  toInsert: PlanItem
): PlanItem[] {
  const i = Math.max(0, Math.min(afterIndex + 1, items.length));
  return [...items.slice(0, i), toInsert, ...items.slice(i)];
}

export function moveItemInTree(
  items: PlanItem[],
  parentPath: number[],
  fromIndex: number,
  toIndex: number
): PlanItem[] {
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

export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
  return newArray;
}

export interface PlanStoreApi {
  get: () => PlanItem[];
  save: (items: PlanItem[]) => void;
  getPermalinkId: () => string | null;
  savePermalinkId: (id: string) => void;
  getLastPublishedDate: () => string | null;
  saveLastPublishedDate: (dateIso: string) => void;
  resetChecks: (items: PlanItem[]) => PlanItem[];
  toggleCheck: (items: PlanItem[], id: string) => PlanItem[];
  checkItem: (items: PlanItem[], id: string) => PlanItem[];
  uncheckItem: (items: PlanItem[], id: string) => PlanItem[];
  updateText: (items: PlanItem[], id: string, text: string) => PlanItem[];
  updateAllocation: (
    items: PlanItem[],
    id: string,
    allocatedTime: number | undefined,
    allocationPeriod: "day" | "week" | undefined
  ) => PlanItem[];
  delete: (items: PlanItem[], id: string) => PlanItem[];
  addRoot: (items: PlanItem[], text?: string) => PlanItem[];
  addRootHeader: (items: PlanItem[], text?: string) => PlanItem[];
  addRootHeaderAt: (items: PlanItem[], position: "top" | "bottom", text?: string) => PlanItem[];
  addChild: (items: PlanItem[], parentId: string, text?: string) => PlanItem[];
  insertRootAt: (
    items: PlanItem[],
    index: number,
    blockType: BlockType,
    initialText?: string,
    newId?: string
  ) => PlanItem[];
  indent: (items: PlanItem[], id: string) => PlanItem[];
  unindent: (items: PlanItem[], id: string) => PlanItem[];
  insertBlockAfter: (
    items: PlanItem[],
    afterItemId: string,
    blockType: BlockType,
    initialText?: string,
    newId?: string
  ) => PlanItem[];
  insertExistingAfter: (
    items: PlanItem[],
    afterItemId: string,
    toInsert: PlanItem
  ) => PlanItem[];
  insertBlockBefore: (
    items: PlanItem[],
    beforeItemId: string,
    blockType: BlockType,
    initialText?: string,
    newId?: string
  ) => PlanItem[];
  updateSegment: (
    items: PlanItem[],
    id: string,
    name: string,
    segmentGoal: string | undefined,
    allocatedTime: number | undefined,
    allocationPeriod: "day" | "week" | undefined,
    repertoirePieceId: string | undefined,
    videoUrl: string | undefined
  ) => PlanItem[];
  updateBlockType: (items: PlanItem[], id: string, blockType: BlockType) => PlanItem[];
  reorder: (items: PlanItem[], activeId: string, overId: string) => PlanItem[];
}

export function createPlanStoreApi(
  storageKey: string,
  permalinkKey: string,
  lastPublishedKey: string,
  defaultGenerator: () => PlanItem[]
): PlanStoreApi {
  const get = () => getPlanFromStorage(storageKey, defaultGenerator);
  const save = (items: PlanItem[]) => {
    savePlanToStorage(storageKey, items);
    scheduleUserDataPush();
  };

  return {
    get,
    save,
    getPermalinkId: () => localStorage.getItem(permalinkKey),
    savePermalinkId: (id: string) => localStorage.setItem(permalinkKey, id),
    getLastPublishedDate: () => localStorage.getItem(lastPublishedKey),
    saveLastPublishedDate: (dateIso: string) => localStorage.setItem(lastPublishedKey, dateIso),
    resetChecks: (items: PlanItem[]) => {
      const next = resetPlanChecks(items);
      save(next);
      return next;
    },
    toggleCheck: (items: PlanItem[], id: string) => {
      const next = updateItemInTree(items, id, (item) => {
        if (item.isHeader) return item;
        const newChecked = !item.checked;
        if (item.blockType === "segment") {
          if (newChecked) {
            logSegmentCompletion(item.id);
          } else {
            removeSegmentCompletionToday(item.id);
          }
        }
        return {
          ...item,
          checked: newChecked,
          checkedDate: newChecked ? (item.checkedDate || new Date().toISOString()) : undefined,
        };
      });
      save(next);
      return next;
    },
    checkItem: (items: PlanItem[], id: string) => {
      const next = updateItemInTree(items, id, (item) => {
        if (item.isHeader) return item;
        if (!item.checked && item.blockType === "segment") {
          logSegmentCompletion(item.id);
        }
        return {
          ...item,
          checked: true,
          checkedDate: item.checkedDate || new Date().toISOString(),
        };
      });
      save(next);
      return next;
    },
    uncheckItem: (items: PlanItem[], id: string) => {
      const next = updateItemInTree(items, id, (item) => {
        if (item.isHeader) return item;
        if (item.checked && item.blockType === "segment") {
          removeSegmentCompletionToday(item.id);
        }
        return { ...item, checked: false, checkedDate: undefined };
      });
      save(next);
      return next;
    },
    updateText: (items: PlanItem[], id: string, text: string) => {
      const next = updateItemInTree(items, id, (item) => ({ ...item, text }));
      save(next);
      return next;
    },
    updateAllocation: (items, id, allocatedTime, allocationPeriod) => {
      const next = updateItemInTree(items, id, (item) => ({
        ...item,
        allocatedTime,
        allocationPeriod,
      }));
      save(next);
      return next;
    },
    delete: (items, id) => {
      const next = deleteItemFromTree(items, id);
      save(next);
      return next;
    },
    addRoot: (items, text) => {
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
      save(next);
      return next;
    },
    addRootHeader: (items, text) => {
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
      save(next);
      return next;
    },
    addRootHeaderAt: (items, position, text) => {
      const header: PlanItem = {
        id: generateId(),
        text: text || "New header",
        checked: false,
        children: [],
        isHeader: true,
        blockType: "heading1",
      };
      const next = position === "top" ? [header, ...items] : [...items, header];
      save(next);
      return next;
    },
    addChild: (items, parentId, text) => {
      const next = addChildToItem(items, parentId, text ?? "New sub-item");
      save(next);
      return next;
    },
    insertRootAt: (items, index, blockType, initialText, newId) => {
      const newItem = createBlock(blockType, initialText, newId);
      const i = Math.max(0, Math.min(index, items.length));
      const next = [...items.slice(0, i), newItem, ...items.slice(i)];
      save(next);
      return next;
    },
    indent: (items, id) => {
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
        save(next);
        return next;
      }
      const parentPath = path.slice(0, -1);
      const childIndex = path[path.length - 1];
      if (childIndex <= 0) return items;
      const { items: without, removed } = removeAtPath(items, path);
      if (removed == null) return items;
      const next = insertChildAtPath(without, [...parentPath, childIndex - 1], removed, "end");
      save(next);
      return next;
    },
    unindent: (items, id) => {
      const path = findPathToId(items, id);
      if (path == null || path.length <= 1) return items;
      const { items: without, removed } = removeAtPath(items, path);
      if (removed == null) return items;
      const parentPath = path.slice(0, -1);
      const parentIndex = parentPath[0];
      const next = insertRootAfter(without, parentIndex, removed);
      save(next);
      return next;
    },
    insertBlockAfter: (items, afterItemId, blockType, initialText, newId) => {
      const path = findPathToId(items, afterItemId);
      if (path == null || path.length === 0) return items;
      const newItem = createBlock(blockType, initialText, newId);
      if (path.length === 1) {
        const rootIndex = path[0];
        const next = insertRootAfter(items, rootIndex, newItem);
        save(next);
        return next;
      }
      const parentPath = path.slice(0, -1);
      const insertAtIndex = path[path.length - 1] + 1;
      const next = insertChildAtIndex(items, parentPath, insertAtIndex, newItem);
      save(next);
      return next;
    },
    insertExistingAfter: (items, afterItemId, toInsert) => {
      const path = findPathToId(items, afterItemId);
      if (path == null || path.length === 0) return items;
      if (path.length === 1) {
        const rootIndex = path[0];
        const next = insertRootAfter(items, rootIndex, toInsert);
        save(next);
        return next;
      }
      const parentPath = path.slice(0, -1);
      const insertAtIndex = path[path.length - 1] + 1;
      const next = insertChildAtIndex(items, parentPath, insertAtIndex, toInsert);
      save(next);
      return next;
    },
    insertBlockBefore: (items, beforeItemId, blockType, initialText, newId) => {
      const path = findPathToId(items, beforeItemId);
      if (path == null || path.length === 0) return items;
      const newItem = createBlock(blockType, initialText, newId);
      if (path.length === 1) {
        const rootIndex = path[0];
        const next = [...items.slice(0, rootIndex), newItem, ...items.slice(rootIndex)];
        save(next);
        return next;
      }
      const parentPath = path.slice(0, -1);
      const insertAtIndex = path[path.length - 1];
      const next = insertChildAtIndex(items, parentPath, insertAtIndex, newItem);
      save(next);
      return next;
    },
    updateSegment: (
      items,
      id,
      name,
      segmentGoal,
      allocatedTime,
      allocationPeriod,
      repertoirePieceId,
      videoUrl
    ) => {
      const next = updateItemInTree(items, id, (item) => ({
        ...item,
        text: name,
        segmentGoal,
        allocatedTime,
        allocationPeriod,
        repertoirePieceId,
        videoUrl,
      }));
      save(next);
      return next;
    },
    updateBlockType: (items, id, blockType) => {
      const next = updateItemInTree(items, id, (item) => {
        const isHeader =
          blockType === "heading1" || blockType === "heading2" || blockType === "heading3";
        return { ...item, blockType, isHeader };
      });
      save(next);
      return next;
    },
    reorder: (items, activeId, overId) => {
      const activePath = findPathToId(items, activeId);
      const overPath = findPathToId(items, overId);

      if (!activePath || !overPath) return items;

      const activeParentPath = activePath.slice(0, -1);
      const overParentPath = overPath.slice(0, -1);

      const isSiblings =
        activeParentPath.length === overParentPath.length &&
        activeParentPath.every((val, index) => val === overParentPath[index]);

      if (isSiblings) {
        const oldIndex = activePath[activePath.length - 1];
        const newIndex = overPath[overPath.length - 1];
        const next = moveItemInTree(items, activeParentPath, oldIndex, newIndex);
        save(next);
        return next;
      }

      if (activePath.length === 1 && overPath.length >= 1) {
        const activeRootIndex = activePath[0];
        const overRootIndex = overPath[0];
        if (activeRootIndex !== overRootIndex) {
          const next = moveItemInTree(items, [], activeRootIndex, overRootIndex);
          save(next);
          return next;
        }
      }

      return items;
    },
  };
}
