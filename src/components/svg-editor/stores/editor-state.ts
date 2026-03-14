import { writable, derived, get } from 'svelte/store';
import type { Point, Rect } from '../lib/geometry';
import { UndoRedoManager, type Command } from '../lib/undo-redo';

// ── SVG Style Classes (matching clean_svgs.py) ──────────────────────────
export type SvgStyleClass =
  | 'line'
  | 'line-thick'
  | 'line-bg'
  | 'bg-fill'
  | 'hatch'
  | 'filled'
  | 'axis'
  | 'label';

// ── Editor Object Types ─────────────────────────────────────────────────
export type EditorObjectType = 'line' | 'rect' | 'ellipse' | 'path' | 'arc' | 'arrow' | 'text' | 'group' | 'wall';

export interface EditorObject {
  id: string;
  type: EditorObjectType;
  cssClass: SvgStyleClass;
  // Geometry depends on type
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  rx?: number;
  ry?: number;
  cx?: number;
  cy?: number;
  // Path data for complex shapes
  d?: string;
  // Text
  text?: string;
  fontSize?: number;
  fontStyle?: string;
  // Group children
  children?: EditorObject[];
  // Wall-specific
  hatchSide?: 'left' | 'right'; // relative to start→end direction
  hatchDepth?: number;
  hatchSpacing?: number;
}

export type ToolType = 'select' | 'line' | 'rect' | 'ellipse' | 'pen' | 'arc' | 'arrow' | 'text' | 'hatch' | 'wall';

export interface GridSettings {
  enabled: boolean;
  size: number;
  snap: boolean;
}

// ── Stores ──────────────────────────────────────────────────────────────
export const objects = writable<EditorObject[]>([]);
export const selectedIds = writable<Set<string>>(new Set());
export const activeTool = writable<ToolType>('select');
export const viewBox = writable<Rect>({ x: 0, y: 0, width: 400, height: 300 });
export const zoom = writable<number>(1);
export const gridSettings = writable<GridSettings>({
  enabled: true,
  size: 10,
  snap: true,
});
export const documentTitle = writable<string>('Unbenannt');

// ── Undo/Redo ───────────────────────────────────────────────────────────
function notifyChange() {
  // trigger reactivity by re-assigning
  objects.update(o => [...o]);
}

export const undoManager = new UndoRedoManager(notifyChange);

// ── ID generator ────────────────────────────────────────────────────────
let idCounter = 0;
export function nextId(): string {
  return `obj_${++idCounter}`;
}

// ── Derived ─────────────────────────────────────────────────────────────
export const selectedObjects = derived(
  [objects, selectedIds],
  ([$objects, $selectedIds]) => $objects.filter(o => $selectedIds.has(o.id))
);

// ── Commands ────────────────────────────────────────────────────────────
export function addObject(obj: EditorObject): Command {
  return {
    label: `Add ${obj.type}`,
    execute() { objects.update(arr => [...arr, obj]); },
    undo() { objects.update(arr => arr.filter(o => o.id !== obj.id)); },
  };
}

export function deleteObjects(ids: string[]): Command {
  let removed: { obj: EditorObject; index: number }[] = [];
  return {
    label: `Delete ${ids.length} object(s)`,
    execute() {
      const current = get(objects);
      removed = ids.map(id => {
        const index = current.findIndex(o => o.id === id);
        return { obj: current[index], index };
      }).filter(r => r.obj);
      objects.update(arr => arr.filter(o => !ids.includes(o.id)));
      selectedIds.set(new Set());
    },
    undo() {
      objects.update(arr => {
        const result = [...arr];
        for (const r of removed.sort((a, b) => a.index - b.index)) {
          result.splice(r.index, 0, r.obj);
        }
        return result;
      });
    },
  };
}

export function moveObjects(ids: string[], dx: number, dy: number): Command {
  function applyDelta(arr: EditorObject[], ddx: number, ddy: number) {
    return arr.map(o => {
      if (!ids.includes(o.id)) return o;
      const moved = { ...o };
      if (moved.x != null) moved.x += ddx;
      if (moved.y != null) moved.y += ddy;
      if (moved.x2 != null) moved.x2 += ddx;
      if (moved.y2 != null) moved.y2 += ddy;
      if (moved.cx != null) moved.cx += ddx;
      if (moved.cy != null) moved.cy += ddy;
      return moved;
    });
  }
  return {
    label: `Move ${ids.length} object(s)`,
    execute() { objects.update(arr => applyDelta(arr, dx, dy)); },
    undo() { objects.update(arr => applyDelta(arr, -dx, -dy)); },
  };
}

export function updateObject(id: string, changes: Partial<EditorObject>): Command {
  let previous: Partial<EditorObject> = {};
  return {
    label: `Update ${id}`,
    execute() {
      objects.update(arr => arr.map(o => {
        if (o.id !== id) return o;
        previous = {};
        for (const key of Object.keys(changes) as (keyof EditorObject)[]) {
          (previous as any)[key] = o[key];
        }
        return { ...o, ...changes };
      }));
    },
    undo() {
      objects.update(arr => arr.map(o => {
        if (o.id !== id) return o;
        return { ...o, ...previous };
      }));
    },
  };
}
