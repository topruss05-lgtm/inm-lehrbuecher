import { registerSymbol } from './symbol-registry';
import { nextId } from '../stores/editor-state';

// Hinge joint (open circle)
registerSymbol({
  id: 'joint-hinge',
  name: 'Gelenk',
  category: 'Verbindungen',
  defaults: { radius: 3 },
  previewPath: 'M -3 0 A 3 3 0 1 0 3 0 A 3 3 0 1 0 -3 0',

  generate(x, y, params = {}) {
    const r = params.radius ?? 3;
    return {
      id: nextId(),
      type: 'ellipse' as const,
      cssClass: 'line' as const,
      cx: x,
      cy: y,
      rx: r,
      ry: r,
    };
  },
});

// Fixed joint (filled circle, small)
registerSymbol({
  id: 'joint-fixed',
  name: 'Feste Verbindung',
  category: 'Verbindungen',
  defaults: { radius: 2 },
  previewPath: 'M -2 0 A 2 2 0 1 0 2 0 A 2 2 0 1 0 -2 0',

  generate(x, y, params = {}) {
    const r = params.radius ?? 2;
    return {
      id: nextId(),
      type: 'ellipse' as const,
      cssClass: 'filled' as const,
      cx: x,
      cy: y,
      rx: r,
      ry: r,
    };
  },
});
