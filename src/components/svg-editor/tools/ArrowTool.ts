import type { Tool, ToolEvent, ToolPreview } from './tool-registry';
import { undoManager, addObject, nextId, gridSettings } from '../stores/editor-state';
import type { SvgStyleClass } from '../stores/editor-state';
import type { Point } from '../lib/geometry';
import { snapToGrid } from '../lib/geometry';
import { get } from 'svelte/store';

// Generate arrowhead path at the end of a line
function arrowheadPath(from: Point, to: Point, size = 6): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const a1 = angle + Math.PI * 0.85;
  const a2 = angle - Math.PI * 0.85;
  const p1x = to.x + size * Math.cos(a1);
  const p1y = to.y + size * Math.sin(a1);
  const p2x = to.x + size * Math.cos(a2);
  const p2y = to.y + size * Math.sin(a2);
  return `M ${p1x} ${p1y} L ${to.x} ${to.y} L ${p2x} ${p2y}`;
}

export function createArrowTool(): Tool {
  let start: Point | null = null;
  let current: Point | null = null;
  let drawing = false;

  function snap(p: Point): Point {
    const gs = get(gridSettings);
    return gs.snap ? snapToGrid(p, gs.size) : p;
  }

  return {
    name: 'arrow',
    label: 'Pfeil',
    icon: '→',
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
        // Create a path that includes the line + arrowhead
        const linePart = `M ${start.x} ${start.y} L ${current.x} ${current.y}`;
        const headPart = arrowheadPath(start, current);
        const d = `${linePart} ${headPart}`;
        undoManager.execute(addObject({
          id: nextId(),
          type: 'path',
          cssClass: 'line' as SvgStyleClass,
          d,
        }));
      }
      start = null;
      current = null;
      drawing = false;
    },

    getPreview(): ToolPreview | null {
      if (!drawing || !start || !current) return null;
      const linePart = `M ${start.x} ${start.y} L ${current.x} ${current.y}`;
      const headPart = arrowheadPath(start, current);
      return {
        type: 'path',
        cssClass: 'line',
        attrs: { d: `${linePart} ${headPart}` },
      };
    },

    onDeactivate() {
      start = null;
      current = null;
      drawing = false;
    },
  };
}
