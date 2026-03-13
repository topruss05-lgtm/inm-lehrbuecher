<script lang="ts">
  import { selectedObjects, undoManager, updateObject } from '../stores/editor-state';
  import { STYLE_CLASSES } from '../stores/svg-document';
  import type { SvgStyleClass } from '../stores/editor-state';

  $: selected = $selectedObjects;

  function changeClass(cls: string) {
    for (const obj of selected) {
      undoManager.execute(updateObject(obj.id, { cssClass: cls as SvgStyleClass }));
    }
  }
</script>

{#if selected.length > 0}
  <div class="style-panel">
    <h3 class="panel-title">Stil</h3>
    <div class="style-buttons">
      {#each STYLE_CLASSES as sc}
        <button
          class="style-btn"
          class:active={selected.length === 1 && selected[0].cssClass === sc.id}
          on:click={() => changeClass(sc.id)}
          title={sc.description}
        >
          {sc.label}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .style-panel {
    padding: 12px;
    border-bottom: 1px solid var(--color-border, #e7e1d9);
  }
  .panel-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-ink-muted, #78716c);
    margin: 0 0 8px 0;
  }
  .style-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .style-btn {
    padding: 3px 8px;
    border: 1px solid var(--color-border, #e7e1d9);
    border-radius: 4px;
    background: var(--color-bg, #faf8f5);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .style-btn:hover {
    border-color: var(--color-border-strong, #d1cac0);
  }
  .style-btn.active {
    background: var(--color-accent-bg, #fffbeb);
    border-color: var(--color-accent, #b45309);
    color: var(--color-accent, #b45309);
  }
</style>
