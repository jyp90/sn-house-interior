// 개구부(문·창) 3D 부품 계산 — 순수 함수, React/three 의존 없음 (spec §23)
import { leafWidths, SLIDING_RAIL_GAP_CM } from '../geometry/clearance';
import { clampToWall, wallDir, wallLength } from '../geometry/walls';
import type { Opening, Vec2, Wall } from '../model/schema';

export type OpeningPartKind = 'frame' | 'leaf' | 'glass' | 'handle' | 'mullion';

export type OpeningPart = {
  kind: OpeningPartKind;
  cx: number;
  cy: number;
  yCenter: number;
  w: number;
  h: number;
  d: number;
  angle: number;
  glassLeaf?: boolean;
};

export const FRAME_CM = 5; // 틀 폭/높이
export const LEAF_CM = 4; // 문짝 두께
export const GLASS_CM = 1; // 유리 두께
export const HANDLE_H_CM = 100; // 손잡이 높이

// 벽 중심선 위, a점에서 along(cm)만큼 떨어진 점
function at(wall: Wall, along: number): Vec2 {
  const u = wallDir(wall);
  return { x: wall.a.x + u.x * along, y: wall.a.y + u.y * along };
}

export function openingParts(wall: Wall, o: Opening): OpeningPart[] {
  if (o.kind === 'opening') return [];

  // 벽 끝을 넘어가거나(wallPieces와 같은 clampToWall) 벽보다 높은 개구부는 벽 안쪽으로 잘린다
  const [clampedStart, clampedEnd] = clampToWall(o, wallLength(wall));
  const offset = clampedStart;
  const width = clampedEnd - clampedStart;
  if (width <= 0) return [];
  const height = Math.min(o.height, wall.height - o.sill);
  if (height <= 0) return [];

  const u = wallDir(wall);
  const angle = Math.atan2(u.y, u.x);
  const T = wall.thickness;
  const frameD = T + 1;
  const parts: OpeningPart[] = [];

  // 문틀/창틀: 양옆 세로틀 + 윗틀(+ 창은 아래틀)
  const leftT = offset + FRAME_CM / 2;
  const rightT = offset + width - FRAME_CM / 2;
  const jambYCenter = o.sill + height / 2;
  for (const t of [leftT, rightT]) {
    const p = at(wall, t);
    parts.push({ kind: 'frame', cx: p.x, cy: p.y, yCenter: jambYCenter, w: FRAME_CM, h: height, d: frameD, angle });
  }
  const headT = offset + width / 2;
  const headP = at(wall, headT);
  const railW = width - 2 * FRAME_CM;
  parts.push({
    kind: 'frame',
    cx: headP.x,
    cy: headP.y,
    yCenter: o.sill + height - FRAME_CM / 2,
    w: railW,
    h: FRAME_CM,
    d: frameD,
    angle,
  });
  if (o.kind === 'window') {
    parts.push({
      kind: 'frame',
      cx: headP.x,
      cy: headP.y,
      yCenter: o.sill + FRAME_CM / 2,
      w: railW,
      h: FRAME_CM,
      d: frameD,
      angle,
    });
  }

  if (o.kind === 'door' && o.leaves === 'sliding') {
    // 외짝 슬라이딩(spec §47): 개구부 폭 전체 문짝 한 장을 레일 면(swingIn 쪽 법선)으로 두께/2 + 3cm 띄워 닫힌 상태로.
    // 회전 없음. 손잡이는 hinge 반대쪽 끝에서 6cm 안쪽, 문짝 면 양쪽으로 2cm씩 나온다
    const n = o.swingIn ? { x: -u.y, y: u.x } : { x: u.y, y: -u.x };
    const off = T / 2 + SLIDING_RAIL_GAP_CM;
    const railAt = (along: number): Vec2 => {
      const p = at(wall, along);
      return { x: p.x + n.x * off, y: p.y + n.y * off };
    };
    const leafH = height - FRAME_CM - 1;
    const centerP = railAt(offset + width / 2);
    parts.push({ kind: 'leaf', cx: centerP.x, cy: centerP.y, yCenter: o.sill + leafH / 2, w: width, h: leafH, d: LEAF_CM, angle, glassLeaf: !!o.middle });
    const handleP = railAt(o.hinge === 'start' ? offset + width - 6 : offset + 6);
    parts.push({ kind: 'handle', cx: handleP.x, cy: handleP.y, yCenter: HANDLE_H_CM, w: 2, h: 2, d: LEAF_CM + 4, angle });
  } else if (o.kind === 'door') {
    // 벽 끝으로 잘린 개구부라면 문짝 폭도 잘린 폭(width) 기준으로 나눈다
    const [hingeSide, otherSide] = leafWidths({ ...o, width });
    // startAtOffset: 문짝 경첩이 offset 쪽(true)인지 offset+width 쪽(false)인지
    const leaves: { startAtOffset: boolean; width: number }[] =
      o.hinge === 'start'
        ? [{ startAtOffset: true, width: hingeSide }, { startAtOffset: false, width: otherSide }]
        : [{ startAtOffset: false, width: hingeSide }, { startAtOffset: true, width: otherSide }];
    const nonZeroLeaves = leaves.filter((l) => l.width > 0);
    // 문짝이 하나뿐이면 손잡이 쪽 가장자리가 맞은편 문틀 안쪽 면이라 FRAME_CM만큼 더 들어간다.
    // 양여닫이·비대칭은 그 가장자리가 다른 문짝과 만나는 선이라 6cm만 들어간다(리뷰 반영 2026-10-09)
    const singleLeaf = nonZeroLeaves.length === 1;

    const leafH = height - FRAME_CM - 1;
    const leafYCenter = o.sill + leafH / 2;
    for (const leaf of nonZeroLeaves) {
      const hingeT = leaf.startAtOffset ? offset : offset + width;
      const dir = leaf.startAtOffset ? 1 : -1;
      const centerT = hingeT + dir * (leaf.width / 2);
      const centerP = at(wall, centerT);
      parts.push({
        kind: 'leaf',
        cx: centerP.x,
        cy: centerP.y,
        yCenter: leafYCenter,
        w: leaf.width - 1,
        h: leafH,
        d: LEAF_CM,
        angle,
        glassLeaf: !!o.middle,
      });
      const inset = singleLeaf ? FRAME_CM + 6 : 6;
      const handleT = hingeT + dir * (leaf.width - inset);
      const handleP = at(wall, handleT);
      parts.push({
        kind: 'handle',
        cx: handleP.x,
        cy: handleP.y,
        yCenter: HANDLE_H_CM,
        w: 2,
        h: 2,
        d: T + 4,
        angle,
      });
    }
  }

  if (o.kind === 'window') {
    const glassT = offset + width / 2;
    const glassP = at(wall, glassT);
    const glassYCenter = o.sill + height / 2;
    const glassW = width - 2 * FRAME_CM;
    const glassH = height - 2 * FRAME_CM;
    parts.push({ kind: 'glass', cx: glassP.x, cy: glassP.y, yCenter: glassYCenter, w: glassW, h: glassH, d: GLASS_CM, angle });
    if (width > 120) {
      parts.push({
        kind: 'mullion',
        cx: glassP.x,
        cy: glassP.y,
        yCenter: glassYCenter,
        w: 4,
        h: glassH,
        d: FRAME_CM,
        angle,
      });
    }
  }

  return parts;
}
