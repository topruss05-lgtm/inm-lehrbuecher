import type { Tool, ToolEvent, ToolPreview } from './tool-registry';
import { undoManager, addObject, nextId, gridSettings } from '../stores/editor-state';
import type { Point } from '../lib/geometry';
import { snapToGrid } from '../lib/geometry';
import { pointSideOfLine, generateWallHatch, wallHatchPathD } from '../lib/wall-geometry';
import { get } from 'svelte/store';

type WallPhase = 'idle' | 'start-set' | 'end-set';

const DEFAULT_HATCH_DEPTH = 8;
const DEFAULT_HATCH_SPACING = 2;

export function createWallTool(): Tool {
  let phase: WallPhase = 'idle';
  let start: Point | null = null;
  let end: Point | null = null;
  let cursor: Point | null = null;
  let currentSide: 'left' | 'right' = 'right';

  function snap(p: Point): Point {
    const gs = get(gridSettings);
    return gs.snap ? snapToGrid(p, gs.size) : p;
  }

  function reset() {
    phase = 'idle';
    start = null;
    end = null;
    cursor = null;
  }

  return {
    name: 'wall',
    label: 'Wand',
    icon: '▥',
    cursor: 'crosshair',

    onPointerDown(e: ToolEvent) {
      const p = snap(e.point);

      if (phase === 'idle') {
        // First click: set start
        start = p;
        phase = 'start-set';
      } else if (phase === 'start-set') {
        // Second click: set end
        end = p;
        phase = 'end-set';
      } else if (phase === 'end-set' && start && end) {
        // Third click: confirm hatch side
        undoManager.execute(addObject({
          id: nextId(),
          type: 'wall',
          cssClass: 'line-thick',
          x: start.x,
          y: start.y,
          x2: end.x,
          y2: end.y,
          hatchSide: currentSide,
          hatchDepth: DEFAULT_HATCH_DEPTH,
          hatchSpacing: DEFAULT_HATCH_SPACING,
        }));
        reset();
      }
    },

    onPointerMove(e: ToolEvent) {
      cursor = snap(e.point);

      if (phase === 'end-set' && start && end) {
        // Determine which side of the wall the cursor is on
        currentSide = pointSideOfLine(start, end, e.point);
      }
    },

    onPointerUp(_e: ToolEvent) {},

    getPreview(): ToolPreview | null {
      if (phase === 'idle' || !start) return null;

      if (phase === 'start-set' && cursor) {
        // Show wall line preview (start → cursor)
        return {
          type: 'line',
          cssClass: 'line-thick',
          attrs: { x1: start.x, y1: start.y, x2: cursor.x, y2: cursor.y },
        };
      }

      if (phase === 'end-set' && end) {
        // Show wall line + hatch preview
        const hatchLines = generateWallHatch(
          start, end, currentSide, DEFAULT_HATCH_DEPTH, DEFAULT_HATCH_SPACING
        );
        const hatchD = wallHatchPathD(hatchLines);
        const wallD = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        // Combine wall + hatch into single path for preview
        return {
          type: 'path',
          cssClass: 'line',
          attrs: { d: `${wallD} ${hatchD}` },
        };
      }

      return null;
    },

    onDeactivate() {
      reset();
    },
  };
}
