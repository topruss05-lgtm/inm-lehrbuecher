import type { EditorObject } from '../stores/editor-state';
import type { Rect } from '../lib/geometry';
import { roundCoord } from '../lib/geometry';
import { generateWallHatch, wallHatchPathD } from '../lib/wall-geometry';
import { loadFontBase64 } from './font-embed';

function r(v: number | undefined): string {
  return roundCoord(v ?? 0).toString();
}

function objectToSvg(obj: EditorObject): string {
  switch (obj.type) {
    case 'line':
      return `    <path d="M ${r(obj.x)} ${r(obj.y)} L ${r(obj.x2)} ${r(obj.y2)}" class="${obj.cssClass}" />`;
    case 'rect':
      return `    <rect x="${r(obj.x)}" y="${r(obj.y)}" width="${r(obj.width)}" height="${r(obj.height)}" class="${obj.cssClass}" />`;
    case 'ellipse':
      return `    <ellipse cx="${r(obj.cx)}" cy="${r(obj.cy)}" rx="${r(obj.rx)}" ry="${r(obj.ry)}" class="${obj.cssClass}" />`;
    case 'path':
      // Round all numbers in the path data
      const roundedD = (obj.d ?? '').replace(/-?\d+\.?\d*/g, m => r(parseFloat(m)));
      return `    <path d="${roundedD}" class="${obj.cssClass}" />`;
    case 'text': {
      const style = obj.fontStyle ? ` style="font-style:${obj.fontStyle}"` : '';
      const fs = obj.fontSize ? ` font-size="${r(obj.fontSize)}"` : '';
      return `    <text x="${r(obj.x)}" y="${r(obj.y)}" class="label"${fs}${style}>${escapeXml(obj.text ?? '')}</text>`;
    }
    case 'wall': {
      // Wall exports as separate line-thick + hatch paths (matching clean SVG format)
      const start = { x: obj.x ?? 0, y: obj.y ?? 0 };
      const end = { x: obj.x2 ?? 0, y: obj.y2 ?? 0 };
      const hatchLines = generateWallHatch(
        start, end,
        obj.hatchSide ?? 'right',
        obj.hatchDepth ?? 8,
        obj.hatchSpacing ?? 2,
      );
      const wallLine = `    <path d="M ${r(start.x)} ${r(start.y)} ${r(end.x)} ${r(end.y)}" class="line-thick" />`;
      const hatchPath = `    <path d="${wallHatchPathD(hatchLines)}" class="hatch" />`;
      return `${wallLine}\n${hatchPath}`;
    }
    default:
      return '';
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function exportSvg(objects: EditorObject[], vb: Rect): Promise<string> {
  const fontB64 = await loadFontBase64();

  const fontFace = fontB64
    ? `    @font-face {
      font-family: 'LM Math';
      src: url('data:font/woff2;base64,${fontB64}') format('woff2');
      font-weight: normal;
      font-style: normal;
    }\n`
    : '';

  const fontFamily = fontB64
    ? "'LM Math', 'Latin Modern Math', 'STIX Two Math', serif"
    : "'Latin Modern Math', 'STIX Two Math', serif";

  const style = `${fontFace}    .line { stroke: #231f20; fill: none; stroke-width: 0.567; }
    .line-thick { stroke: #231f20; fill: none; stroke-width: 1.134; }
    .line-bg { stroke: #fff; fill: none; stroke-width: 2.835; }
    .bg-fill { fill: #fff; stroke: none; }
    .hatch { stroke: #231f20; fill: none; stroke-width: 0.504; }
    .filled { fill: #231f20; fill-rule: evenodd; }
    .axis { stroke: #231f20; fill: none; stroke-width: 0.567; }
    .label { font-family: ${fontFamily}; fill: #231f20; stroke: none; }`;

  // Separate drawing elements from labels
  const drawingObjs = objects.filter(o => o.type !== 'text');
  const labelObjs = objects.filter(o => o.type === 'text');

  const drawingLines = drawingObjs.map(objectToSvg).filter(Boolean);
  const labelLines = labelObjs.map(objectToSvg).filter(Boolean);

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(vb.x)} ${r(vb.y)} ${r(vb.width)} ${r(vb.height)}">`,
    `  <style>`,
    style,
    `  </style>`,
    `  <g id="drawing">`,
    ...drawingLines,
    `  </g>`,
  ];

  if (labelLines.length > 0) {
    parts.push(`  <g id="labels">`);
    parts.push(...labelLines);
    parts.push(`  </g>`);
  }

  parts.push(`</svg>`);
  return parts.join('\n');
}
