import { registerSymbol } from './symbol-registry';
import { nextId } from '../stores/editor-state';

// Parametric spring (zigzag pattern)
registerSymbol({
  id: 'spring',
  name: 'Feder',
  category: 'Bauteile',
  defaults: { length: 60, width: 16, coils: 6 },
  previewPath: 'M 0 0 L 5 0 L 8 -8 L 14 8 L 20 -8 L 26 8 L 32 -8 L 38 8 L 41 0 L 46 0',

  generate(x, y, params = {}) {
    const length = params.length ?? 60;
    const width = params.width ?? 16;
    const coils = params.coils ?? 6;
    const hw = width / 2;
    const leadIn = 5;
    const coilLen = (length - 2 * leadIn) / coils;

    const parts: string[] = [`M ${x} ${y} L ${x + leadIn} ${y}`];
    for (let i = 0; i < coils; i++) {
      const cx = x + leadIn + i * coilLen;
      if (i % 2 === 0) {
        parts.push(`L ${cx + coilLen / 2} ${y - hw} L ${cx + coilLen} ${y + (i === coils - 1 ? 0 : 0)}`);
      } else {
        parts.push(`L ${cx + coilLen / 2} ${y + hw} L ${cx + coilLen} ${y}`);
      }
    }
    parts.push(`L ${x + length} ${y}`);

    return {
      id: nextId(),
      type: 'path' as const,
      cssClass: 'line' as const,
      d: parts.join(' '),
    };
  },
});
