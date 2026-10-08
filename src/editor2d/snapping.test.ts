import { describe, expect, it } from 'vitest';
import type { Wall } from '../model/schema';
import { snapAngle, snapToEndpoint, wallFaceCorners, wallSegments, wallToolPoint } from './snapping';

describe('snapAngle', () => {
  it('0°/45°/90° 방향으로 맞춘다', () => {
    expect(snapAngle({ x: 0, y: 0 }, { x: 100, y: 7 })).toEqual({ x: 100, y: 0 });
    expect(snapAngle({ x: 0, y: 0 }, { x: 100, y: 95 })).toEqual({ x: 98, y: 98 });
    expect(snapAngle({ x: 0, y: 0 }, { x: 7, y: 100 })).toEqual({ x: 0, y: 100 });
  });
});

describe('snapToEndpoint / wallToolPoint', () => {
  it('15cm 이내 끝점에 붙는다', () => {
    expect(snapToEndpoint({ x: 203, y: 2 }, [{ x: 200, y: 0 }])).toEqual({ x: 200, y: 0 });
    expect(snapToEndpoint({ x: 230, y: 0 }, [{ x: 200, y: 0 }])).toBeNull();
  });

  it('끝점 스냅이 각도 스냅보다 먼저다', () => {
    expect(wallToolPoint({ x: 203, y: 12 }, { x: 0, y: 0 }, [{ x: 200, y: 10 }], true)).toEqual({ x: 200, y: 10 });
  });

  it('스냅을 끄면 반올림만 한다', () => {
    expect(wallToolPoint({ x: 203.4, y: 2.6 }, { x: 0, y: 0 }, [{ x: 200, y: 0 }], false)).toEqual({ x: 203, y: 3 });
  });
});

describe('wallFaceCorners', () => {
  const w1: Wall = { id: 'w1', a: { x: 0, y: 0 }, b: { x: 600, y: 0 }, thickness: 20, height: 230 };
  const w4: Wall = { id: 'w4', a: { x: 0, y: 400 }, b: { x: 0, y: 0 }, thickness: 20, height: 230 };

  it('끝점을 공유하는 두 벽의 안쪽/바깥쪽 마감면 교차점을 모두 낸다', () => {
    const pts = wallFaceCorners([w1, w4]);
    expect(pts).toEqual(
      expect.arrayContaining([{ x: 10, y: 10 }, { x: -10, y: -10 }, { x: 10, y: -10 }, { x: -10, y: 10 }]),
    );
    expect(pts).toHaveLength(4);
  });

  it('끝점을 공유하지 않는 벽은 아무것도 내지 않는다', () => {
    const a: Wall = { id: 'a', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thickness: 10, height: 230 };
    const b: Wall = { id: 'b', a: { x: 200, y: 200 }, b: { x: 300, y: 200 }, thickness: 10, height: 230 };
    expect(wallFaceCorners([a, b])).toEqual([]);
  });

  it('평행하게 이어지는 벽은 교차점이 없어도 죽지 않는다', () => {
    const a: Wall = { id: 'a', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thickness: 10, height: 230 };
    const b: Wall = { id: 'b', a: { x: 100, y: 0 }, b: { x: 200, y: 0 }, thickness: 10, height: 230 };
    expect(wallFaceCorners([a, b])).toEqual([]);
  });
});

describe('wallSegments', () => {
  it('같은 점이 연속되면 그 구간은 버린다', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }];
    expect(wallSegments(pts)).toEqual([
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [{ x: 100, y: 0 }, { x: 100, y: 50 }],
    ]);
  });
});
