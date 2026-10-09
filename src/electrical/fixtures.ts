import { findProduct } from '../catalog/products';
import { distanceToWall, nearestWall } from '../geometry/structure';
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

// 평면 객체 정체성을 키로 한 캐시: 2D·속성 패널·전기 패널이 평면당 한 번만 계산한다 (spec §30)
const missingCache = new WeakMap<Plan, string[]>();

export function missingDedicatedCircuitCached(plan: Plan): string[] {
  let ids = missingCache.get(plan);
  if (!ids) {
    ids = missingDedicatedCircuit(plan, (id) => findProduct(plan, id));
    missingCache.set(plan, ids);
  }
  return ids;
}

export function fixtureSummary(fixtures: Fixture[]): string {
  return FIXTURE_KINDS.map((k) => [k, fixtures.filter((f) => f.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${FIXTURE_LABEL[k]} ${n}개`)
    .join(', ');
}

// 도면 표기 E{n}과 전기 설비 목록 번호: plan.fixtures 순서, 1부터
export function fixtureNumbers(plan: Plan): Map<string, number> {
  return new Map(plan.fixtures.map((f, i) => [f.id, i + 1]));
}

const sameWall = (a: Wall, b: Wall) =>
  a.a.x === b.a.x && a.a.y === b.a.y && a.b.x === b.b.x && a.b.y === b.b.y && a.thickness === b.thickness;

// 벽이 바뀌면 벽에 붙은 설비를 같은 쪽 벽면, 같은 비율 위치로 옮긴다. 벽이 사라지면 wallId만 지운다
export function refitFixtures(oldWalls: Wall[], newWalls: Wall[], fixtures: Fixture[]): Fixture[] {
  const oldById = new Map(oldWalls.map((w) => [w.id, w]));
  const newById = new Map(newWalls.map((w) => [w.id, w]));
  return fixtures.map((f) => {
    if (!f.wallId) return f;
    const before = oldById.get(f.wallId);
    const after = newById.get(f.wallId);
    if (!after) {
      const { wallId: _gone, ...rest } = f;
      return rest;
    }
    if (!before || sameWall(before, after)) return f;
    const oldLen = wallLength(before);
    const ou = wallDir(before);
    const t = Math.max(0, Math.min(oldLen, (f.pos.x - before.a.x) * ou.x + (f.pos.y - before.a.y) * ou.y));
    const normalOff = (f.pos.x - before.a.x) * -ou.y + (f.pos.y - before.a.y) * ou.x;
    const side = normalOff < 0 ? -1 : 1;
    const newLen = wallLength(after);
    const nt = Math.max(0, Math.min(newLen, newLen !== oldLen && oldLen > 0 ? (t * newLen) / oldLen : t));
    const u = wallDir(after);
    const n = { x: -u.y, y: u.x };
    const off = (after.thickness / 2) * side;
    return { ...f, pos: { x: r0(after.a.x + u.x * nt + n.x * off), y: r0(after.a.y + u.y * nt + n.y * off) } };
  });
}

// 종류 변경: 높이가 이전 종류 기본값이면 새 기본값으로, 조명은 벽에서 떼고, 콘센트 종류는 스위치 그룹을 지운다
export function kindChangePatch(fixture: Fixture, kind: FixtureKind): Partial<Omit<Fixture, 'id'>> {
  const patch: Partial<Omit<Fixture, 'id'>> = { kind };
  if (fixture.height === FIXTURE_DEFAULT_HEIGHT[fixture.kind]) patch.height = FIXTURE_DEFAULT_HEIGHT[kind];
  if (kind === 'light') patch.wallId = undefined;
  // 스위치 그룹은 스위치·조명에만 의미가 있다(spec §27.1)
  if (kind !== 'switch' && kind !== 'light') patch.group = undefined;
  return patch;
}

// 좌표를 직접 고친 뒤에도 그 벽면에 있으면(중심선에서 두께/2+1cm 이내) wallId를 유지한다
export function keepWallIdAfterMove(walls: Wall[], fixture: Fixture, pos: Vec2): string | undefined {
  const wall = walls.find((w) => w.id === fixture.wallId);
  if (!wall) return undefined;
  return distanceToWall(wall, pos) <= wall.thickness / 2 + 1 ? wall.id : undefined;
}

export type SwitchGroup = { name: string; switches: Fixture[]; lights: Fixture[] };

// 스위치 그룹(spec §27): 그룹 이름이 있는 스위치·조명만, 이름 순. 콘센트의 group은 무시한다
export function switchGroups(fixtures: Fixture[]): SwitchGroup[] {
  const byName = new Map<string, SwitchGroup>();
  for (const f of fixtures) {
    if (!f.group || (f.kind !== 'switch' && f.kind !== 'light')) continue;
    let g = byName.get(f.group);
    if (!g) {
      g = { name: f.group, switches: [], lights: [] };
      byName.set(f.group, g);
    }
    (f.kind === 'switch' ? g.switches : g.lights).push(f);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export type SwitchLink = { switchId: string; lightId: string; a: Vec2; b: Vec2 };
export const SWITCH_LINK_COLOR = '#4338ca';

// 같은 그룹의 스위치마다 그 그룹의 조명 각각으로 잇는 선(2D 전기 모드·PDF 전기 계획도 공용)
export function switchLinks(fixtures: Fixture[]): SwitchLink[] {
  return switchGroups(fixtures).flatMap((g) =>
    g.switches.flatMap((s) => g.lights.map((l) => ({ switchId: s.id, lightId: l.id, a: s.pos, b: l.pos }))),
  );
}
