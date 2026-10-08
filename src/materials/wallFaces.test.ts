import { describe, expect, it } from 'vitest';
import type { Room } from '../model/schema';
import { wallFaceRooms } from './wallFaces';

const room = (id: string, polygon: Room['polygon']): Room => ({ id, name: id, label: polygon![0], polygon });
const left = room('L', [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }]);
const right = room('R', [{ x: 310, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 300 }, { x: 310, y: 300 }]);
const noPoly: Room = { id: 'N', name: 'N', label: { x: 0, y: 0 } };
// 벽 중심 x=305, 두께 10, 세로로 놓인 벽 (angle = π/2)
const piece = { cx: 305, cy: 150, hw: 150, hd: 5, angle: Math.PI / 2 };

describe('wallFaceRooms', () => {
  it('양 측면이 속한 방을 찾는다', () => {
    const r = wallFaceRooms(piece, [noPoly, left, right]);
    expect(new Set([r.front?.id, r.back?.id])).toEqual(new Set(['L', 'R']));
  });
  it('어느 방에도 없으면 null', () => {
    const r = wallFaceRooms({ ...piece, cx: 1000 }, [left, right]);
    expect(r).toEqual({ front: null, back: null });
  });
  it('겹치는 방은 먼저 나온 방이 이긴다', () => {
    const big = room('B', [{ x: -10, y: -10 }, { x: 700, y: -10 }, { x: 700, y: 400 }, { x: -10, y: 400 }]);
    const r = wallFaceRooms(piece, [big, left, right]);
    expect(r.front?.id).toBe('B');
    expect(r.back?.id).toBe('B');
  });
});
