import { registerSymbol } from './symbol-registry';
import { nextId } from '../stores/editor-state';

// Fixed bearing (Festlager) — triangle with ground
registerSymbol({
  id: 'bearing-fixed',
  name: 'Festlager',
  category: 'Lager',
  defaults: { size: 20 },
  previewPath: 'M -10 0 L 10 0 L 0 -15 Z M -12 0 L -12 4 M -8 0 L -8 4 M -4 0 L -4 4 M 0 0 L 0 4 M 4 0 L 4 4 M 8 0 L 8 4 M 12 0 L 12 4',

  generate(x, y, params = {}) {
    const size = params.size ?? 20;
    const h = size * 0.75;
    const hw = size / 2;

    // Triangle + hatch lines below
    const hatchCount = 6;
    const hatchParts: string[] = [];
    for (let i = 0; i <= hatchCount; i++) {
      const hx = x - hw + (i * size) / hatchCount;
      hatchParts.push(`M ${hx} ${y} L ${hx - 3} ${y + 4}`);
    }

    const d = [
      `M ${x - hw} ${y} L ${x + hw} ${y} L ${x} ${y - h} Z`,
      ...hatchParts,
    ].join(' ');

    return {
      id: nextId(),
      type: 'path' as const,
      cssClass: 'line' as const,
      d,
    };
  },
});

// Roller bearing (Loslager) — triangle on wheels
registerSymbol({
  id: 'bearing-roller',
  name: 'Loslager',
  category: 'Lager',
  defaults: { size: 20 },
  previewPath: 'M -10 0 L 10 0 L 0 -15 Z M -8 3 A 3 3 0 1 0 -2 3 A 3 3 0 1 0 -8 3 M 2 3 A 3 3 0 1 0 8 3 A 3 3 0 1 0 2 3',

  generate(x, y, params = {}) {
    const size = params.size ?? 20;
    const h = size * 0.75;
    const hw = size / 2;
    const wheelR = 2.5;
    const wheelY = y + wheelR + 1;

    const d = [
      `M ${x - hw} ${y} L ${x + hw} ${y} L ${x} ${y - h} Z`,
      // Two circles (approximated with arcs)
      `M ${x - hw / 2 - wheelR} ${wheelY} A ${wheelR} ${wheelR} 0 1 0 ${x - hw / 2 + wheelR} ${wheelY} A ${wheelR} ${wheelR} 0 1 0 ${x - hw / 2 - wheelR} ${wheelY}`,
      `M ${x + hw / 2 - wheelR} ${wheelY} A ${wheelR} ${wheelR} 0 1 0 ${x + hw / 2 + wheelR} ${wheelY} A ${wheelR} ${wheelR} 0 1 0 ${x + hw / 2 - wheelR} ${wheelY}`,
      // Ground line
      `M ${x - hw - 2} ${wheelY + wheelR + 1} L ${x + hw + 2} ${wheelY + wheelR + 1}`,
    ].join(' ');

    return {
      id: nextId(),
      type: 'path' as const,
      cssClass: 'line' as const,
      d,
    };
  },
});
