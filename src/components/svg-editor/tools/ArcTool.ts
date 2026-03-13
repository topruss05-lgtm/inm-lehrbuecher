import type { Tool, ToolEvent, ToolPreview } from './tool-registry';
import { undoManager, addObject, nextId, gridSettings } from '../stores/editor-state';
import type { SvgStyleClass } from '../stores/editor-state';
import type { Point } from '../lib/geometry';
import { snapToGrid, distance } from '../lib/geometry';
import { get } from 'svelte/store';

// Compute SVG arc through 3 points
function arcThrough3Points(p1: Point, p2: Point, p3: Point): string | null {
  // Find the circumscribed circle center
  const ax = p1.x, ay = p1.y;
  const bx = p2.x, by = p2.y;
  const cx = p3.x, cy = p3.y;

  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(D) < 1e-10) return null; // Collinear

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;

  const r = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);

  // Determine sweep direction using cross product
  const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const sweep = cross > 0 ? 1 : 0;

  // Use large arc if midpoint is on the "other side"
  const largeArc = 0;

  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${p3.x} ${p3.y}`;
}

export function createArcTool(): Tool {
  let points: Point[] = [];
  let currentPoint: Point | null = null;

  function snap(p: Point): Point {
    const gs = get(gridSettings);
    return gs.snap ? snapToGrid(p, gs.size) : p;
  }

  return {
    name: 'arc',
    label: 'Bogen',
    icon: '⌒',
    cursor: 'crosshair',

    onPointerDown(e: ToolEvent) {
      const p = snap(e.point);
      points.push(p);

      if (points.length === 3) {
        const d = arcThrough3Points(points[0], points[1], points[2]);
        if (d) {
          undoManager.execute(addObject({
            id: nextId(),
            type: 'path',
            cssClass: 'line' as SvgStyleClass,
            d,
          }));
        }
        points = [];
        currentPoint = null;
      }
    },

    onPointerMove(e: ToolEvent) {
      currentPoint = snap(e.point);
    },

    onPointerUp(_e: ToolEvent) {},

    getPreview(): ToolPreview | null {
      if (points.length === 0 || !currentPoint) return null;

      if (points.length === 1) {
        // Show line from first point to cursor
        return {
          type: 'line',
          cssClass: 'line',
          attrs: { x1: points[0].x, y1: points[0].y, x2: currentPoint.x, y2: currentPoint.y },
        };
      }

      if (points.length === 2) {
        // Show arc preview through 3 points
        const d = arcThrough3Points(points[0], points[1], currentPoint);
        if (d) {
          return { type: 'path', cssClass: 'line', attrs: { d } };
        }
      }

      return null;
    },

    onDeactivate() {
      points = [];
      currentPoint = null;
    },
  };
}
