<script lang="ts">
  import { getSymbolsByCategory, type SymbolDefinition } from '../symbols/symbol-registry';
  // Import symbol registrations
  import '../symbols/spring';
  import '../symbols/damper';
  import '../symbols/bearing';
  import '../symbols/mass';
  import '../symbols/joint';

  import { undoManager, addObject, viewBox } from '../stores/editor-state';
  import { get } from 'svelte/store';

  $: categories = getSymbolsByCategory();

  function placeSymbol(sym: SymbolDefinition) {
    const vb = get(viewBox);
    const cx = vb.x + vb.width / 2;
    const cy = vb.y + vb.height / 2;
    const obj = sym.generate(cx, cy, sym.defaults);
    undoManager.execute(addObject(obj));
  }

  let expandedCategory: string | null = null;
  function toggleCategory(cat: string) {
    expandedCategory = expandedCategory === cat ? null : cat;
  }
</script>

<div class="symbol-library">
  <h3 class="panel-title">Symbole</h3>
  {#each [...categories] as [category, symbols]}
    <div class="category">
      <button class="category-header" on:click={() => toggleCategory(category)}>
        <span class="category-arrow" class:expanded={expandedCategory === category}>▸</span>
        {category}
      </button>
      {#if expandedCategory === category}
        <div class="symbol-grid">
          {#each symbols as sym}
            <button
              class="symbol-btn"
              title={sym.name}
              on:click={() => placeSymbol(sym)}
            >
              <svg viewBox="-20 -20 66 40" class="symbol-preview">
                <path d={sym.previewPath} fill="none" stroke="currentColor" stroke-width="1" />
              </svg>
              <span class="symbol-name">{sym.name}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .symbol-library {
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
  .category {
    margin-bottom: 2px;
  }
  .category-header {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 4px 0;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 12px;
    color: var(--color-ink-light, #44403c);
    text-align: left;
  }
  .category-header:hover {
    color: var(--color-ink, #1c1917);
  }
  .category-arrow {
    display: inline-block;
    transition: transform 0.15s;
    font-size: 10px;
  }
  .category-arrow.expanded {
    transform: rotate(90deg);
  }
  .symbol-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px 0 8px 14px;
  }
  .symbol-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 4px;
    border: 1px solid var(--color-border, #e7e1d9);
    border-radius: 6px;
    background: var(--color-bg, #faf8f5);
    cursor: pointer;
    transition: all 0.15s;
  }
  .symbol-btn:hover {
    border-color: var(--color-accent, #b45309);
    background: var(--color-accent-bg, #fffbeb);
  }
  .symbol-preview {
    width: 48px;
    height: 28px;
    color: var(--color-ink, #1c1917);
  }
  .symbol-name {
    font-size: 10px;
    color: var(--color-ink-muted, #78716c);
  }
</style>
