import type { Tool, ToolEvent, ToolPreview } from './tool-registry';
import { undoManager, addObject, nextId, gridSettings } from '../stores/editor-state';
import type { Point } from '../lib/geometry';
import { snapToGrid } from '../lib/geometry';
import { get } from 'svelte/store';

export function createTextTool(): Tool {
  let placementPoint: Point | null = null;

  function snap(p: Point): Point {
    const gs = get(gridSettings);
    return gs.snap ? snapToGrid(p, gs.size) : p;
  }

  return {
    name: 'text',
    label: 'Text',
    icon: 'T',
    cursor: 'text',

    onPointerDown(e: ToolEvent) {
      placementPoint = snap(e.point);

      const text = prompt('Label-Text eingeben:');
      if (text && text.trim()) {
        undoManager.execute(addObject({
          id: nextId(),
          type: 'text',
          cssClass: 'label',
          x: placementPoint.x,
          y: placementPoint.y,
          text: text.trim(),
          fontSize: 12,
          fontStyle: 'italic',
        }));
      }
      placementPoint = null;
    },

    onPointerMove(_e: ToolEvent) {},
    onPointerUp(_e: ToolEvent) {},

    getPreview(): ToolPreview | null {
      return null;
    },

    onDeactivate() {
      placementPoint = null;
    },
  };
}
