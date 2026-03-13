import type { Point } from '../lib/geometry';
import type { ToolType, SvgStyleClass } from '../stores/editor-state';

export interface ToolEvent {
  /** Position in SVG coordinate space */
  point: Point;
  /** Raw DOM event */
  raw: PointerEvent;
  /** Whether shift key is held */
  shift: boolean;
  /** Whether ctrl/cmd key is held */
  ctrl: boolean;
}

export interface ToolPreview {
  type: 'line' | 'rect' | 'ellipse' | 'path' | 'circle';
  cssClass: SvgStyleClass;
  attrs: Record<string, string | number>;
}

export interface Tool {
  name: ToolType;
  label: string;
  icon: string; // SVG path or emoji
  cursor: string;
  onPointerDown(e: ToolEvent): void;
  onPointerMove(e: ToolEvent): void;
  onPointerUp(e: ToolEvent): void;
  getPreview(): ToolPreview | null;
  onDeactivate?(): void;
}

const registry = new Map<ToolType, Tool>();

export function registerTool(tool: Tool) {
  registry.set(tool.name, tool);
}

export function getTool(name: ToolType): Tool | undefined {
  return registry.get(name);
}

export function getAllTools(): Tool[] {
  return Array.from(registry.values());
}
