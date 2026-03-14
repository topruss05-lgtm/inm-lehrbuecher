import { get } from 'svelte/store';
import type { Tool, ToolEvent, ToolPreview } from './tool-registry';
import { objects, selectedIds, undoManager, moveObjects, updateObject } from '../stores/editor-state';
import type { EditorObject } from '../stores/editor-state';
import type { Point, Rect } from '../lib/geometry';
import { pointInRect, distance } from '../lib/geometry';

const ENDPOINT_HIT_RADIUS = 5;

function getObjectBounds(obj: EditorObject): Rect | null {
  if (obj.type === 'line' || obj.type === 'wall') {
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

function hitTest(point: Point, objs: EditorObject[]): string | null {
  for (let i = objs.length - 1; i >= 0; i--) {
    const bounds = getObjectBounds(objs[i]);
    if (bounds && pointInRect(point, bounds)) {
      return objs[i].id;
    }
  }
  return null;
}

/** Check if cursor is near a start/end endpoint of a line or wall */
function hitEndpoint(
  point: Point, obj: EditorObject
): 'start' | 'end' | null {
  if (obj.type !== 'line' && obj.type !== 'wall') return null;
  const startPt = { x: obj.x ?? 0, y: obj.y ?? 0 };
  const endPt = { x: obj.x2 ?? 0, y: obj.y2 ?? 0 };
  if (distance(point, startPt) < ENDPOINT_HIT_RADIUS) return 'start';
  if (distance(point, endPt) < ENDPOINT_HIT_RADIUS) return 'end';
  return null;
}

export function createSelectTool(): Tool {
  let dragStart: Point | null = null;
  let dragging = false;
  let dragIds: string[] = [];
  let totalDx = 0;
  let totalDy = 0;

  // Endpoint dragging
  let endpointDrag: { objId: string; which: 'start' | 'end' } | null = null;
  let epTotalDx = 0;
  let epTotalDy = 0;

  return {
    name: 'select',
    label: 'Auswahl',
    icon: '↖',
    cursor: 'default',

    onPointerDown(e: ToolEvent) {
      const objs = get(objects);
      const sel = get(selectedIds);

      // First check: if exactly one line/wall is selected, check for endpoint drag
      if (sel.size === 1) {
        const selId = [...sel][0];
        const selObj = objs.find(o => o.id === selId);
        if (selObj && (selObj.type === 'line' || selObj.type === 'wall')) {
          const ep = hitEndpoint(e.point, selObj);
          if (ep) {
            endpointDrag = { objId: selId, which: ep };
            dragStart = e.point;
            epTotalDx = 0;
            epTotalDy = 0;
            return;
          }
        }
      }

      // Normal hit test
      const hitId = hitTest(e.point, objs);

      if (hitId) {
        if (e.shift) {
          const next = new Set(sel);
          if (next.has(hitId)) next.delete(hitId);
          else next.add(hitId);
          selectedIds.set(next);
        } else if (!sel.has(hitId)) {
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
      // Endpoint drag mode
      if (endpointDrag && dragStart) {
        const dx = e.point.x - dragStart.x;
        const dy = e.point.y - dragStart.y;
        const ddx = dx - epTotalDx;
        const ddy = dy - epTotalDy;
        if (ddx === 0 && ddy === 0) return;

        const prop = endpointDrag.which;
        objects.update(arr => arr.map(o => {
          if (o.id !== endpointDrag!.objId) return o;
          const moved = { ...o };
          if (prop === 'start') {
            moved.x = (moved.x ?? 0) + ddx;
            moved.y = (moved.y ?? 0) + ddy;
          } else {
            moved.x2 = (moved.x2 ?? 0) + ddx;
            moved.y2 = (moved.y2 ?? 0) + ddy;
          }
          return moved;
        }));
        epTotalDx = dx;
        epTotalDy = dy;
        return;
      }

      // Normal drag
      if (!dragging || !dragStart) return;
      const dx = e.point.x - dragStart.x;
      const dy = e.point.y - dragStart.y;
      const ddx = dx - totalDx;
      const ddy = dy - totalDy;
      if (ddx === 0 && ddy === 0) return;

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
      // Endpoint drag commit
      if (endpointDrag && (epTotalDx !== 0 || epTotalDy !== 0)) {
        const { objId, which } = endpointDrag;
        // Revert live changes, then commit as undo-able command
        objects.update(arr => arr.map(o => {
          if (o.id !== objId) return o;
          const moved = { ...o };
          if (which === 'start') {
            moved.x = (moved.x ?? 0) - epTotalDx;
            moved.y = (moved.y ?? 0) - epTotalDy;
          } else {
            moved.x2 = (moved.x2 ?? 0) - epTotalDx;
            moved.y2 = (moved.y2 ?? 0) - epTotalDy;
          }
          return moved;
        }));

        if (which === 'start') {
          const obj = get(objects).find(o => o.id === objId)!;
          undoManager.execute(updateObject(objId, {
            x: (obj.x ?? 0) + epTotalDx,
            y: (obj.y ?? 0) + epTotalDy,
          }));
        } else {
          const obj = get(objects).find(o => o.id === objId)!;
          undoManager.execute(updateObject(objId, {
            x2: (obj.x2 ?? 0) + epTotalDx,
            y2: (obj.y2 ?? 0) + epTotalDy,
          }));
        }
        endpointDrag = null;
        dragStart = null;
        epTotalDx = 0;
        epTotalDy = 0;
        return;
      }
      endpointDrag = null;

      // Normal drag commit
      if (dragging && (totalDx !== 0 || totalDy !== 0)) {
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
