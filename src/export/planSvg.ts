import { findProduct } from '../catalog/products';
import { itemColor, MISSING_COLOR } from '../editor2d/itemColor';
import { pointsAttr, sectorPath } from '../editor2d/svg';
import { planBounds } from '../geometry/bounds';
import { doorSwing } from '../geometry/clearance';
import { corners, itemObb } from '../geometry/obb';
import { openingObb, wallDir, wallLength, wallObb } from '../geometry/walls';
import { activeItems, activeLayout } from '../model/layout';
import type { Plan } from '../model/schema';

export const EXPORT_PX_PER_CM = 2;

const MARGIN = 80;
const HEADER = 70;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export function escapeXml(s: string): string {
  return s
    .replace(CONTROL_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function unverifiedCount(plan: Plan): number {
  return (
    plan.walls.filter((w) => !w.verified).length +
    plan.openings.filter((o) => !o.verified).length +
    activeItems(plan).filter((i) => !i.verified).length
  );
}

export function exportFileName(title: string, layoutName: string, kind: '2d' | '3d'): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|\s\u0000-\u001F]+/g, '-');
  return `homefit-${safe(title)}-${safe(layoutName)}-${kind}.png`;
}

const mark = (n: number, verified: boolean | undefined) => (verified ? `${n}` : `≈${n}`);

function text(x: number, y: number, size: number, value: string, attrs: string): string {
  return `<text x="${x}" y="${y}" font-size="${size}" font-family="sans-serif" ${attrs}>${escapeXml(value)}</text>`;
}

function label(x: number, y: number, size: number, value: string, attrs: string): string {
  return text(x, y, size, value, `stroke="#ffffff" stroke-width="3" paint-order="stroke" ${attrs}`);
}

export function planSvg(plan: Plan): { svg: string; width: number; height: number } {
  const b = planBounds(plan);
  const x0 = b.minX - MARGIN;
  const y0 = b.minY - MARGIN - HEADER;
  const w = b.maxX - b.minX + MARGIN * 2;
  const h = b.maxY - b.minY + MARGIN * 2 + HEADER;
  const center = 'text-anchor="middle" dominant-baseline="middle"';
  const parts: string[] = [`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>`];

  for (const wall of plan.walls) {
    parts.push(`<polygon points="${pointsAttr(corners(wallObb(wall)))}" fill="#3f3a33"/>`);
  }

  const wallById = new Map(plan.walls.map((x) => [x.id, x]));
  for (const o of plan.openings) {
    const wall = wallById.get(o.wallId);
    if (!wall) continue;
    parts.push(`<polygon points="${pointsAttr(corners(openingObb(wall, o)))}" fill="#ffffff" stroke="#3f3a33" stroke-width="1"/>`);
    if (o.kind === 'door') {
      const s = doorSwing(wall, o);
      if (s.kind === 'sector') parts.push(`<path d="${sectorPath(s.center, s.radius, s.start, s.end)}" fill="none" stroke="#8b8b8b" stroke-width="1"/>`);
    }
  }

  const items = activeItems(plan);
  for (const item of items) {
    const product = findProduct(plan, item.productId);
    const dims = product?.dims ?? { w: 50, d: 50, h: 50 };
    const fill = product ? itemColor(product, item.variantId) : MISSING_COLOR;
    parts.push(
      `<polygon points="${pointsAttr(corners(itemObb(item.x, item.y, item.rotation, dims.w, dims.d)))}" fill="${fill}" fill-opacity="0.85" stroke="#6b5e4b" stroke-width="1.5"/>`,
    );
  }

  for (const wall of plan.walls) {
    const len = Math.round(wallLength(wall));
    if (len === 0) continue;
    const u = wallDir(wall);
    const off = wall.thickness / 2 + 14;
    parts.push(
      label((wall.a.x + wall.b.x) / 2 - u.y * off, (wall.a.y + wall.b.y) / 2 + u.x * off, 12, mark(len, wall.verified), `fill="#3f3a33" ${center}`),
    );
  }

  for (const o of plan.openings) {
    const wall = wallById.get(o.wallId);
    if (!wall) continue;
    const u = wallDir(wall);
    const mid = o.offset + o.width / 2;
    const off = -(wall.thickness / 2 + 14);
    parts.push(
      label(wall.a.x + u.x * mid - u.y * off, wall.a.y + u.y * mid + u.x * off, 11, mark(o.width, o.verified), `fill="#4f6b8a" ${center}`),
    );
  }

  for (const r of plan.rooms) parts.push(label(r.label.x, r.label.y, 18, r.name, `fill="#6b5e4b" ${center}`));

  for (const item of items) {
    const product = findProduct(plan, item.productId);
    const dims = product?.dims ?? { w: 50, d: 50, h: 50 };
    parts.push(label(item.x, item.y - 7, 12, product?.name ?? '알 수 없는 제품', `fill="#1f2328" ${center}`));
    const size = `${dims.w}×${dims.d}`;
    parts.push(label(item.x, item.y + 9, 11, item.verified ? size : `≈${size}`, `fill="#1f2328" ${center}`));
  }

  parts.push(text(x0 + 20, y0 + 30, 22, `${plan.info.title} · ${activeLayout(plan).name}`, 'fill="#1f2328" font-weight="bold"'));
  parts.push(text(x0 + 20, y0 + 56, 14, `단위: cm · ≈ 표시는 실측 미확인 치수 (${unverifiedCount(plan)}개)`, 'fill="#6b7280"'));

  const width = Math.round(w * EXPORT_PX_PER_CM);
  const height = Math.round(h * EXPORT_PX_PER_CM);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${w} ${h}">${parts.join('')}</svg>`,
    width,
    height,
  };
}
