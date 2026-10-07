import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planWallObbs } from '../geometry/walls';
import { parsePlan } from './parse';

const FILE = 'private/our-home.local.json';

describe.skipIf(!existsSync(FILE))('비공개 우리 집 프리셋', () => {
  it('스키마를 통과하고 외곽이 1010×690이다', () => {
    const r = parsePlan(JSON.parse(readFileSync(FILE, 'utf8')));
    if (!r.ok) throw new Error(r.error);
    const xs = r.plan.walls.flatMap((w) => [w.a.x, w.b.x]);
    const ys = r.plan.walls.flatMap((w) => [w.a.y, w.b.y]);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([0, 1010, 0, 690]);
    expect(planWallObbs(r.plan).length).toBeGreaterThan(r.plan.walls.length);
  });

  it('모든 개구부가 존재하는 벽을 참조하고 벽 길이 안에 있다', () => {
    const r = parsePlan(JSON.parse(readFileSync(FILE, 'utf8')));
    if (!r.ok) throw new Error(r.error);
    for (const o of r.plan.openings) {
      const w = r.plan.walls.find((x) => x.id === o.wallId);
      expect(w, o.id).toBeDefined();
      const len = Math.hypot(w!.b.x - w!.a.x, w!.b.y - w!.a.y);
      expect(o.offset + o.width, o.id).toBeLessThanOrEqual(len);
    }
  });
});
