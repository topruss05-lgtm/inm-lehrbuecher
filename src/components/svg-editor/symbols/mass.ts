import { registerSymbol } from './symbol-registry';
import { nextId } from '../stores/editor-state';

// Mass block
registerSymbol({
  id: 'mass-block',
  name: 'Masseblock',
  category: 'Massen',
  defaults: { width: 30, height: 20 },
  previewPath: 'M -15 -10 L 15 -10 L 15 10 L -15 10 Z',

  generate(x, y, params = {}) {
    const w = params.width ?? 30;
    const h = params.height ?? 20;
    return {
      id: nextId(),
      type: 'rect' as const,
      cssClass: 'line-thick' as const,
      x: x - w / 2,
      y: y - h / 2,
      width: w,
      height: h,
    };
  },
});

// Mass point (filled circle)
registerSymbol({
  id: 'mass-point',
  name: 'Massepunkt',
  category: 'Massen',
  defaults: { radius: 4 },
  previewPath: 'M -4 0 A 4 4 0 1 0 4 0 A 4 4 0 1 0 -4 0',

  generate(x, y, params = {}) {
    const r = params.radius ?? 4;
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
