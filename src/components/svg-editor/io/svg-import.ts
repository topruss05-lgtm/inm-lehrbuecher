import type { EditorObject, SvgStyleClass } from '../stores/editor-state';
import { nextId } from '../stores/editor-state';
import type { Rect } from '../lib/geometry';

function getClass(el: Element): SvgStyleClass {
  const cls = el.getAttribute('class') ?? '';
  const valid: SvgStyleClass[] = ['line', 'line-thick', 'line-bg', 'bg-fill', 'hatch', 'filled', 'axis', 'label'];
  for (const v of valid) {
    if (cls.includes(v)) return v;
  }
  return 'line';
}

function parseNumber(s: string | null): number {
  return parseFloat(s ?? '0') || 0;
}

function parseElement(el: Element): EditorObject | null {
  const tag = el.tagName.toLowerCase();

  if (tag === 'line') {
    return {
      id: nextId(),
      type: 'line',
      cssClass: getClass(el),
      x: parseNumber(el.getAttribute('x1')),
      y: parseNumber(el.getAttribute('y1')),
      x2: parseNumber(el.getAttribute('x2')),
      y2: parseNumber(el.getAttribute('y2')),
    };
  }

  if (tag === 'rect') {
    return {
      id: nextId(),
      type: 'rect',
      cssClass: getClass(el),
      x: parseNumber(el.getAttribute('x')),
      y: parseNumber(el.getAttribute('y')),
      width: parseNumber(el.getAttribute('width')),
      height: parseNumber(el.getAttribute('height')),
    };
  }

  if (tag === 'ellipse') {
    return {
      id: nextId(),
      type: 'ellipse',
      cssClass: getClass(el),
      cx: parseNumber(el.getAttribute('cx')),
      cy: parseNumber(el.getAttribute('cy')),
      rx: parseNumber(el.getAttribute('rx')),
      ry: parseNumber(el.getAttribute('ry')),
    };
  }

  if (tag === 'circle') {
    const r = parseNumber(el.getAttribute('r'));
    return {
      id: nextId(),
      type: 'ellipse',
      cssClass: getClass(el),
      cx: parseNumber(el.getAttribute('cx')),
      cy: parseNumber(el.getAttribute('cy')),
      rx: r,
      ry: r,
    };
  }

  if (tag === 'path') {
    const d = el.getAttribute('d');
    if (!d) return null;
    // Try to detect if it's a simple line (M...L pattern with 2 points)
    const simpleLineMatch = d.match(/^M\s*([\d.-]+)\s+([\d.-]+)\s+(?:L\s*)?([\d.-]+)\s+([\d.-]+)\s*$/);
    if (simpleLineMatch) {
      return {
        id: nextId(),
        type: 'line',
        cssClass: getClass(el),
        x: parseFloat(simpleLineMatch[1]),
        y: parseFloat(simpleLineMatch[2]),
        x2: parseFloat(simpleLineMatch[3]),
        y2: parseFloat(simpleLineMatch[4]),
      };
    }
    return {
      id: nextId(),
      type: 'path',
      cssClass: getClass(el),
      d,
    };
  }

  if (tag === 'text') {
    const x = parseNumber(el.getAttribute('x'));
    const y = parseNumber(el.getAttribute('y'));
    // Extract text content including tspan content
    const text = el.textContent ?? '';
    const style = el.getAttribute('style') ?? '';
    const fontStyle = style.includes('italic') ? 'italic' : undefined;
    const fontSize = parseNumber(el.getAttribute('font-size')) || 12;

    return {
      id: nextId(),
      type: 'text',
      cssClass: 'label',
      x, y,
      text,
      fontSize,
      fontStyle,
    };
  }

  return null;
}

export interface ImportResult {
  objects: EditorObject[];
  viewBox: Rect;
}

export function importSvg(svgString: string): ImportResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) {
    return { objects: [], viewBox: { x: 0, y: 0, width: 400, height: 300 } };
  }

  // Parse viewBox
  const vbStr = svg.getAttribute('viewBox') ?? '0 0 400 300';
  const vbParts = vbStr.split(/[\s,]+/).map(Number);
  const viewBox: Rect = {
    x: vbParts[0] ?? 0,
    y: vbParts[1] ?? 0,
    width: vbParts[2] ?? 400,
    height: vbParts[3] ?? 300,
  };

  // Collect all drawable elements
  const objects: EditorObject[] = [];
  const elements = svg.querySelectorAll('line, rect, ellipse, circle, path, text');
  for (const el of elements) {
    // Skip defs, patterns, etc.
    if (el.closest('defs') || el.closest('pattern')) continue;
    const obj = parseElement(el);
    if (obj) objects.push(obj);
  }

  return { objects, viewBox };
}
