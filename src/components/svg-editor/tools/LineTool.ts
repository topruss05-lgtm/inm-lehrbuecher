import type { Tool, ToolEvent, ToolPreview } from './tool-registry';
import { undoManager, addObject, nextId } from '../stores/editor-state';
import type { SvgStyleClass } from '../stores/editor-state';
import type { Point } from '../lib/geometry';
import { snapToGrid } from '../lib/geometry';
import { get } from 'svelte/store';
import { gridSettings } from '../stores/editor-state';

export function createLineTool(): Tool {
  let start: Point | null = null;
  let current: Point | null = null;
  let drawing = false;

  function snap(p: Point): Point {
    const gs = get(gridSettings);
    return gs.snap ? snapToGrid(p, gs.size) : p;
  }

  return {
    name: 'line',
    label: 'Linie',
    icon: '╲',
    cursor: 'crosshair',

    onPointerDown(e: ToolEvent) {
      start = snap(e.point);
      current = start;
      drawing = true;
    },

    onPointerMove(e: ToolEvent) {
      if (!drawing) return;
      let p = snap(e.point);
      // Shift constrains to horizontal/vertical/45°
      if (e.shift && start) {
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx > absDy * 2) {
          p = { x: p.x, y: start.y };
        } else if (absDy > absDx * 2) {
          p = { x: start.x, y: p.y };
        } else {
          const d = Math.min(absDx, absDy);
          p = { x: start.x + d * Math.sign(dx), y: start.y + d * Math.sign(dy) };
        }
      }
      current = p;
    },

    onPointerUp(_e: ToolEvent) {
      if (!drawing || !start || !current) return;
      if (start.x !== current.x || start.y !== current.y) {
        undoManager.execute(addObject({
          id: nextId(),
          type: 'line',
          cssClass: 'line' as SvgStyleClass,
          x: start.x,
          y: start.y,
          x2: current.x,
          y2: current.y,
        }));
      }
      start = null;
      current = null;
      drawing = false;
    },

    getPreview(): ToolPreview | null {
      if (!drawing || !start || !current) return null;
      return {
        type: 'line',
        cssClass: 'line',
        attrs: { x1: start.x, y1: start.y, x2: current.x, y2: current.y },
      };
    },

    onDeactivate() {
      start = null;
      current = null;
      drawing = false;
    },
  };
}
