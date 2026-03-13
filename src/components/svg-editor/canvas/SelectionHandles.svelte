<script lang="ts">
  import { selectedObjects, zoom } from '../stores/editor-state';
  import type { EditorObject } from '../stores/editor-state';

  function getBounds(obj: EditorObject) {
    if (obj.type === 'line') {
      return {
        x: Math.min(obj.x ?? 0, obj.x2 ?? 0),
        y: Math.min(obj.y ?? 0, obj.y2 ?? 0),
        w: Math.abs((obj.x2 ?? 0) - (obj.x ?? 0)),
        h: Math.abs((obj.y2 ?? 0) - (obj.y ?? 0)),
      };
    }
    if (obj.type === 'rect') {
      return { x: obj.x ?? 0, y: obj.y ?? 0, w: obj.width ?? 0, h: obj.height ?? 0 };
    }
    if (obj.type === 'ellipse') {
      return {
        x: (obj.cx ?? 0) - (obj.rx ?? 0),
        y: (obj.cy ?? 0) - (obj.ry ?? 0),
        w: (obj.rx ?? 0) * 2,
        h: (obj.ry ?? 0) * 2,
      };
    }
    return null;
  }

  $: handleSize = 6 / $zoom;
  $: strokeW = 1 / $zoom;
</script>

{#each $selectedObjects as obj}
  {@const bounds = getBounds(obj)}
  {#if bounds}
    <rect
      x={bounds.x - 2 / $zoom}
      y={bounds.y - 2 / $zoom}
      width={bounds.w + 4 / $zoom}
      height={bounds.h + 4 / $zoom}
      fill="none"
      stroke="#3b82f6"
      stroke-width={strokeW}
      stroke-dasharray="{4 / $zoom}"
      pointer-events="none"
    />
    <!-- Corner handles -->
    {#each [[bounds.x, bounds.y], [bounds.x + bounds.w, bounds.y], [bounds.x, bounds.y + bounds.h], [bounds.x + bounds.w, bounds.y + bounds.h]] as [hx, hy]}
      <rect
        x={hx - handleSize / 2}
        y={hy - handleSize / 2}
        width={handleSize}
        height={handleSize}
        fill="white"
        stroke="#3b82f6"
        stroke-width={strokeW}
        pointer-events="none"
      />
    {/each}
  {/if}
{/each}
