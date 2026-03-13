<script lang="ts">
  import { gridSettings, viewBox } from '../stores/editor-state';

  $: gs = $gridSettings;
  $: vb = $viewBox;
</script>

{#if gs.enabled}
  <defs>
    <pattern
      id="grid-pattern"
      x={vb.x}
      y={vb.y}
      width={gs.size}
      height={gs.size}
      patternUnits="userSpaceOnUse"
    >
      <circle cx={0} cy={0} r="0.5" fill="#c8c0b8" opacity="0.6" />
    </pattern>
  </defs>
  <rect
    x={vb.x}
    y={vb.y}
    width={vb.width}
    height={vb.height}
    fill="url(#grid-pattern)"
    pointer-events="none"
  />
{/if}
