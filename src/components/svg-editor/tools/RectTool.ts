import type { Tool, ToolEvent, ToolPreview } from './tool-registry';
import { undoManager, addObject, nextId, gridSettings } from '../stores/editor-state';
import type { SvgStyleClass } from '../stores/editor-state';
import type { Point } from '../lib/geometry';
import { snapToGrid } from '../lib/geometry';
import { get } from 'svelte/store';

export function createRectTool(): Tool {
  let start: Point | null = null;
  let current: Point | null = null;
  let drawing = false;

  function snap(p: Point): Point {
    const gs = get(gridSettings);
    return gs.snap ? snapToGrid(p, gs.size) : p;
  }

  function getRect(a: Point, b: Point) {
    let x = Math.min(a.x, b.x);
    let y = Math.min(a.y, b.y);
    let w = Math.abs(b.x - a.x);
    let h = Math.abs(b.y - a.y);
    return { x, y, width: w, height: h };
  }

  return {
    name: 'rect',
    label: 'Rechteck',
    icon: '▭',
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
        // Constrain to square
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        p = { x: start.x + size * Math.sign(dx), y: start.y + size * Math.sign(dy) };
      }
      current = p;
    },

    onPointerUp(_e: ToolEvent) {
      if (!drawing || !start || !current) return;
      const r = getRect(start, current);
      if (r.width > 0 && r.height > 0) {
        undoManager.execute(addObject({
          id: nextId(),
          type: 'rect',
          cssClass: 'line' as SvgStyleClass,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        }));
      }
      start = null;
      current = null;
      drawing = false;
    },

    getPreview(): ToolPreview | null {
      if (!drawing || !start || !current) return null;
      const r = getRect(start, current);
      return {
        type: 'rect',
        cssClass: 'line',
        attrs: { x: r.x, y: r.y, width: r.width, height: r.height },
      };
    },

    onDeactivate() {
      start = null;
      current = null;
      drawing = false;
    },
  };
}
