import { axes, type OBB } from '../geometry/obb';
import { pointInPolygon } from '../geometry/polygon';
import type { Room } from '../model/schema';

export const WALL_TOP_COLOR = '#3f3a33';
const PROBE_CM = 1;

function roomAt(p: { x: number; y: number }, rooms: Room[]): Room | null {
  for (const r of rooms) if (r.polygon && pointInPolygon(p, r.polygon)) return r;
  return null;
}

// 벽 조각의 두 측면(법선 ±v 방향)이 어느 방 안에 있는지. front = +v 쪽
export function wallFaceRooms(piece: OBB, rooms: Room[]): { front: Room | null; back: Room | null } {
  const [, v] = axes(piece);
  const d = piece.hd + PROBE_CM;
  return {
    front: roomAt({ x: piece.cx + v.x * d, y: piece.cy + v.y * d }, rooms),
    back: roomAt({ x: piece.cx - v.x * d, y: piece.cy - v.y * d }, rooms),
  };
}
