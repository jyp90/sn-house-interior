import { describe, expect, it } from 'vitest';
import { FIXTURE_GLYPH } from '../electrical/fixtures';
import type { Fixture, Wall } from '../model/schema';
import { fixtureParts } from './fixtureParts';

const wall: Wall = { id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 };
const fx = (over: Partial<Fixture>): Fixture => ({ id: 'f', kind: 'outlet', pos: { x: 100, y: 5 }, height: 30, ...over });

describe('fixtureParts', () => {
  it('벽 +y 면 콘센트: 판은 벽면에서 0.75cm 밖(두께 1.5의 절반), 표식은 판 바깥면 위', () => {
    const parts = fixtureParts(fx({ wallId: 'w' }), [wall], 230);
    // 판 중심 = pos + n·0.75 = (100, 5 + 0.75)
    expect(parts[0]).toEqual({ kind: 'plate', cx: 100, cy: 5.75, yCenter: 30, w: 8, h: 8, d: 1.5, angle: 0, color: '#f4f4f4' });
    // 표식 중심 = pos + n·(1.5 + 0.5/2) = (100, 6.75)
    expect(parts[1]).toEqual({ kind: 'mark', cx: 100, cy: 6.75, yCenter: 30, w: 4, h: 4, d: 0.5, angle: 0, color: FIXTURE_GLYPH.outlet.stroke });
    expect(parts).toHaveLength(2);
  });

  it('위치가 벽 몸체 안쪽이어도 판은 벽면(중심선 + 두께/2)에 붙는다', () => {
    // pos (100,3): 법선 쪽(+y) → 벽면 y=5, 판 중심 5 + 0.75, 표식 5 + 1.75
    const [plate, mark] = fixtureParts(fx({ wallId: 'w', pos: { x: 100, y: 3 } }), [wall], 230);
    expect(plate).toMatchObject({ cx: 100, cy: 5.75 });
    expect(mark).toMatchObject({ cx: 100, cy: 6.75 });
  });

  it('벽 -y 면이면 바깥 방향도 -y', () => {
    const [plate, mark] = fixtureParts(fx({ wallId: 'w', pos: { x: 100, y: -5 } }), [wall], 230);
    expect(plate.cy).toBeCloseTo(-5.75);
    expect(mark.cy).toBeCloseTo(-6.75);
  });

  it('세로 벽(a→b가 +y)은 각도 atan2(u.y,u.x)=π/2, 바깥 방향은 x축', () => {
    const vwall: Wall = { ...wall, b: { x: 0, y: 400 } };
    // n = (-u.y, u.x) = (-1, 0); pos x=-5 → n 쪽 → 바깥 = (-1, 0)
    const [plate] = fixtureParts(fx({ wallId: 'w', pos: { x: -5, y: 100 } }), [vwall], 230);
    expect(plate.angle).toBeCloseTo(Math.PI / 2);
    expect(plate.cx).toBeCloseTo(-5.75);
    expect(plate.cy).toBeCloseTo(100);
  });

  it('방수 콘센트 판은 10×10, 스위치는 8×8 + 스위치 글리프 색 표식', () => {
    expect(fixtureParts(fx({ wallId: 'w', kind: 'outlet-waterproof', height: 120 }), [wall], 230)[0]).toMatchObject({ w: 10, h: 10, yCenter: 120 });
    const sw = fixtureParts(fx({ wallId: 'w', kind: 'switch', height: 120 }), [wall], 230);
    expect(sw[0]).toMatchObject({ w: 8, h: 8 });
    expect(sw[1].color).toBe(FIXTURE_GLYPH.switch.stroke);
  });

  it('조명: 지름 24·두께 2 원반, 중심 = min(높이, 천장) − 1 − 두께/2', () => {
    expect(fixtureParts(fx({ kind: 'light', pos: { x: 200, y: 200 }, height: 230 }), [wall], 230)).toEqual([
      { kind: 'disc', cx: 200, cy: 200, yCenter: 228, w: 24, h: 2, d: 24, angle: 0, color: '#fef3c7' },
    ]);
    // 천장보다 높게 적힌 조명은 천장 아래로
    expect(fixtureParts(fx({ kind: 'light', height: 300 }), [wall], 240)[0].yCenter).toBe(238);
    expect(fixtureParts(fx({ kind: 'light', height: 200 }), [wall], 240)[0].yCenter).toBe(198);
  });

  it('조명 원반은 바닥 아래로 내려가지 않는다(높이 0 → 중심 두께/2)', () => {
    expect(fixtureParts(fx({ kind: 'light', height: 0 }), [wall], 230)[0].yCenter).toBe(1);
  });

  it('벽에 붙지 않았거나 벽이 사라진 콘센트·스위치는 6cm 정육면체', () => {
    const box = { kind: 'box', cx: 100, cy: 5, yCenter: 30, w: 6, h: 6, d: 6, angle: 0, color: FIXTURE_GLYPH.outlet.stroke };
    expect(fixtureParts(fx({}), [wall], 230)).toEqual([box]);
    expect(fixtureParts(fx({ wallId: 'gone' }), [wall], 230)).toEqual([box]);
  });
});
