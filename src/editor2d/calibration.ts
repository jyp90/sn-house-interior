import type { Background, Vec2 } from '../model/schema';

export const SCALE_TOLERANCE = 0.02;

export type CalibrationDraft = { target: 'primary' | 'check'; points: Vec2[] };

export function cmPerPxFrom(a: Vec2, b: Vec2, lengthCm: number): number | null {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d === 0 || !(lengthCm > 0)) return null;
  return lengthCm / d;
}

export function scaleMismatch(primary: number, check: number): number {
  return Math.abs(primary - check) / primary;
}

export function checkMismatch(bg: Background): number | null {
  const check = bg.calibration?.check;
  if (!check) return null;
  const s = cmPerPxFrom(check.a, check.b, check.lengthCm);
  return s === null ? null : scaleMismatch(bg.cmPerPx, s);
}

export function planToImagePx(bg: Background, p: Vec2): Vec2 {
  return { x: (p.x - bg.offsetX) / bg.cmPerPx, y: (p.y - bg.offsetY) / bg.cmPerPx };
}

export function imagePxToPlan(bg: Background, p: Vec2): Vec2 {
  return { x: bg.offsetX + p.x * bg.cmPerPx, y: bg.offsetY + p.y * bg.cmPerPx };
}

export function calibrationResult(
  bg: Background,
  draft: CalibrationDraft,
  lengthCm: number,
): { background: Background; mismatch: number | null } | null {
  if (draft.points.length !== 2) return null;
  const [a, b] = draft.points;
  const s = cmPerPxFrom(a, b, lengthCm);
  if (s === null) return null;
  const line = { a, b, lengthCm: Math.round(lengthCm) };
  if (draft.target === 'primary') {
    const check = bg.calibration?.check;
    const background: Background = { ...bg, cmPerPx: s, calibration: check ? { ...line, check } : line };
    return { background, mismatch: checkMismatch(background) };
  }
  if (!bg.calibration) return null;
  const background: Background = { ...bg, calibration: { ...bg.calibration, check: line } };
  return { background, mismatch: checkMismatch(background) };
}

export function scaleText(bg: Background): string {
  if (!bg.calibration) return '축척 미보정: 도면 위 두 점과 실제 길이로 보정하세요.';
  const base = `축척 1px = ${bg.cmPerPx.toFixed(2)}cm (기준 ${bg.calibration.lengthCm}cm)`;
  const m = checkMismatch(bg);
  if (m === null) return base;
  return m > SCALE_TOLERANCE ? `${base} · 근사: 검증 길이와 ${(m * 100).toFixed(1)}% 차이` : `${base} · 검증 길이와 일치`;
}
