import type { Tool, ToolEvent, ToolPreview } from './tool-registry';
import { undoManager, addObject, nextId, gridSettings } from '../stores/editor-state';
import type { SvgStyleClass } from '../stores/editor-state';
import type { Point } from '../lib/geometry';
import { snapToGrid } from '../lib/geometry';
import { get } from 'svelte/store';

export function createEllipseTool(): Tool {
  let start: Point | null = null;
  let current: Point | null = null;
  let drawing = false;

  function snap(p: Point): Point {
    const gs = get(gridSettings);
    return gs.snap ? snapToGrid(p, gs.size) : p;
  }

  function getEllipse(a: Point, b: Point) {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    return { cx, cy, rx, ry };
  }

  return {
    name: 'ellipse',
    label: 'Ellipse',
    icon: '◯',
    cursor: 'crosshair',

    onPointerDown(e: ToolEvent) {
      start = snap(e.point);
      current = start;
      drawing = true;
    },

    onPointerMove(e: ToolEvent) {
      if (!drawing) return;
      let p = snap(e.point);
      if (e.shift && start) {
        // Constrain to circle
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        p = { x: start.x + size * Math.sign(dx), y: start.y + size * Math.sign(dy) };
      }
      current = p;
    },

    onPointerUp(_e: ToolEvent) {
      if (!drawing || !start || !current) return;
      const el = getEllipse(start, current);
      if (el.rx > 0 && el.ry > 0) {
        undoManager.execute(addObject({
          id: nextId(),
          type: 'ellipse',
          cssClass: 'line' as SvgStyleClass,
          cx: el.cx,
          cy: el.cy,
          rx: el.rx,
          ry: el.ry,
        }));
      }
      start = null;
      current = null;
      drawing = false;
    },

    getPreview(): ToolPreview | null {
      if (!drawing || !start || !current) return null;
      const el = getEllipse(start, current);
      return {
        type: 'ellipse',
        cssClass: 'line',
        attrs: { cx: el.cx, cy: el.cy, rx: el.rx, ry: el.ry },
      };
    },

    onDeactivate() {
      start = null;
      current = null;
      drawing = false;
    },
  };
}
