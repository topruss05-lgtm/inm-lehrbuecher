import type { Tool, ToolEvent, ToolPreview } from './tool-registry';
import { undoManager, addObject, nextId, gridSettings } from '../stores/editor-state';
import type { SvgStyleClass } from '../stores/editor-state';
import type { Point } from '../lib/geometry';
import { snapToGrid } from '../lib/geometry';
import { get } from 'svelte/store';

interface PathPoint {
  point: Point;
  handleIn?: Point;
  handleOut?: Point;
}

function buildPathD(points: PathPoint[], closed: boolean): string {
  if (points.length === 0) return '';
  const parts: string[] = [`M ${points[0].point.x} ${points[0].point.y}`];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const hasHandles = prev.handleOut || curr.handleIn;
    if (hasHandles) {
      const h1 = prev.handleOut ?? prev.point;
      const h2 = curr.handleIn ?? curr.point;
      parts.push(`C ${h1.x} ${h1.y} ${h2.x} ${h2.y} ${curr.point.x} ${curr.point.y}`);
    } else {
      parts.push(`L ${curr.point.x} ${curr.point.y}`);
    }
  }
  if (closed) parts.push('Z');
  return parts.join(' ');
}

export function createPenTool(): Tool {
  let points: PathPoint[] = [];
  let currentPoint: Point | null = null;
  let isDragging = false;
  let dragStartPoint: Point | null = null;

  function snap(p: Point): Point {
    const gs = get(gridSettings);
    return gs.snap ? snapToGrid(p, gs.size) : p;
  }

  function finish() {
    if (points.length >= 2) {
      const d = buildPathD(points, false);
      undoManager.execute(addObject({
        id: nextId(),
        type: 'path',
        cssClass: 'line' as SvgStyleClass,
        d,
      }));
    }
    points = [];
    currentPoint = null;
    isDragging = false;
    dragStartPoint = null;
  }

  return {
    name: 'pen',
    label: 'Pfad',
    icon: '✒',
    cursor: 'crosshair',

    onPointerDown(e: ToolEvent) {
      const p = snap(e.point);

      // Double-click finishes the path
      if (e.raw.detail >= 2 && points.length >= 2) {
        finish();
        return;
      }

      isDragging = true;
      dragStartPoint = p;
      points.push({ point: p });
    },

    onPointerMove(e: ToolEvent) {
      const p = snap(e.point);
      if (isDragging && points.length > 0) {
        // Dragging = creating bezier handles
        const last = points[points.length - 1];
        const dx = p.x - last.point.x;
        const dy = p.y - last.point.y;
        last.handleOut = { x: last.point.x + dx, y: last.point.y + dy };
        last.handleIn = { x: last.point.x - dx, y: last.point.y - dy };
      }
      currentPoint = p;
    },

    onPointerUp(e: ToolEvent) {
      isDragging = false;
      dragStartPoint = null;
    },

    getPreview(): ToolPreview | null {
      if (points.length === 0) return null;

      const previewPoints = [...points];
      if (currentPoint && !isDragging) {
        previewPoints.push({ point: currentPoint });
      }

      const d = buildPathD(previewPoints, false);
      if (!d) return null;

      return {
        type: 'path',
        cssClass: 'line',
        attrs: { d },
      };
    },

    onDeactivate() {
      finish();
    },
  };
}
