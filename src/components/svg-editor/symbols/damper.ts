import { registerSymbol } from './symbol-registry';
import { nextId } from '../stores/editor-state';

// Parametric damper (dashpot)
registerSymbol({
  id: 'damper',
  name: 'Dämpfer',
  category: 'Bauteile',
  defaults: { length: 60, width: 20 },
  previewPath: 'M 0 0 L 15 0 M 15 -8 L 15 8 M 15 -6 L 35 -6 L 35 6 L 15 6 M 25 0 L 46 0',

  generate(x, y, params = {}) {
    const length = params.length ?? 60;
    const width = params.width ?? 20;
    const hw = width / 2;
    const pistonX = x + length * 0.35;
    const cylinderEnd = x + length * 0.65;

    // Piston rod + plate + cylinder + rod out
    const d = [
      `M ${x} ${y} L ${pistonX} ${y}`,
      `M ${pistonX} ${y - hw * 0.8} L ${pistonX} ${y + hw * 0.8}`,
      `M ${pistonX} ${y - hw * 0.6} L ${cylinderEnd} ${y - hw * 0.6} L ${cylinderEnd} ${y + hw * 0.6} L ${pistonX} ${y + hw * 0.6}`,
      `M ${(pistonX + cylinderEnd) / 2} ${y} L ${x + length} ${y}`,
    ].join(' ');

    return {
      id: nextId(),
      type: 'path' as const,
      cssClass: 'line' as const,
      d,
    };
  },
});
