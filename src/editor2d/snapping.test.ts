import { describe, expect, it } from 'vitest';
import { snapAngle, snapToEndpoint, wallSegments, wallToolPoint } from './snapping';

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

describe('wallSegments', () => {
  it('같은 점이 연속되면 그 구간은 버린다', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }];
    expect(wallSegments(pts)).toEqual([
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [{ x: 100, y: 0 }, { x: 100, y: 50 }],
    ]);
  });
});
