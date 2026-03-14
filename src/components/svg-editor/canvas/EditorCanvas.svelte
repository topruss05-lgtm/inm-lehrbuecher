<script lang="ts">
  import { onMount } from 'svelte';
  import { objects, selectedIds, activeTool, viewBox, zoom, gridSettings } from '../stores/editor-state';
  import { SVG_STYLE_BLOCK } from '../stores/svg-document';
  import type { ToolEvent } from '../tools/tool-registry';
  import { getTool } from '../tools/tool-registry';
  import type { Point } from '../lib/geometry';
  import { generateWallHatch, wallHatchPathD } from '../lib/wall-geometry';
  import GridOverlay from './GridOverlay.svelte';
  import SelectionHandles from './SelectionHandles.svelte';

  let svgEl: SVGSVGElement;
  let containerEl: HTMLDivElement;

  // Pan state
  let isPanning = false;
  let panStart: Point = { x: 0, y: 0 };
  let spaceHeld = false;

  // Reactive preview from active tool
  let preview: ReturnType<typeof getTool> extends { getPreview: () => infer R } ? R : null = null;

  $: currentTool = getTool($activeTool);

  // Update preview reactively
  let previewTick = 0;
  function refreshPreview() {
    previewTick++;
    preview = currentTool?.getPreview() ?? null;
  }

  function svgPoint(e: PointerEvent): Point {
    const rect = svgEl.getBoundingClientRect();
    const vb = $viewBox;
    return {
      x: vb.x + (e.clientX - rect.left) / rect.width * vb.width,
      y: vb.y + (e.clientY - rect.top) / rect.height * vb.height,
    };
  }

  function makeToolEvent(e: PointerEvent): ToolEvent {
    return {
      point: svgPoint(e),
      raw: e,
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
    };
  }

  function onPointerDown(e: PointerEvent) {
    if (spaceHeld || e.button === 1) {
      // Start panning
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    currentTool?.onPointerDown(makeToolEvent(e));
    refreshPreview();
  }

  function onPointerMove(e: PointerEvent) {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      const rect = svgEl.getBoundingClientRect();
      const vb = $viewBox;
      viewBox.set({
        ...vb,
        x: vb.x - dx / rect.width * vb.width,
        y: vb.y - dy / rect.height * vb.height,
      });
      panStart = { x: e.clientX, y: e.clientY };
      return;
    }
    currentTool?.onPointerMove(makeToolEvent(e));
    refreshPreview();
  }

  function onPointerUp(e: PointerEvent) {
    if (isPanning) {
      isPanning = false;
      return;
    }
    currentTool?.onPointerUp(makeToolEvent(e));
    refreshPreview();
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const rect = svgEl.getBoundingClientRect();
    const vb = $viewBox;

    // Zoom around cursor position
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    const newWidth = vb.width * factor;
    const newHeight = vb.height * factor;

    viewBox.set({
      x: vb.x + (vb.width - newWidth) * mx,
      y: vb.y + (vb.height - newHeight) * my,
      width: newWidth,
      height: newHeight,
    });
    zoom.set(400 / newWidth); // 400 = default width
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' && !spaceHeld) {
      spaceHeld = true;
      e.preventDefault();
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      spaceHeld = false;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  // Render each EditorObject as SVG
  function renderObject(obj: any) {
    return obj; // Template handles rendering
  }

  $: vb = $viewBox;
  $: viewBoxStr = `${vb.x} ${vb.y} ${vb.width} ${vb.height}`;
  $: cursorStyle = isPanning || spaceHeld ? 'grab' : (currentTool?.cursor ?? 'default');
</script>

<div
  class="canvas-container"
  bind:this={containerEl}
  style:cursor={cursorStyle}
>
  <svg
    bind:this={svgEl}
    xmlns="http://www.w3.org/2000/svg"
    viewBox={viewBoxStr}
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={onPointerUp}
    on:wheel|preventDefault={onWheel}
  >
    <!-- Embed the same CSS as clean SVGs -->
    {@html `<style>${SVG_STYLE_BLOCK}</style>`}

    <!-- Grid -->
    <GridOverlay />

    <!-- Drawing objects -->
    <g id="drawing">
      {#each $objects as obj (obj.id)}
        {#if obj.type === 'line'}
          <line
            x1={obj.x}
            y1={obj.y}
            x2={obj.x2}
            y2={obj.y2}
            class={obj.cssClass}
          />
        {:else if obj.type === 'rect'}
          <rect
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            class={obj.cssClass}
          />
        {:else if obj.type === 'ellipse'}
          <ellipse
            cx={obj.cx}
            cy={obj.cy}
            rx={obj.rx}
            ry={obj.ry}
            class={obj.cssClass}
          />
        {:else if obj.type === 'path'}
          <path d={obj.d} class={obj.cssClass} />
        {:else if obj.type === 'text'}
          <text
            x={obj.x}
            y={obj.y}
            class="label"
            font-size={obj.fontSize ?? 12}
            style={obj.fontStyle ? `font-style:${obj.fontStyle}` : ''}
          >{obj.text}</text>
        {:else if obj.type === 'wall'}
          {@const wallStart = { x: obj.x ?? 0, y: obj.y ?? 0 }}
          {@const wallEnd = { x: obj.x2 ?? 0, y: obj.y2 ?? 0 }}
          {@const hatchLines = generateWallHatch(wallStart, wallEnd, obj.hatchSide ?? 'right', obj.hatchDepth ?? 8, obj.hatchSpacing ?? 2)}
          <!-- Wall surface line -->
          <line
            x1={wallStart.x}
            y1={wallStart.y}
            x2={wallEnd.x}
            y2={wallEnd.y}
            class="line-thick"
          />
          <!-- Hatch lines -->
          <path d={wallHatchPathD(hatchLines)} class="hatch" />
        {/if}
      {/each}
    </g>

    <!-- Tool preview -->
    {#if preview}
      {#if preview.type === 'line'}
        <line
          x1={preview.attrs.x1}
          y1={preview.attrs.y1}
          x2={preview.attrs.x2}
          y2={preview.attrs.y2}
          class={preview.cssClass}
          opacity="0.6"
        />
      {:else if preview.type === 'rect'}
        <rect
          x={preview.attrs.x}
          y={preview.attrs.y}
          width={preview.attrs.width}
          height={preview.attrs.height}
          class={preview.cssClass}
          opacity="0.6"
        />
      {:else if preview.type === 'ellipse'}
        <ellipse
          cx={preview.attrs.cx}
          cy={preview.attrs.cy}
          rx={preview.attrs.rx}
          ry={preview.attrs.ry}
          class={preview.cssClass}
          opacity="0.6"
        />
      {:else if preview.type === 'path'}
        <path
          d={preview.attrs.d}
          class={preview.cssClass}
          opacity="0.6"
        />
      {/if}
    {/if}

    <!-- Selection handles -->
    <SelectionHandles />
  </svg>
</div>

<style>
  .canvas-container {
    flex: 1;
    overflow: hidden;
    background: white;
    position: relative;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
