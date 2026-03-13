import type { Tool, ToolEvent, ToolPreview } from './tool-registry';
import { undoManager, addObject, nextId, gridSettings } from '../stores/editor-state';
import type { SvgStyleClass } from '../stores/editor-state';
import type { Point } from '../lib/geometry';
import { snapToGrid } from '../lib/geometry';
import { get } from 'svelte/store';

// Generate parallel hatch lines within a rectangular region
function generateHatchLines(
  x: number, y: number, w: number, h: number,
  angle: number, spacing: number
): string {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const diag = Math.sqrt(w * w + h * h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const parts: string[] = [];

  const count = Math.ceil(diag / spacing);
  for (let i = -count; i <= count; i++) {
    const offset = i * spacing;
    // Line perpendicular to angle, offset by spacing
    const px = cx + offset * cos;
    const py = cy + offset * sin;
    // Extend line in direction perpendicular to offset
    const lx = diag * sin;
    const ly = diag * cos;
    const x1 = px - lx;
    const y1 = py + ly;
    const x2 = px + lx;
    const y2 = py - ly;

    // Clip to rect
    const clipped = clipLineToRect(x1, y1, x2, y2, x, y, x + w, y + h);
    if (clipped) {
      parts.push(`M ${clipped.x1.toFixed(1)} ${clipped.y1.toFixed(1)} L ${clipped.x2.toFixed(1)} ${clipped.y2.toFixed(1)}`);
    }
  }
  return parts.join(' ');
}

function clipLineToRect(
  x1: number, y1: number, x2: number, y2: number,
  rx1: number, ry1: number, rx2: number, ry2: number
): { x1: number; y1: number; x2: number; y2: number } | null {
  // Cohen-Sutherland line clipping
  const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
  function code(x: number, y: number) {
    let c = INSIDE;
    if (x < rx1) c |= LEFT; else if (x > rx2) c |= RIGHT;
    if (y < ry1) c |= TOP; else if (y > ry2) c |= BOTTOM;
    return c;
  }

  let c1 = code(x1, y1), c2 = code(x2, y2);
  for (let i = 0; i < 20; i++) {
    if (!(c1 | c2)) return { x1, y1, x2, y2 };
    if (c1 & c2) return null;
    const c = c1 || c2;
    let x = 0, y = 0;
    if (c & BOTTOM) { x = x1 + (x2 - x1) * (ry2 - y1) / (y2 - y1); y = ry2; }
    else if (c & TOP) { x = x1 + (x2 - x1) * (ry1 - y1) / (y2 - y1); y = ry1; }
    else if (c & RIGHT) { y = y1 + (y2 - y1) * (rx2 - x1) / (x2 - x1); x = rx2; }
    else if (c & LEFT) { y = y1 + (y2 - y1) * (rx1 - x1) / (x2 - x1); x = rx1; }
    if (c === c1) { x1 = x; y1 = y; c1 = code(x1, y1); }
    else { x2 = x; y2 = y; c2 = code(x2, y2); }
  }
  return null;
}

export function createHatchTool(): Tool {
  let start: Point | null = null;
  let current: Point | null = null;
  let drawing = false;
  const hatchAngle = 45;
  const hatchSpacing = 3;

  function snap(p: Point): Point {
    const gs = get(gridSettings);
    return gs.snap ? snapToGrid(p, gs.size) : p;
  }

  function getRect(a: Point, b: Point) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    };
  }

  return {
    name: 'hatch',
    label: 'Schraffur',
    icon: '▤',
    cursor: 'crosshair',

    onPointerDown(e: ToolEvent) {
      start = snap(e.point);
      current = start;
      drawing = true;
    },

    onPointerMove(e: ToolEvent) {
      if (!drawing) return;
      current = snap(e.point);
    },

    onPointerUp(_e: ToolEvent) {
      if (!drawing || !start || !current) return;
      const r = getRect(start, current);
      if (r.w > 2 && r.h > 2) {
        const d = generateHatchLines(r.x, r.y, r.w, r.h, hatchAngle, hatchSpacing);
        if (d) {
          undoManager.execute(addObject({
            id: nextId(),
            type: 'path',
            cssClass: 'hatch' as SvgStyleClass,
            d,
          }));
        }
      }
      start = null;
      current = null;
      drawing = false;
    },

    getPreview(): ToolPreview | null {
      if (!drawing || !start || !current) return null;
      const r = getRect(start, current);
      // Show rectangle outline as preview
      return {
        type: 'rect',
        cssClass: 'line',
        attrs: { x: r.x, y: r.y, width: r.w, height: r.h },
      };
    },

    onDeactivate() {
      start = null;
      current = null;
      drawing = false;
    },
  };
}
