<script lang="ts">
  import { activeTool } from '../stores/editor-state';
  import type { ToolType } from '../stores/editor-state';

  const tools: { id: ToolType; label: string; icon: string; shortcut: string }[] = [
    { id: 'select', label: 'Auswahl', icon: '↖', shortcut: 'V' },
    { id: 'line', label: 'Linie', icon: '╲', shortcut: 'L' },
    { id: 'rect', label: 'Rechteck', icon: '▭', shortcut: 'R' },
    { id: 'ellipse', label: 'Ellipse', icon: '◯', shortcut: 'E' },
    { id: 'pen', label: 'Pfad', icon: '✒', shortcut: 'P' },
    { id: 'arc', label: 'Bogen', icon: '⌒', shortcut: 'A' },
    { id: 'arrow', label: 'Pfeil', icon: '→', shortcut: 'W' },
    { id: 'text', label: 'Text', icon: 'T', shortcut: 'T' },
    { id: 'hatch', label: 'Schraffur', icon: '▤', shortcut: 'H' },
  ];

  function selectTool(id: ToolType) {
    activeTool.set(id);
  }
</script>

<div class="toolbar">
  {#each tools as tool}
    <button
      class="tool-btn"
      class:active={$activeTool === tool.id}
      on:click={() => selectTool(tool.id)}
      title="{tool.label} ({tool.shortcut})"
    >
      <span class="tool-icon">{tool.icon}</span>
    </button>
  {/each}
</div>

<style>
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 4px;
    background: var(--color-bg-sidebar, #f0ece6);
    border-right: 1px solid var(--color-border, #e7e1d9);
    width: 44px;
    flex-shrink: 0;
  }
  .tool-btn {
    width: 36px;
    height: 36px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    color: var(--color-ink-light, #44403c);
  }
  .tool-btn:hover {
    background: var(--color-bg-warm, #f5f1ec);
    border-color: var(--color-border, #e7e1d9);
  }
  .tool-btn.active {
    background: var(--color-accent-bg, #fffbeb);
    border-color: var(--color-accent, #b45309);
    color: var(--color-accent, #b45309);
  }
  .tool-icon {
    font-size: 18px;
    line-height: 1;
  }
</style>
