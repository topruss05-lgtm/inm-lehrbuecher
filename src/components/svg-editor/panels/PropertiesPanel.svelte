<script lang="ts">
  import { selectedObjects, undoManager, updateObject, viewBox } from '../stores/editor-state';
  import { STYLE_CLASSES } from '../stores/svg-document';
  import type { SvgStyleClass } from '../stores/editor-state';

  $: selected = $selectedObjects;
  $: single = selected.length === 1 ? selected[0] : null;
  $: vb = $viewBox;

  function changeClass(cls: string) {
    if (!single) return;
    undoManager.execute(updateObject(single.id, { cssClass: cls as SvgStyleClass }));
  }

  function updateProp(prop: string, value: string) {
    if (!single) return;
    const num = parseFloat(value);
    if (isNaN(num)) return;
    undoManager.execute(updateObject(single.id, { [prop]: num }));
  }

  function updateViewBoxProp(prop: string, value: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    viewBox.update(v => ({ ...v, [prop]: num }));
  }
</script>

<div class="properties-panel">
  <div class="panel-section">
    <h3 class="panel-title">Dokument</h3>
    <div class="prop-grid">
      <label>Breite</label>
      <input type="number" value={vb.width} on:change={e => updateViewBoxProp('width', e.currentTarget.value)} />
      <label>Höhe</label>
      <input type="number" value={vb.height} on:change={e => updateViewBoxProp('height', e.currentTarget.value)} />
    </div>
  </div>

  {#if single}
    <div class="panel-section">
      <h3 class="panel-title">Stil</h3>
      <div class="style-buttons">
        {#each STYLE_CLASSES as sc}
          <button
            class="style-btn"
            class:active={single.cssClass === sc.id}
            on:click={() => changeClass(sc.id)}
            title={sc.description}
          >
            {sc.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="panel-section">
      <h3 class="panel-title">Eigenschaften</h3>
      <div class="prop-grid">
        {#if single.type === 'line'}
          <label>X1</label>
          <input type="number" step="0.1" value={single.x} on:change={e => updateProp('x', e.currentTarget.value)} />
          <label>Y1</label>
          <input type="number" step="0.1" value={single.y} on:change={e => updateProp('y', e.currentTarget.value)} />
          <label>X2</label>
          <input type="number" step="0.1" value={single.x2} on:change={e => updateProp('x2', e.currentTarget.value)} />
          <label>Y2</label>
          <input type="number" step="0.1" value={single.y2} on:change={e => updateProp('y2', e.currentTarget.value)} />
        {:else if single.type === 'rect'}
          <label>X</label>
          <input type="number" step="0.1" value={single.x} on:change={e => updateProp('x', e.currentTarget.value)} />
          <label>Y</label>
          <input type="number" step="0.1" value={single.y} on:change={e => updateProp('y', e.currentTarget.value)} />
          <label>Breite</label>
          <input type="number" step="0.1" value={single.width} on:change={e => updateProp('width', e.currentTarget.value)} />
          <label>Höhe</label>
          <input type="number" step="0.1" value={single.height} on:change={e => updateProp('height', e.currentTarget.value)} />
        {:else if single.type === 'ellipse'}
          <label>CX</label>
          <input type="number" step="0.1" value={single.cx} on:change={e => updateProp('cx', e.currentTarget.value)} />
          <label>CY</label>
          <input type="number" step="0.1" value={single.cy} on:change={e => updateProp('cy', e.currentTarget.value)} />
          <label>RX</label>
          <input type="number" step="0.1" value={single.rx} on:change={e => updateProp('rx', e.currentTarget.value)} />
          <label>RY</label>
          <input type="number" step="0.1" value={single.ry} on:change={e => updateProp('ry', e.currentTarget.value)} />
        {/if}
      </div>
    </div>
  {:else if selected.length > 1}
    <div class="panel-section">
      <p class="info-text">{selected.length} Objekte ausgewählt</p>
    </div>
  {:else}
    <div class="panel-section">
      <p class="info-text">Kein Objekt ausgewählt</p>
    </div>
  {/if}
</div>

<style>
  .properties-panel {
    font-size: 13px;
  }
  .panel-section {
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
  .prop-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 8px;
    align-items: center;
  }
  .prop-grid label {
    color: var(--color-ink-light, #44403c);
    font-size: 12px;
  }
  .prop-grid input {
    width: 100%;
    padding: 3px 6px;
    border: 1px solid var(--color-border, #e7e1d9);
    border-radius: 4px;
    background: var(--color-bg, #faf8f5);
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
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
  .info-text {
    color: var(--color-ink-muted, #78716c);
    font-size: 12px;
    margin: 0;
  }
</style>
