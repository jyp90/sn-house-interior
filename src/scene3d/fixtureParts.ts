// 전기 설비 3D 부품 계산 — 순수 함수, React/three 의존 없음 (spec §27.3)
import { FIXTURE_GLYPH } from '../electrical/fixtures';
import { wallDir } from '../geometry/walls';
import type { Fixture, Wall } from '../model/schema';

export type FixturePart = {
  kind: 'plate' | 'mark' | 'disc' | 'box';
  cx: number;
  cy: number;
  yCenter: number;
  w: number;
  h: number;
  d: number;
  angle: number;
  color: string;
};

export const PLATE_CM = 8; // 콘센트·스위치 판 한 변
export const PLATE_WATERPROOF_CM = 10; // 방수 콘센트 판 한 변
export const PLATE_D_CM = 1.5; // 판 두께
export const MARK_CM = 4; // 판 가운데 표식 한 변
export const MARK_D_CM = 0.5; // 표식 두께
export const PLATE_COLOR = '#f4f4f4';
export const LIGHT_DIAMETER_CM = 24;
export const LIGHT_D_CM = 2;
export const LIGHT_GAP_CM = 1; // 천장(또는 설치 높이)에서 원반 윗면까지
export const LIGHT_COLOR = '#fef3c7';
export const LOOSE_BOX_CM = 6; // 벽에 붙지 않은 콘센트·스위치 상자

export function fixtureParts(f: Fixture, walls: Wall[], ceiling: number): FixturePart[] {
  const glyphColor = FIXTURE_GLYPH[f.kind].stroke;

  if (f.kind === 'light') {
    const top = Math.min(f.height, ceiling) - LIGHT_GAP_CM;
    return [
      {
        kind: 'disc',
        cx: f.pos.x,
        cy: f.pos.y,
        yCenter: Math.max(LIGHT_D_CM / 2, top - LIGHT_D_CM / 2),
        w: LIGHT_DIAMETER_CM,
        h: LIGHT_D_CM,
        d: LIGHT_DIAMETER_CM,
        angle: 0,
        color: LIGHT_COLOR,
      },
    ];
  }

  const wall = f.wallId ? walls.find((w) => w.id === f.wallId) : undefined;
  if (!wall) {
    const s = LOOSE_BOX_CM;
    return [{ kind: 'box', cx: f.pos.x, cy: f.pos.y, yCenter: f.height, w: s, h: s, d: s, angle: 0, color: glyphColor }];
  }

  // 벽 중심선에서 설비 위치 쪽으로 향하는 벽면 법선(바깥 방향). 판은 pos가 아니라 그 쪽 벽면에 붙인다
  const u = wallDir(wall);
  const n = { x: -u.y, y: u.x };
  const normalOff = (f.pos.x - wall.a.x) * n.x + (f.pos.y - wall.a.y) * n.y;
  const side = normalOff < 0 ? -1 : 1;
  const out = { x: n.x * side, y: n.y * side };
  // pos에서 벽면까지 법선 방향 거리(부호 포함): side·두께/2 − 현재 법선 오프셋
  const toFace = side * (wall.thickness / 2) - normalOff;
  const face = { x: f.pos.x + n.x * toFace, y: f.pos.y + n.y * toFace };
  const angle = Math.atan2(u.y, u.x);
  const at = (off: number) => ({ cx: face.x + out.x * off, cy: face.y + out.y * off });
  const size = f.kind === 'outlet-waterproof' ? PLATE_WATERPROOF_CM : PLATE_CM;

  return [
    { kind: 'plate', ...at(PLATE_D_CM / 2), yCenter: f.height, w: size, h: size, d: PLATE_D_CM, angle, color: PLATE_COLOR },
    {
      kind: 'mark',
      ...at(PLATE_D_CM + MARK_D_CM / 2),
      yCenter: f.height,
      w: MARK_CM,
      h: MARK_CM,
      d: MARK_D_CM,
      angle,
      color: glyphColor,
    },
  ];
}
