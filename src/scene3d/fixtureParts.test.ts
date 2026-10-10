import { describe, expect, it } from 'vitest';
import { FIXTURE_GLYPH } from '../electrical/fixtures';
import type { Fixture, Wall } from '../model/schema';
import { FAN_SPAN_CM, fixtureParts, LID_OPACITY, PLATE_COLOR } from './fixtureParts';

const wall: Wall = { id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 };
const fx = (over: Partial<Fixture>): Fixture => ({ id: 'f', kind: 'outlet', pos: { x: 100, y: 5 }, height: 30, ...over });

describe('fixtureParts (spec §40)', () => {
  it('벽 +y 면 콘센트: 판 1 + 둥근 홈 2 + 핀 구멍 4 = 7부품, 판은 벽면에서 0.75cm 밖', () => {
    const parts = fixtureParts(fx({ wallId: 'w' }), [wall], 230);
    expect(parts).toHaveLength(7);
    // 판 중심 = 벽면 + n·0.75 = (100, 5.75)
    expect(parts[0]).toEqual({ kind: 'plate', cx: 100, cy: 5.75, yCenter: 30, w: 8, h: 8, d: 1.5, angle: 0, color: PLATE_COLOR });
    // 홈: 판 바깥면(벽면 + 1.5) 위, 두께 0.3 → 중심 5 + 1.5 + 0.15, 세로 ±2
    const sockets = parts.filter((p) => p.w === 3.4);
    expect(sockets.map((p) => [p.cx, p.cy, p.yCenter, p.kind, p.axis])).toEqual([
      [100, 6.65, 32, 'cylinder', 'normal'],
      [100, 6.65, 28, 'cylinder', 'normal'],
    ]);
    // 핀: 홈 위(5 + 1.5 + 0.3 + 0.1), 가로 ±0.95
    const pins = parts.filter((p) => p.w === 0.5);
    expect(pins).toHaveLength(4);
    expect(pins.map((p) => [p.cx, p.cy, p.yCenter])).toEqual([
      [99.05, 6.9, 32],
      [100.95, 6.9, 32],
      [99.05, 6.9, 28],
      [100.95, 6.9, 28],
    ]);
  });

  it('위치가 벽 몸체 안쪽이어도 판은 벽면(중심선 + 두께/2)에 붙는다', () => {
    const [plate] = fixtureParts(fx({ wallId: 'w', pos: { x: 100, y: 3 } }), [wall], 230);
    expect(plate).toMatchObject({ cx: 100, cy: 5.75 });
  });

  it('벽 -y 면이면 바깥 방향도 -y', () => {
    const parts = fixtureParts(fx({ wallId: 'w', pos: { x: 100, y: -5 } }), [wall], 230);
    expect(parts[0].cy).toBeCloseTo(-5.75);
    expect(parts[1].cy).toBeCloseTo(-6.65);
  });

  it('세로 벽(a→b가 +y)은 각도 π/2, 바깥 방향은 x축, 핀 가로 오프셋은 벽 방향(y)', () => {
    const vwall: Wall = { ...wall, b: { x: 0, y: 400 } };
    // n = (-u.y, u.x) = (-1, 0); pos x=-5 → n 쪽 → 바깥 = (-1, 0)
    const parts = fixtureParts(fx({ wallId: 'w', pos: { x: -5, y: 100 } }), [vwall], 230);
    expect(parts[0].angle).toBeCloseTo(Math.PI / 2);
    expect(parts[0].cx).toBeCloseTo(-5.75);
    expect(parts[0].cy).toBeCloseTo(100);
    const pin = parts.find((p) => p.w === 0.5)!;
    expect(pin.cx).toBeCloseTo(-6.9);
    expect(pin.cy).toBeCloseTo(100 - 0.95);
  });

  it('전용 콘센트: 홈 1개 + 핀 2개 + 판 아랫단 주황 띠', () => {
    const parts = fixtureParts(fx({ wallId: 'w', kind: 'outlet-dedicated' }), [wall], 230);
    expect(parts).toHaveLength(5);
    expect(parts.filter((p) => p.w === 3.4)).toHaveLength(1);
    expect(parts.at(-1)).toMatchObject({ kind: 'mark', w: 8, h: 1.2, d: 0.3, yCenter: 30 - 4 + 0.6, color: FIXTURE_GLYPH['outlet-dedicated'].stroke });
  });

  it('방수 콘센트: 10×10 판, 반투명 덮개와 힌지 바', () => {
    const parts = fixtureParts(fx({ wallId: 'w', kind: 'outlet-waterproof', height: 120 }), [wall], 230);
    expect(parts[0]).toMatchObject({ w: 10, h: 10, yCenter: 120 });
    const lid = parts.find((p) => p.opacity !== undefined)!;
    expect(lid).toMatchObject({ kind: 'mark', w: 8, h: 8, d: 1.2, opacity: LID_OPACITY, color: FIXTURE_GLYPH['outlet-waterproof'].stroke });
    // 덮개는 홈(0.3)·핀(0.2) 위: 벽면 + 1.5 + 0.5 + 0.6
    expect(lid.cy).toBeCloseTo(5 + 2 + 0.6);
    const hinge = parts.at(-1)!;
    expect(hinge).toMatchObject({ w: 8, h: 0.8, d: 1.4, yCenter: 120 + 4 - 0.4 });
    expect(hinge.opacity).toBeUndefined();
  });

  it('스위치: 7×12 판 + 돋은 로커 + 남색 표시등', () => {
    const parts = fixtureParts(fx({ wallId: 'w', kind: 'switch', height: 120 }), [wall], 230);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatchObject({ kind: 'plate', w: 7, h: 12, d: 1.5 });
    expect(parts[1]).toMatchObject({ kind: 'mark', w: 5, h: 9, d: 0.8, cy: 5 + 1.5 + 0.4 });
    expect(parts[2]).toMatchObject({ w: 0.8, h: 0.8, yCenter: 117, cy: 7.4, color: FIXTURE_GLYPH.switch.stroke });
  });

  it('조명: Ø30×1.5 베이스판 윗면 = min(높이, 천장) − 1, 그 아래 발광 돔(윗면 Ø26·아랫면 Ø22·높이 5)', () => {
    const [base, dome] = fixtureParts(fx({ kind: 'light', pos: { x: 200, y: 200 }, height: 230 }), [wall], 230);
    expect(base).toEqual({ kind: 'disc', cx: 200, cy: 200, yCenter: 229 - 0.75, w: 30, h: 1.5, d: 30, angle: 0, color: '#f5f4f0' });
    expect(dome).toMatchObject({ kind: 'cylinder', axis: 'y', w: 22, rTop: 13, h: 5, yCenter: 229 - 1.5 - 2.5, emissive: '#ffe9a8' });
    // 천장보다 높게 적힌 조명은 천장 아래로
    expect(fixtureParts(fx({ kind: 'light', height: 300 }), [wall], 240)[0].yCenter).toBe(239 - 0.75);
    expect(fixtureParts(fx({ kind: 'light', height: 200 }), [wall], 240)[0].yCenter).toBe(199 - 0.75);
  });

  it('조명은 바닥 아래로 내려가지 않는다(높이 0 → 돔 아랫면 0)', () => {
    const [base, dome] = fixtureParts(fx({ kind: 'light', height: 0 }), [wall], 230);
    expect(base.yCenter).toBe(6.5 - 0.75);
    expect(dome.yCenter).toBe(2.5);
  });

  it('실링팬: 받침 원판 + 모터 원통 + 날개 4장, 끝에서 끝까지 120cm, 모두 천장 아래 (스펙 §51.3)', () => {
    const parts = fixtureParts(fx({ kind: 'ceiling-fan', pos: { x: 200, y: 200 }, height: 230 }), [wall], 230);
    expect(parts[0]).toMatchObject({ kind: 'disc', cx: 200, cy: 200, yCenter: 229 - 0.75 });
    expect(parts[1]).toMatchObject({ kind: 'cylinder', axis: 'y', cx: 200, cy: 200 });
    const blades = parts.filter((p) => p.kind === 'box');
    expect(blades).toHaveLength(4);
    expect(parts).toHaveLength(6);
    for (const p of parts) expect(p.yCenter + p.h / 2).toBeLessThanOrEqual(229);
    for (const b of blades) {
      expect(b).toMatchObject({ h: 1.5, d: 14 });
      expect(b.yCenter).toBeLessThan(parts[1].yCenter);
    }
    // 날개는 90°씩, 바깥 끝은 중심에서 60cm
    expect(blades.map((b) => b.angle)).toEqual([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]);
    const tips = blades.map((b) => Math.hypot(b.cx - 200, b.cy - 200) + b.w / 2);
    for (const t of tips) expect(t).toBeCloseTo(FAN_SPAN_CM / 2);
    const [east, , west] = blades;
    expect(east.cx + east.w / 2 - (west.cx - west.w / 2)).toBeCloseTo(FAN_SPAN_CM);
    // 천장보다 높게 적힌 실링팬은 천장 아래로
    expect(fixtureParts(fx({ kind: 'ceiling-fan', height: 300 }), [wall], 240)[0].yCenter).toBe(239 - 0.75);
  });

  it('벽에 붙지 않았거나 벽이 사라진 콘센트·스위치는 6cm 정육면체', () => {
    const box = { kind: 'box', cx: 100, cy: 5, yCenter: 30, w: 6, h: 6, d: 6, angle: 0, color: FIXTURE_GLYPH.outlet.stroke };
    expect(fixtureParts(fx({}), [wall], 230)).toEqual([box]);
    expect(fixtureParts(fx({ wallId: 'gone' }), [wall], 230)).toEqual([box]);
  });
});
