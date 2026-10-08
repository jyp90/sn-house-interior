import { findProduct } from '../catalog/products';
import { itemColor, MISSING_COLOR } from '../editor2d/itemColor';
import { pointsAttr, sectorPath } from '../editor2d/svg';
import { FIXTURE_GLYPH, FIXTURE_KINDS, FIXTURE_LABEL, FIXTURE_R_CM, fixtureNumbers, type FixtureKind } from '../electrical/fixtures';
import { planBounds } from '../geometry/bounds';
import { doorLeaves } from '../geometry/clearance';
import { corners, itemObb } from '../geometry/obb';
import { openingObb, wallDir, wallLength, wallObb } from '../geometry/walls';
import { activeItems, activeLayout } from '../model/layout';
import type { Plan } from '../model/schema';

export const EXPORT_PX_PER_CM = 2;

const MARGIN = 80;
const HEADER = 70;
const LEGEND = 50;
const LEGEND_STEP = 150;
const HIGHLIGHT = '#c2410c';
// 개구부 폭 글자(font 11)와 위치 글자(font 9) 사이 간격: half-heights 5.5+4.5 + halo 1.5+1.5 + 여유
const OPENING_LABEL_GAP_CM = 16;
// 「중문」 글자: 벽 면에서 열리는 쪽으로, 벽 길이 글자(14)와 겹치지 않는 거리
const MIDDLE_LABEL_OFF_CM = 30;

const r2 = (n: number) => Math.round(n * 100) / 100 + 0;

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

const safeFilePart = (s: string) => s.replace(/[\\/:*?"<>|\s\u0000-\u001F]+/g, '-');

export function exportFileName(title: string, layoutName: string, kind: '2d' | '3d'): string {
  return `sn-house-interior-${safeFilePart(title)}-${safeFilePart(layoutName)}-${kind}.png`;
}

export function pdfFileName(title: string, layoutName: string): string {
  return `sn-house-interior-${safeFilePart(title)}-${safeFilePart(layoutName)}.pdf`;
}

export type PlanSvgOptions = {
  fontFamily?: string; // PDF는 jsPDF에 등록한 'Pretendard'
  header?: boolean; // 제목·단위 머리글
  items?: 'name' | 'number' | 'faint' | 'none'; // 가구 표시 방식
  dimensions?: boolean; // 벽 길이·개구부 폭
  fixtures?: boolean; // 전기 설비 마커·E번호와 범례
  dimensionLines?: boolean; // 벽 치수선과 개구부 위치(벽 시작점 기준)
  highlightIds?: string[]; // 주황 테두리로 강조할 가구
};

// 배치도 번호 = 제품 목록 번호. 제품을 찾을 수 없는 가구는 목록에 없으므로 번호도 없다
export function itemNumbers(plan: Plan): Map<string, number> {
  const known = activeItems(plan).filter((item) => findProduct(plan, item.productId));
  return new Map(known.map((item, i) => [item.id, i + 1]));
}

const mark = (n: number, verified: boolean | undefined) => (verified ? `${n}` : `≈${n}`);

function glyphShape(kind: FixtureKind, cx: number, cy: number): string {
  const g = FIXTURE_GLYPH[kind];
  const r = FIXTURE_R_CM;
  return g.shape === 'circle'
    ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${g.fill}" stroke="${g.stroke}" stroke-width="2"/>`
    : `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="${g.fill}" stroke="${g.stroke}" stroke-width="2"/>`;
}

export function planSvg(plan: Plan, options: PlanSvgOptions = {}): { svg: string; width: number; height: number } {
  const {
    fontFamily = 'sans-serif',
    header = true,
    items: itemMode = 'name',
    dimensions = true,
    fixtures = false,
    dimensionLines = false,
    highlightIds = [],
  } = options;
  const font = escapeXml(fontFamily);
  const text = (x: number, y: number, size: number, value: string, attrs: string) =>
    `<text x="${x}" y="${y}" font-size="${size}" font-family="${font}" ${attrs}>${escapeXml(value)}</text>`;
  // svg2pdf는 paint-order를 무시하므로 흰 테두리 글자를 먼저, 본 글자를 그 위에 그린다
  const label = (x: number, y: number, size: number, value: string, fill: string, extra: string) =>
    text(x, y, size, value, `fill="#ffffff" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" ${extra}`) +
    text(x, y, size, value, `fill="${fill}" ${extra}`);

  const b = planBounds(plan);
  const legendKinds = fixtures ? FIXTURE_KINDS.filter((k) => plan.fixtures.some((f) => f.kind === k)) : [];
  const headerH = header ? HEADER : 0;
  const legendH = legendKinds.length > 0 ? LEGEND : 0;
  const x0 = b.minX - MARGIN;
  const y0 = b.minY - MARGIN - headerH;
  const w = b.maxX - b.minX + MARGIN * 2;
  const h = b.maxY - b.minY + MARGIN * 2 + headerH + legendH;
  const center = 'text-anchor="middle" dominant-baseline="middle"';
  const parts: string[] = [`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>`];

  for (const wall of plan.walls) {
    parts.push(`<polygon points="${pointsAttr(corners(wallObb(wall)))}" fill="#3f3a33"/>`);
  }

  const wallById = new Map(plan.walls.map((x) => [x.id, x]));
  const middleLabels: string[] = [];
  for (const o of plan.openings) {
    const wall = wallById.get(o.wallId);
    if (!wall) continue;
    parts.push(`<polygon points="${pointsAttr(corners(openingObb(wall, o)))}" fill="#ffffff" stroke="#3f3a33" stroke-width="1"/>`);
    if (o.kind === 'door') {
      const leaves = doorLeaves(wall, o);
      for (const { swing: s } of leaves) {
        parts.push(`<path d="${sectorPath(s.center, s.radius, s.start, s.end)}" fill="none" stroke="#8b8b8b" stroke-width="1"/>`);
      }
      if (o.middle) {
        // 중문: 유리 문짝(하늘색 굵은 선 + 흰 심) 과 「중문」 글자
        for (const l of leaves) {
          const tip = { x: l.hinge.x + l.open.x * l.width, y: l.hinge.y + l.open.y * l.width };
          const seg = `x1="${r2(l.hinge.x)}" y1="${r2(l.hinge.y)}" x2="${r2(tip.x)}" y2="${r2(tip.y)}"`;
          parts.push(`<line ${seg} stroke="#4f9dde" stroke-width="3"/>`, `<line ${seg} stroke="#ffffff" stroke-width="1"/>`);
        }
        // 글자는 열리는 쪽(부채꼴 안)에, 폭 글자와 겹치지 않게. 다른 글자처럼 도형 뒤에 그린다
        const u = wallDir(wall);
        const n = o.swingIn ? { x: -u.y, y: u.x } : { x: u.y, y: -u.x };
        const mid = { x: wall.a.x + u.x * (o.offset + o.width / 2), y: wall.a.y + u.y * (o.offset + o.width / 2) };
        const d = wall.thickness / 2 + MIDDLE_LABEL_OFF_CM;
        middleLabels.push(label(r2(mid.x + n.x * d), r2(mid.y + n.y * d), 9, '중문', '#2b6cb0', center));
      }
    }
  }

  const highlight = new Set(highlightIds);
  const numbers = itemNumbers(plan);
  const placed = activeItems(plan).map((item) => ({ item, product: findProduct(plan, item.productId) }));
  if (itemMode !== 'none') {
    for (const { item, product } of placed) {
      const dims = product?.dims ?? { w: 50, d: 50, h: 50 };
      const fill = product ? itemColor(product, item.variantId) : MISSING_COLOR;
      const opacity = itemMode === 'faint' ? 0.3 : 0.85;
      const stroke = highlight.has(item.id) ? `stroke="${HIGHLIGHT}" stroke-width="3"` : 'stroke="#6b5e4b" stroke-width="1.5"';
      parts.push(
        `<polygon points="${pointsAttr(corners(itemObb(item.x, item.y, item.rotation, dims.w, dims.d)))}" fill="${fill}" fill-opacity="${opacity}" ${stroke}/>`,
      );
    }
  }

  if (fixtures) for (const f of plan.fixtures) parts.push(glyphShape(f.kind, f.pos.x, f.pos.y));

  if (dimensionLines) {
    const line = (x1: number, y1: number, x2: number, y2: number) =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8b8b8b" stroke-width="0.8"/>`;
    for (const wall of plan.walls) {
      if (Math.round(wallLength(wall)) === 0) continue;
      const u = wallDir(wall);
      const n = { x: -u.y, y: u.x }; // 벽 길이 글자와 같은 쪽
      const off = wall.thickness / 2 + 6;
      const at = (p: { x: number; y: number }, d: number) => ({ x: p.x + n.x * d, y: p.y + n.y * d });
      const [a, b] = [at(wall.a, off), at(wall.b, off)];
      parts.push(line(a.x, a.y, b.x, b.y));
      for (const end of [wall.a, wall.b]) {
        const [t1, t2] = [at(end, off - 3), at(end, off + 3)];
        parts.push(line(t1.x, t1.y, t2.x, t2.y));
      }
    }
  }

  if (dimensions) {
    for (const wall of plan.walls) {
      const len = Math.round(wallLength(wall));
      if (len === 0) continue;
      const u = wallDir(wall);
      const off = wall.thickness / 2 + 14;
      parts.push(label((wall.a.x + wall.b.x) / 2 - u.y * off, (wall.a.y + wall.b.y) / 2 + u.x * off, 12, mark(len, wall.verified), '#3f3a33', center));
    }
    for (const o of plan.openings) {
      const wall = wallById.get(o.wallId);
      if (!wall) continue;
      const u = wallDir(wall);
      const mid = o.offset + o.width / 2;
      const off = -(wall.thickness / 2 + 14);
      // 위치 글자를 먼저 그려서, 두 글자가 닿아도 더 중요한 폭 글자가 항상 위에 오도록 한다
      if (dimensionLines) {
        const off2 = off - OPENING_LABEL_GAP_CM;
        parts.push(label(wall.a.x + u.x * mid - u.y * off2, wall.a.y + u.y * mid + u.x * off2, 9, `${o.offset}–${o.offset + o.width}`, '#4f6b8a', center));
      }
      parts.push(label(wall.a.x + u.x * mid - u.y * off, wall.a.y + u.y * mid + u.x * off, 11, mark(o.width, o.verified), '#4f6b8a', center));
    }
  }

  parts.push(...middleLabels);
  for (const r of plan.rooms) parts.push(label(r.label.x, r.label.y, 18, r.name, '#6b5e4b', center));

  for (const { item, product } of placed) {
    if (itemMode === 'name') {
      const dims = product?.dims ?? { w: 50, d: 50, h: 50 };
      parts.push(label(item.x, item.y - 7, 12, product?.name ?? '알 수 없는 제품', '#1f2328', center));
      const size = `${dims.w}×${dims.d}`;
      parts.push(label(item.x, item.y + 9, 11, item.verified ? size : `≈${size}`, '#1f2328', center));
    } else if (itemMode === 'number') {
      const n = numbers.get(item.id);
      if (n !== undefined) parts.push(label(item.x, item.y, 16, String(n), '#1f2328', `font-weight="bold" ${center}`));
    } else if (itemMode === 'faint' && highlight.has(item.id)) {
      parts.push(label(item.x, item.y, 12, product?.name ?? '알 수 없는 제품', HIGHLIGHT, center));
    }
  }

  if (fixtures) {
    for (const f of plan.fixtures) {
      const g = FIXTURE_GLYPH[f.kind];
      parts.push(text(f.pos.x, f.pos.y, 10, g.letter, `fill="${g.letterFill}" font-weight="bold" ${center}`));
    }
    // 전기 설비 목록의 번호와 같은 E번호
    const fxNumbers = fixtureNumbers(plan);
    for (const f of plan.fixtures) {
      parts.push(label(f.pos.x + FIXTURE_R_CM + 2, f.pos.y, 9, `E${fxNumbers.get(f.id)}`, '#1f2328', 'dominant-baseline="middle"'));
    }
    const ly = b.maxY + MARGIN + LEGEND / 2;
    legendKinds.forEach((k, i) => {
      const cx = b.minX + i * LEGEND_STEP + FIXTURE_R_CM;
      const g = FIXTURE_GLYPH[k];
      parts.push(glyphShape(k, cx, ly));
      parts.push(text(cx, ly, 10, g.letter, `fill="${g.letterFill}" font-weight="bold" ${center}`));
      parts.push(text(cx + FIXTURE_R_CM + 8, ly, 14, FIXTURE_LABEL[k], 'fill="#1f2328" dominant-baseline="middle"'));
    });
  }

  if (header) {
    parts.push(text(x0 + 20, y0 + 30, 22, `${plan.info.title} · ${activeLayout(plan).name}`, 'fill="#1f2328" font-weight="bold"'));
    parts.push(text(x0 + 20, y0 + 56, 14, `단위: cm · ≈ 표시는 실측 미확인 치수 (${unverifiedCount(plan)}개)`, 'fill="#6b7280"'));
  }

  const width = Math.round(w * EXPORT_PX_PER_CM);
  const height = Math.round(h * EXPORT_PX_PER_CM);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${w} ${h}">${parts.join('')}</svg>`,
    width,
    height,
  };
}
