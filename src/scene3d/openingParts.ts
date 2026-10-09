// 개구부(문·창) 3D 부품 계산 — 순수 함수, React/three 의존 없음 (spec §23)
import { leafWidths } from '../geometry/clearance';
import { wallDir } from '../geometry/walls';
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

  const u = wallDir(wall);
  const angle = Math.atan2(u.y, u.x);
  const T = wall.thickness;
  const frameD = T + 1;
  const parts: OpeningPart[] = [];

  // 문틀/창틀: 양옆 세로틀 + 윗틀(+ 창은 아래틀)
  const leftT = o.offset + FRAME_CM / 2;
  const rightT = o.offset + o.width - FRAME_CM / 2;
  const jambYCenter = o.sill + o.height / 2;
  for (const t of [leftT, rightT]) {
    const p = at(wall, t);
    parts.push({ kind: 'frame', cx: p.x, cy: p.y, yCenter: jambYCenter, w: FRAME_CM, h: o.height, d: frameD, angle });
  }
  const headT = o.offset + o.width / 2;
  const headP = at(wall, headT);
  const railW = o.width - 2 * FRAME_CM;
  parts.push({
    kind: 'frame',
    cx: headP.x,
    cy: headP.y,
    yCenter: o.sill + o.height - FRAME_CM / 2,
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

  if (o.kind === 'door') {
    const [hingeSide, otherSide] = leafWidths(o);
    // startAtOffset: 문짝 경첩이 o.offset 쪽(true)인지 o.offset+o.width 쪽(false)인지
    const leaves: { startAtOffset: boolean; width: number }[] =
      o.hinge === 'start'
        ? [{ startAtOffset: true, width: hingeSide }, { startAtOffset: false, width: otherSide }]
        : [{ startAtOffset: false, width: hingeSide }, { startAtOffset: true, width: otherSide }];

    const leafH = o.height - FRAME_CM - 1;
    const leafYCenter = o.sill + leafH / 2;
    for (const leaf of leaves.filter((l) => l.width > 0)) {
      const hingeT = leaf.startAtOffset ? o.offset : o.offset + o.width;
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
      const handleT = hingeT + dir * (leaf.width - 6);
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
    const glassT = o.offset + o.width / 2;
    const glassP = at(wall, glassT);
    const glassYCenter = o.sill + o.height / 2;
    const glassW = o.width - 2 * FRAME_CM;
    const glassH = o.height - 2 * FRAME_CM;
    parts.push({ kind: 'glass', cx: glassP.x, cy: glassP.y, yCenter: glassYCenter, w: glassW, h: glassH, d: GLASS_CM, angle });
    if (o.width > 120) {
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
