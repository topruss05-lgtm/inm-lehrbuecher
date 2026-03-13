// Canonical CSS style block matching clean_svgs.py output
export const SVG_STYLE_BLOCK = `
    @font-face {
      font-family: 'LM Math';
      src: url('./fonts/lm-math-subset.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
    }
    .line { stroke: #231f20; fill: none; stroke-width: 0.567; }
    .line-thick { stroke: #231f20; fill: none; stroke-width: 1.134; }
    .line-bg { stroke: #fff; fill: none; stroke-width: 2.835; }
    .bg-fill { fill: #fff; stroke: none; }
    .hatch { stroke: #231f20; fill: none; stroke-width: 0.504; }
    .filled { fill: #231f20; fill-rule: evenodd; }
    .axis { stroke: #231f20; fill: none; stroke-width: 0.567; }
    .label { font-family: 'LM Math', 'Latin Modern Math', 'STIX Two Math', serif; fill: #231f20; stroke: none; }`;

export const STYLE_CLASSES = [
  { id: 'line', label: 'Linie', description: 'Standard-Linie (0.567pt)' },
  { id: 'line-thick', label: 'Dicke Linie', description: 'Betonte Linie (1.134pt)' },
  { id: 'line-bg', label: 'Hintergrund-Linie', description: 'Weiße Linie (2.835pt)' },
  { id: 'bg-fill', label: 'Hintergrund-Füllung', description: 'Weiße Füllung' },
  { id: 'hatch', label: 'Schraffur', description: 'Schraffur-Linie (0.504pt)' },
  { id: 'filled', label: 'Gefüllt', description: 'Schwarze Füllung' },
  { id: 'axis', label: 'Achse', description: 'Koordinatenachse (0.567pt)' },
  { id: 'label', label: 'Beschriftung', description: 'Text-Label' },
] as const;

export const DEFAULT_VIEWBOX = { x: 0, y: 0, width: 400, height: 300 };
