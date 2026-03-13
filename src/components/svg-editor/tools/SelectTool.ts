import { get } from 'svelte/store';
import type { Tool, ToolEvent, ToolPreview } from './tool-registry';
import { objects, selectedIds, undoManager, moveObjects, deleteObjects } from '../stores/editor-state';
import type { Point, Rect } from '../lib/geometry';
import { pointInRect } from '../lib/geometry';

function getObjectBounds(obj: any): Rect | null {
  if (obj.type === 'line') {
    const x = Math.min(obj.x ?? 0, obj.x2 ?? 0);
    const y = Math.min(obj.y ?? 0, obj.y2 ?? 0);
    return {
      x: x - 3, y: y - 3,
      width: Math.abs((obj.x2 ?? 0) - (obj.x ?? 0)) + 6,
      height: Math.abs((obj.y2 ?? 0) - (obj.y ?? 0)) + 6,
    };
  }
  if (obj.type === 'rect') {
    return { x: obj.x ?? 0, y: obj.y ?? 0, width: obj.width ?? 0, height: obj.height ?? 0 };
  }
  if (obj.type === 'ellipse') {
    return {
      x: (obj.cx ?? 0) - (obj.rx ?? 0),
      y: (obj.cy ?? 0) - (obj.ry ?? 0),
      width: (obj.rx ?? 0) * 2,
      height: (obj.ry ?? 0) * 2,
    };
  }
  return null;
}

function hitTest(point: Point, objs: any[]): string | null {
  // Iterate in reverse so topmost object is hit first
  for (let i = objs.length - 1; i >= 0; i--) {
    const bounds = getObjectBounds(objs[i]);
    if (bounds && pointInRect(point, bounds)) {
      return objs[i].id;
    }
  }
  return null;
}

export function createSelectTool(): Tool {
  let dragStart: Point | null = null;
  let dragging = false;
  let dragIds: string[] = [];
  let totalDx = 0;
  let totalDy = 0;

  return {
    name: 'select',
    label: 'Auswahl',
    icon: '↖',
    cursor: 'default',

    onPointerDown(e: ToolEvent) {
      const objs = get(objects);
      const hitId = hitTest(e.point, objs);

      if (hitId) {
        const current = get(selectedIds);
        if (e.shift) {
          const next = new Set(current);
          if (next.has(hitId)) next.delete(hitId);
          else next.add(hitId);
          selectedIds.set(next);
        } else if (!current.has(hitId)) {
          selectedIds.set(new Set([hitId]));
        }
        dragStart = e.point;
        dragging = true;
        dragIds = [...get(selectedIds)];
        totalDx = 0;
        totalDy = 0;
      } else {
        selectedIds.set(new Set());
        dragStart = null;
        dragging = false;
      }
    },

    onPointerMove(e: ToolEvent) {
      if (!dragging || !dragStart) return;
      const dx = e.point.x - dragStart.x;
      const dy = e.point.y - dragStart.y;
      const ddx = dx - totalDx;
      const ddy = dy - totalDy;
      if (ddx === 0 && ddy === 0) return;

      // Direct move (not via undo) for live feedback
      objects.update(arr => arr.map(o => {
        if (!dragIds.includes(o.id)) return o;
        const moved = { ...o };
        if (moved.x != null) moved.x += ddx;
        if (moved.y != null) moved.y += ddy;
        if (moved.x2 != null) moved.x2 += ddx;
        if (moved.y2 != null) moved.y2 += ddy;
        if (moved.cx != null) moved.cx += ddx;
        if (moved.cy != null) moved.cy += ddy;
        return moved;
      }));
      totalDx = dx;
      totalDy = dy;
    },

    onPointerUp(_e: ToolEvent) {
      if (dragging && (totalDx !== 0 || totalDy !== 0)) {
        // Undo the live move, then execute as command
        objects.update(arr => arr.map(o => {
          if (!dragIds.includes(o.id)) return o;
          const moved = { ...o };
          if (moved.x != null) moved.x -= totalDx;
          if (moved.y != null) moved.y -= totalDy;
          if (moved.x2 != null) moved.x2 -= totalDx;
          if (moved.y2 != null) moved.y2 -= totalDy;
          if (moved.cx != null) moved.cx -= totalDx;
          if (moved.cy != null) moved.cy -= totalDy;
          return moved;
        }));
        undoManager.execute(moveObjects(dragIds, totalDx, totalDy));
      }
      dragging = false;
      dragStart = null;
      dragIds = [];
      totalDx = 0;
      totalDy = 0;
    },

    getPreview(): ToolPreview | null {
      return null;
    },
  };
}
