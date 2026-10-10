// 전기 설비 3D 부품 계산 — 순수 함수, React/three 의존 없음 (spec §40, 구 §27.3)
import { FIXTURE_GLYPH } from '../electrical/fixtures';
import { wallDir } from '../geometry/walls';
import type { Fixture, Wall } from '../model/schema';

export type FixturePart = {
  // box 계열: plate(판)·mark(표식·띠·덮개 등 상자) / disc: 수직축 원반 / cylinder: axis 방향 원기둥 / box: 비부착 상자
  kind: 'plate' | 'mark' | 'disc' | 'box' | 'cylinder';
  cx: number;
  cy: number;
  yCenter: number;
  w: number; // 상자 가로(벽 방향) / 원기둥·원반 지름(아랫면)
  h: number; // 상자 높이 / 원기둥 길이
  d: number; // 상자 깊이(법선 방향) / 원기둥 지름(w와 같음)
  angle: number;
  color: string;
  axis?: 'y' | 'normal'; // cylinder 전용. y = 수직, normal = 벽 법선(angle 기준)
  rTop?: number; // disc·cylinder 윗면 반지름(없으면 아랫면과 같음)
  emissive?: string;
  opacity?: number;
};

const PLATE_CM = 8; // 콘센트 판 한 변
const PLATE_WATERPROOF_CM = 10; // 방수 콘센트 판 한 변
const SWITCH_W_CM = 7; // 스위치 판 가로
const SWITCH_H_CM = 12; // 스위치 판 세로
const PLATE_D_CM = 1.5; // 판 두께
export const PLATE_COLOR = '#efece6';
const SOCKET_CM = 3.4; // 콘센트 둥근 홈 지름
const SOCKET_D_CM = 0.3;
const SOCKET_COLOR = '#cfcbc3';
const SOCKET_GAP_CM = 2; // 2구 홈 중심의 세로 오프셋(±)
const PIN_CM = 0.5; // 핀 구멍 지름
const PIN_D_CM = 0.2;
const PIN_OFF_CM = 0.95; // 핀 구멍 가로 오프셋(±)
const PIN_COLOR = '#3f3f46';
const BAND_H_CM = 1.2; // 전용 콘센트 띠 높이
const BAND_D_CM = 0.3;
const LID_CM = 8; // 방수 덮개 한 변
const LID_D_CM = 1.2;
export const LID_OPACITY = 0.45;
const HINGE_H_CM = 0.8;
const HINGE_D_CM = 1.4;
const ROCKER_W_CM = 5;
const ROCKER_H_CM = 9;
const ROCKER_D_CM = 0.8;
const ROCKER_COLOR = '#fbfaf7';
const PILOT_CM = 0.8; // 스위치 표시등 한 변
const PILOT_D_CM = 0.2;
const PILOT_DY_CM = -3;
const LIGHT_BASE_DIAMETER_CM = 30;
const LIGHT_BASE_D_CM = 1.5;
const LIGHT_BASE_COLOR = '#f5f4f0';
const LIGHT_DOME_TOP_CM = 26; // 돔 윗면(베이스 쪽) 지름
const LIGHT_DOME_BOTTOM_CM = 22; // 돔 아랫면 지름
const LIGHT_DOME_H_CM = 5;
const LIGHT_DOME_COLOR = '#fff6dc';
const LIGHT_DOME_EMISSIVE = '#ffe9a8';
const LIGHT_GAP_CM = 1; // 천장(또는 설치 높이)에서 베이스 윗면까지
const LOOSE_BOX_CM = 6; // 벽에 붙지 않은 콘센트·스위치 상자
const FAN_BASE_DIAMETER_CM = 20; // 실링팬 천장 받침 원판
const FAN_BASE_D_CM = 1.5;
const FAN_BASE_COLOR = '#f5f4f0';
const FAN_MOTOR_DIAMETER_CM = 18;
const FAN_MOTOR_H_CM = 12;
const FAN_MOTOR_COLOR = '#d6d3cd';
export const FAN_SPAN_CM = 120; // 날개 끝에서 끝까지(지름)
const FAN_BLADE_W_CM = 14;
const FAN_BLADE_D_CM = 1.5; // 날개 판 두께
const FAN_BLADE_COLOR = '#8b6f4e';
const FAN_BLADES = 4;

function lightParts(f: Fixture, ceiling: number): FixturePart[] {
  const top = Math.min(f.height, ceiling) - LIGHT_GAP_CM;
  const total = LIGHT_BASE_D_CM + LIGHT_DOME_H_CM;
  const baseTop = Math.max(total, top); // 바닥 아래로 내려가지 않는다
  return [
    {
      kind: 'disc',
      cx: f.pos.x,
      cy: f.pos.y,
      yCenter: baseTop - LIGHT_BASE_D_CM / 2,
      w: LIGHT_BASE_DIAMETER_CM,
      h: LIGHT_BASE_D_CM,
      d: LIGHT_BASE_DIAMETER_CM,
      angle: 0,
      color: LIGHT_BASE_COLOR,
    },
    {
      kind: 'cylinder',
      axis: 'y',
      cx: f.pos.x,
      cy: f.pos.y,
      yCenter: baseTop - LIGHT_BASE_D_CM - LIGHT_DOME_H_CM / 2,
      w: LIGHT_DOME_BOTTOM_CM,
      h: LIGHT_DOME_H_CM,
      d: LIGHT_DOME_BOTTOM_CM,
      rTop: LIGHT_DOME_TOP_CM / 2,
      angle: 0,
      color: LIGHT_DOME_COLOR,
      emissive: LIGHT_DOME_EMISSIVE,
    },
  ];
}

// 실링팬(spec §51.3): 천장 받침 원판 + 모터 원통 + 날개 4장(지름 120cm). 조명과 같은 천장 높이 규칙
function fanParts(f: Fixture, ceiling: number): FixturePart[] {
  const top = Math.min(f.height, ceiling) - LIGHT_GAP_CM;
  const total = FAN_BASE_D_CM + FAN_MOTOR_H_CM;
  const baseTop = Math.max(total, top); // 바닥 아래로 내려가지 않는다
  const motorBottom = baseTop - total;
  const bladeCenter = motorBottom + FAN_BLADE_D_CM / 2; // 날개는 모터 아랫단 높이
  const bladeLen = FAN_SPAN_CM / 2 - FAN_MOTOR_DIAMETER_CM / 2;
  const blades: FixturePart[] = Array.from({ length: FAN_BLADES }, (_, i) => {
    const angle = (i * Math.PI * 2) / FAN_BLADES;
    const r = FAN_MOTOR_DIAMETER_CM / 2 + bladeLen / 2;
    return {
      kind: 'box',
      cx: f.pos.x + Math.cos(angle) * r,
      cy: f.pos.y + Math.sin(angle) * r,
      yCenter: bladeCenter,
      w: bladeLen,
      h: FAN_BLADE_D_CM,
      d: FAN_BLADE_W_CM,
      angle,
      color: FAN_BLADE_COLOR,
    };
  });
  return [
    {
      kind: 'disc',
      cx: f.pos.x,
      cy: f.pos.y,
      yCenter: baseTop - FAN_BASE_D_CM / 2,
      w: FAN_BASE_DIAMETER_CM,
      h: FAN_BASE_D_CM,
      d: FAN_BASE_DIAMETER_CM,
      angle: 0,
      color: FAN_BASE_COLOR,
    },
    {
      kind: 'cylinder',
      axis: 'y',
      cx: f.pos.x,
      cy: f.pos.y,
      yCenter: baseTop - FAN_BASE_D_CM - FAN_MOTOR_H_CM / 2,
      w: FAN_MOTOR_DIAMETER_CM,
      h: FAN_MOTOR_H_CM,
      d: FAN_MOTOR_DIAMETER_CM,
      angle: 0,
      color: FAN_MOTOR_COLOR,
    },
    ...blades,
  ];
}

export function fixtureParts(f: Fixture, walls: Wall[], ceiling: number): FixturePart[] {
  const glyphColor = FIXTURE_GLYPH[f.kind].stroke;
  if (f.kind === 'light') return lightParts(f, ceiling);
  if (f.kind === 'ceiling-fan') return fanParts(f, ceiling);

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
  // off: 벽면에서 바깥으로, dx: 벽 방향(u)으로, dy: 높이
  const at = (off: number, dx = 0, dy = 0) => ({
    cx: face.x + out.x * off + u.x * dx,
    cy: face.y + out.y * off + u.y * dx,
    yCenter: f.height + dy,
    angle,
  });
  const box = (kind: 'plate' | 'mark', off: number, dx: number, dy: number, w: number, h: number, d: number, color: string): FixturePart => ({
    kind,
    ...at(off + d / 2, dx, dy),
    w,
    h,
    d,
    color,
  });
  const cyl = (off: number, dx: number, dy: number, diameter: number, len: number, color: string): FixturePart => ({
    kind: 'cylinder',
    axis: 'normal',
    ...at(off + len / 2, dx, dy),
    w: diameter,
    h: len,
    d: diameter,
    color,
  });
  const faceOff = PLATE_D_CM; // 판 바깥면
  const socket = (dy: number): FixturePart[] => [
    cyl(faceOff, 0, dy, SOCKET_CM, SOCKET_D_CM, SOCKET_COLOR),
    cyl(faceOff + SOCKET_D_CM, -PIN_OFF_CM, dy, PIN_CM, PIN_D_CM, PIN_COLOR),
    cyl(faceOff + SOCKET_D_CM, PIN_OFF_CM, dy, PIN_CM, PIN_D_CM, PIN_COLOR),
  ];

  switch (f.kind) {
    case 'outlet':
      return [box('plate', 0, 0, 0, PLATE_CM, PLATE_CM, PLATE_D_CM, PLATE_COLOR), ...socket(SOCKET_GAP_CM), ...socket(-SOCKET_GAP_CM)];
    case 'outlet-dedicated':
      return [
        box('plate', 0, 0, 0, PLATE_CM, PLATE_CM, PLATE_D_CM, PLATE_COLOR),
        ...socket(0),
        box('mark', faceOff, 0, -(PLATE_CM / 2 - BAND_H_CM / 2), PLATE_CM, BAND_H_CM, BAND_D_CM, glyphColor),
      ];
    case 'outlet-waterproof': {
      const s = PLATE_WATERPROOF_CM;
      const lidOff = faceOff + SOCKET_D_CM + PIN_D_CM; // 홈·핀 위를 덮는다
      return [
        box('plate', 0, 0, 0, s, s, PLATE_D_CM, PLATE_COLOR),
        ...socket(0),
        { ...box('mark', lidOff, 0, 0, LID_CM, LID_CM, LID_D_CM, glyphColor), opacity: LID_OPACITY },
        box('mark', lidOff, 0, LID_CM / 2 - HINGE_H_CM / 2, LID_CM, HINGE_H_CM, HINGE_D_CM, glyphColor),
      ];
    }
    case 'switch':
      return [
        box('plate', 0, 0, 0, SWITCH_W_CM, SWITCH_H_CM, PLATE_D_CM, PLATE_COLOR),
        box('mark', faceOff, 0, 0, ROCKER_W_CM, ROCKER_H_CM, ROCKER_D_CM, ROCKER_COLOR),
        box('mark', faceOff + ROCKER_D_CM, 0, PILOT_DY_CM, PILOT_CM, PILOT_CM, PILOT_D_CM, glyphColor),
      ];
  }
}
