import { nearestWall } from '../geometry/structure';
import { wallDir, wallLength } from '../geometry/walls';
import { activeItems } from '../model/layout';
import type { Fixture, Plan, Product, Vec2, Wall } from '../model/schema';

export type FixtureKind = Fixture['kind'];

export const FIXTURE_KINDS: FixtureKind[] = ['outlet', 'outlet-dedicated', 'outlet-waterproof', 'switch', 'light'];

export const FIXTURE_LABEL: Record<FixtureKind, string> = {
  outlet: '콘센트',
  'outlet-dedicated': '전용회로 콘센트',
  'outlet-waterproof': '방수 콘센트',
  switch: '스위치',
  light: '조명',
};

// 설치 높이 기본값(cm, 바닥 기준). 조명은 천장(기본 벽 높이)
export const FIXTURE_DEFAULT_HEIGHT: Record<FixtureKind, number> = {
  outlet: 30,
  'outlet-dedicated': 30,
  'outlet-waterproof': 120,
  switch: 120,
  light: 230,
};

export type FixtureGlyph = { shape: 'circle' | 'square'; fill: string; stroke: string; letter: string; letterFill: string };

export const FIXTURE_GLYPH: Record<FixtureKind, FixtureGlyph> = {
  outlet: { shape: 'circle', fill: '#ffffff', stroke: '#c2410c', letter: 'C', letterFill: '#c2410c' },
  'outlet-dedicated': { shape: 'circle', fill: '#c2410c', stroke: '#c2410c', letter: '전', letterFill: '#ffffff' },
  'outlet-waterproof': { shape: 'circle', fill: '#ffffff', stroke: '#0e7490', letter: '방', letterFill: '#0e7490' },
  switch: { shape: 'square', fill: '#ffffff', stroke: '#4338ca', letter: 'S', letterFill: '#4338ca' },
  light: { shape: 'circle', fill: '#fef3c7', stroke: '#a16207', letter: 'L', letterFill: '#a16207' },
};

export const FIXTURE_R_CM = 9;
export const FIXTURE_SNAP_CM = 30;
export const DEDICATED_RADIUS_CM = 150;

const r0 = (n: number) => Math.round(n) + 0; // -0 방지

export function snapFixture(walls: Wall[], p: Vec2, kind: FixtureKind, snap: boolean): { pos: Vec2; wallId?: string } {
  const free = { pos: { x: r0(p.x), y: r0(p.y) } };
  if (!snap || kind === 'light') return free;
  const wall = nearestWall(walls, p, FIXTURE_SNAP_CM);
  if (!wall) return free;
  const u = wallDir(wall);
  const t = Math.max(0, Math.min(wallLength(wall), (p.x - wall.a.x) * u.x + (p.y - wall.a.y) * u.y));
  const foot = { x: wall.a.x + u.x * t, y: wall.a.y + u.y * t };
  const n = { x: -u.y, y: u.x };
  const side = (p.x - foot.x) * n.x + (p.y - foot.y) * n.y < 0 ? -1 : 1;
  const off = (wall.thickness / 2) * side;
  return { pos: { x: r0(foot.x + n.x * off), y: r0(foot.y + n.y * off) }, wallId: wall.id };
}

export function missingDedicatedCircuit(plan: Plan, resolve: (productId: string) => Product | undefined): string[] {
  const outlets = plan.fixtures.filter((f) => f.kind === 'outlet-dedicated');
  return activeItems(plan)
    .filter((item) => resolve(item.productId)?.power?.dedicatedCircuit)
    .filter((item) => !outlets.some((f) => Math.hypot(f.pos.x - item.x, f.pos.y - item.y) <= DEDICATED_RADIUS_CM))
    .map((item) => item.id);
}

export function fixtureSummary(fixtures: Fixture[]): string {
  return FIXTURE_KINDS.map((k) => [k, fixtures.filter((f) => f.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${FIXTURE_LABEL[k]} ${n}개`)
    .join(', ');
}
