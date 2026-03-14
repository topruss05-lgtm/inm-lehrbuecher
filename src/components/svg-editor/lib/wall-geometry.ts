import type { Point } from './geometry';

export interface WallHatchLine {
  x1: number; y1: number;
  x2: number; y2: number;
}

/**
 * Determine which side of the line (start→end) a point is on.
 * Returns 'left' or 'right' using cross product.
 */
export function pointSideOfLine(start: Point, end: Point, p: Point): 'left' | 'right' {
  const cross = (end.x - start.x) * (p.y - start.y) - (end.y - start.y) * (p.x - start.x);
  return cross >= 0 ? 'right' : 'left';
}

/**
 * Generate hatch lines for a wall.
 * The wall line goes from start to end.
 * Hatch lines are drawn on the specified side, perpendicular-ish (45° to wall direction).
 */
export function generateWallHatch(
  start: Point,
  end: Point,
  side: 'left' | 'right',
  depth: number,
  spacing: number,
): WallHatchLine[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const wallLen = Math.sqrt(dx * dx + dy * dy);
  if (wallLen < 0.1) return [];

  // Wall unit direction
  const ux = dx / wallLen;
  const uy = dy / wallLen;

  // Normal pointing toward hatch side
  // "right" of start→end = (uy, -ux), "left" = (-uy, ux)
  const nx = side === 'right' ? uy : -uy;
  const ny = side === 'right' ? -ux : ux;

  // Hatch lines go from the wall surface diagonally into the material
  // Direction: -wallDir + normalDir (45° into the material, pointing "backward" along wall)
  const hx = -ux + nx;
  const hy = -uy + ny;
  const hLen = Math.sqrt(hx * hx + hy * hy);
  const hux = hx / hLen;
  const huy = hy / hLen;

  const lines: WallHatchLine[] = [];
  const count = Math.ceil(wallLen / spacing);

  for (let i = 0; i <= count; i++) {
    const t = i * spacing;
    if (t > wallLen) break;

    // Point on wall
    const wx = start.x + ux * t;
    const wy = start.y + uy * t;

    // Hatch line endpoint
    const ex = wx + hux * depth;
    const ey = wy + huy * depth;

    lines.push({ x1: wx, y1: wy, x2: ex, y2: ey });
  }

  return lines;
}

/**
 * Build SVG path data for wall hatch lines.
 */
export function wallHatchPathD(lines: WallHatchLine[]): string {
  return lines
    .map(l => `M ${l.x1.toFixed(1)} ${l.y1.toFixed(1)} ${l.x2.toFixed(1)} ${l.y2.toFixed(1)}`)
    .join(' ');
}
