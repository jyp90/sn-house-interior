import { describe, expect, it } from 'vitest';
import { areaM2, closesPolygon, isValidPolygon, pointInPolygon, polygonArea, polygonCentroid } from './polygon';

const rect = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }];
// L자: 400×300에서 오른쪽 아래 200×150을 뺀 모양
const L = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 150 }, { x: 200, y: 150 }, { x: 200, y: 300 }, { x: 0, y: 300 }];

describe('polygon', () => {
  it('면적은 점 순서와 무관하게 양수', () => {
    expect(polygonArea(rect)).toBe(120000);
    expect(polygonArea([...rect].reverse())).toBe(120000);
    expect(polygonArea(L)).toBe(90000);
    expect(areaM2(L)).toBe(9);
    expect(areaM2([{ x: 0, y: 0 }, { x: 345, y: 0 }, { x: 345, y: 210 }, { x: 0, y: 210 }])).toBe(7.2);
  });
  it('무게중심', () => {
    expect(polygonCentroid(rect)).toEqual({ x: 200, y: 150 });
    const c = polygonCentroid(L);
    expect(c.x).toBeLessThan(200);
    expect(pointInPolygon(c, L)).toBe(true);
  });
  it('오목 다각형 내부 판정', () => {
    expect(pointInPolygon({ x: 100, y: 100 }, L)).toBe(true);
    expect(pointInPolygon({ x: 300, y: 250 }, L)).toBe(false);
    expect(pointInPolygon({ x: 0, y: 100 }, L)).toBe(true); // 경계
    expect(pointInPolygon({ x: -1, y: 100 }, L)).toBe(false);
  });
  it('유효성: 3점 미만·연속 중복·면적 0은 거부', () => {
    expect(isValidPolygon(rect)).toBe(true);
    expect(isValidPolygon(rect.slice(0, 2))).toBe(false);
    expect(isValidPolygon([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }])).toBe(false);
    expect(isValidPolygon([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }])).toBe(false);
  });
  it('첫 점 근처 클릭이면 닫는다', () => {
    expect(closesPolygon({ x: 10, y: 8 }, { x: 0, y: 0 }, 15)).toBe(true);
    expect(closesPolygon({ x: 20, y: 0 }, { x: 0, y: 0 }, 15)).toBe(false);
  });
});
