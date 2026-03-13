import type { EditorObject } from '../stores/editor-state';
import { nextId } from '../stores/editor-state';

export interface SymbolDefinition {
  id: string;
  name: string;
  category: string;
  /** Generate editor objects at given position with given parameters */
  generate(x: number, y: number, params?: Record<string, number>): EditorObject;
  /** Default parameters */
  defaults: Record<string, number>;
  /** SVG preview path for the library thumbnail */
  previewPath: string;
}

const registry: SymbolDefinition[] = [];

export function registerSymbol(def: SymbolDefinition) {
  registry.push(def);
}

export function getSymbols(): SymbolDefinition[] {
  return registry;
}

export function getSymbolsByCategory(): Map<string, SymbolDefinition[]> {
  const map = new Map<string, SymbolDefinition[]>();
  for (const s of registry) {
    const arr = map.get(s.category) ?? [];
    arr.push(s);
    map.set(s.category, arr);
  }
  return map;
}
