<script lang="ts">
  import { onMount } from 'svelte';
  import { activeTool, undoManager, selectedIds, objects, deleteObjects, viewBox } from './stores/editor-state';
  import { registerTool } from './tools/tool-registry';
  import { createSelectTool } from './tools/SelectTool';
  import { createLineTool } from './tools/LineTool';
  import { createRectTool } from './tools/RectTool';
  import { createEllipseTool } from './tools/EllipseTool';
  import { createPenTool } from './tools/PenTool';
  import { createArcTool } from './tools/ArcTool';
  import { createArrowTool } from './tools/ArrowTool';
  import { createTextTool } from './tools/TextTool';
  import { createHatchTool } from './tools/HatchTool';
  import { createWallTool } from './tools/WallTool';
  import { KeyboardManager } from './lib/keyboard';
  import { exportSvg } from './io/svg-export';
  import { importSvg } from './io/svg-import';
  import type { ToolType } from './stores/editor-state';
  import { get } from 'svelte/store';

  import Toolbar from './panels/Toolbar.svelte';
  import EditorCanvas from './canvas/EditorCanvas.svelte';
  import PropertiesPanel from './panels/PropertiesPanel.svelte';
  import SymbolLibrary from './panels/SymbolLibrary.svelte';

  // Register tools
  registerTool(createSelectTool());
  registerTool(createLineTool());
  registerTool(createRectTool());
  registerTool(createEllipseTool());
  registerTool(createPenTool());
  registerTool(createArcTool());
  registerTool(createArrowTool());
  registerTool(createTextTool());
  registerTool(createHatchTool());
  registerTool(createWallTool());

  // ── File Operations ─────────────────────────────────────────────────────
  async function handleExport() {
    const svgStr = await exportSvg(get(objects), get(viewBox));
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zeichnung.svg';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopyToClipboard() {
    const svgStr = await exportSvg(get(objects), get(viewBox));
    await navigator.clipboard.writeText(svgStr);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const result = importSvg(text);
      objects.set(result.objects);
      viewBox.set(result.viewBox);
      undoManager.clear();
    };
    input.click();
  }

  function handleNew() {
    objects.set([]);
    selectedIds.set(new Set());
    viewBox.set({ x: 0, y: 0, width: 400, height: 300 });
    undoManager.clear();
  }

  // ── Autosave ──────────────────────────────────────────────────────────
  const AUTOSAVE_KEY = 'svg-editor-autosave';

  function saveToLocalStorage() {
    const data = {
      objects: get(objects),
      viewBox: get(viewBox),
    };
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
    } catch { /* ignore quota errors */ }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.objects?.length > 0) {
        objects.set(data.objects);
        if (data.viewBox) viewBox.set(data.viewBox);
      }
    } catch { /* ignore parse errors */ }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  const kbd = new KeyboardManager();
  kbd.registerAll([
    { key: 'v', action: () => activeTool.set('select'), label: 'Auswahl' },
    { key: 'l', action: () => activeTool.set('line'), label: 'Linie' },
    { key: 'r', action: () => activeTool.set('rect'), label: 'Rechteck' },
    { key: 'e', action: () => activeTool.set('ellipse'), label: 'Ellipse' },
    { key: 'p', action: () => activeTool.set('pen'), label: 'Pfad' },
    { key: 'a', action: () => activeTool.set('arc'), label: 'Bogen' },
    { key: 'w', action: () => activeTool.set('arrow'), label: 'Pfeil' },
    { key: 't', action: () => activeTool.set('text'), label: 'Text' },
    { key: 'h', action: () => activeTool.set('hatch'), label: 'Schraffur' },
    { key: 'g', action: () => activeTool.set('wall'), label: 'Wand' },
    { key: 'z', ctrl: true, action: () => undoManager.undo(), label: 'Rückgängig' },
    { key: 'z', ctrl: true, shift: true, action: () => undoManager.redo(), label: 'Wiederholen' },
    { key: 'y', ctrl: true, action: () => undoManager.redo(), label: 'Wiederholen' },
    {
      key: 'Delete',
      action: () => {
        const ids = [...get(selectedIds)];
        if (ids.length > 0) undoManager.execute(deleteObjects(ids));
      },
      label: 'Löschen',
    },
    {
      key: 'Backspace',
      action: () => {
        const ids = [...get(selectedIds)];
        if (ids.length > 0) undoManager.execute(deleteObjects(ids));
      },
      label: 'Löschen',
    },
    { key: 's', ctrl: true, action: () => { handleExport(); }, label: 'Exportieren' },
  ]);

  onMount(() => {
    kbd.attach();
    loadFromLocalStorage();

    // Autosave every 5 seconds
    const interval = setInterval(saveToLocalStorage, 5000);

    return () => {
      kbd.detach();
      clearInterval(interval);
      saveToLocalStorage();
    };
  });
</script>

<div class="editor-root">
  <div class="editor-topbar">
    <div class="topbar-left">
      <span class="editor-title">SVG-Editor</span>
      <div class="topbar-actions">
        <button class="action-btn" on:click={handleNew} title="Neu">Neu</button>
        <button class="action-btn" on:click={handleImport} title="SVG laden">Laden</button>
        <button class="action-btn" on:click={handleExport} title="SVG exportieren">Export</button>
        <button class="action-btn" on:click={handleCopyToClipboard} title="In Zwischenablage kopieren">Kopieren</button>
      </div>
    </div>
    <span class="editor-info">
      {$objects.length} Objekte
    </span>
  </div>
  <div class="editor-body">
    <Toolbar />
    <EditorCanvas />
    <div class="right-panel">
      <PropertiesPanel />
      <SymbolLibrary />
    </div>
  </div>
</div>

<style>
  .editor-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: var(--color-bg, #faf8f5);
    font-family: 'DM Sans', system-ui, sans-serif;
    color: var(--color-ink, #1c1917);
  }
  .editor-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 40px;
    background: var(--color-bg-sidebar, #f0ece6);
    border-bottom: 1px solid var(--color-border, #e7e1d9);
    flex-shrink: 0;
  }
  .topbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .editor-title {
    font-weight: 600;
    font-size: 14px;
  }
  .topbar-actions {
    display: flex;
    gap: 4px;
  }
  .action-btn {
    padding: 4px 10px;
    border: 1px solid var(--color-border, #e7e1d9);
    border-radius: 4px;
    background: var(--color-bg, #faf8f5);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--color-ink-light, #44403c);
  }
  .action-btn:hover {
    border-color: var(--color-border-strong, #d1cac0);
    background: white;
  }
  .editor-info {
    font-size: 12px;
    color: var(--color-ink-muted, #78716c);
  }
  .editor-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  .right-panel {
    width: 220px;
    flex-shrink: 0;
    background: var(--color-bg-sidebar, #f0ece6);
    border-left: 1px solid var(--color-border, #e7e1d9);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
</style>
