import { describe, expect, it } from 'vitest';
import type { Background } from '../model/schema';
import { calibrationResult, cmPerPxFrom, imagePxToPlan, planToImagePx, scaleText } from './calibration';

const bg: Background = { imageRef: 'i', widthPx: 800, heightPx: 600, cmPerPx: 1, offsetX: 10, offsetY: 20, rotation: 0, opacity: 0.5 };

describe('cmPerPxFrom', () => {
  it('400px 구간에 4,000mm를 넣으면 10mm/px (F01)', () => {
    expect(cmPerPxFrom({ x: 0, y: 0 }, { x: 400, y: 0 }, 400)).toBe(1);
  });

  it('두 점이 같으면 null', () => {
    expect(cmPerPxFrom({ x: 5, y: 5 }, { x: 5, y: 5 }, 100)).toBeNull();
  });
});

describe('좌표 변환', () => {
  it('평면 cm와 이미지 px를 왕복한다', () => {
    const scaled = { ...bg, cmPerPx: 2 };
    const px = planToImagePx(scaled, { x: 110, y: 220 });
    expect(px).toEqual({ x: 50, y: 100 });
    expect(imagePxToPlan(scaled, px)).toEqual({ x: 110, y: 220 });
  });
});

describe('calibrationResult', () => {
  it('기준 보정은 축척과 기준선을 저장한다', () => {
    const r = calibrationResult(bg, { target: 'primary', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] }, 400);
    expect(r?.background.cmPerPx).toBe(2);
    expect(r?.background.calibration).toEqual({ a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, lengthCm: 400 });
    expect(r?.mismatch).toBeNull();
  });

  it('검증 길이가 2% 넘게 다르면 근사로 표시한다', () => {
    const primary = calibrationResult(bg, { target: 'primary', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }] }, 400)!.background;
    const r = calibrationResult(primary, { target: 'check', points: [{ x: 0, y: 0 }, { x: 0, y: 300 }] }, 309);
    expect(r?.mismatch).toBeCloseTo(0.03);
    expect(r?.background.cmPerPx).toBe(1);
    expect(scaleText(r!.background)).toContain('근사: 검증 길이와 3.0% 차이');
  });

  it('기준 보정 없이 검증 길이만 넣으면 null', () => {
    expect(calibrationResult(bg, { target: 'check', points: [{ x: 0, y: 0 }, { x: 0, y: 300 }] }, 300)).toBeNull();
  });
});

describe('scaleText', () => {
  it('보정 전과 일치 상태를 문장으로', () => {
    expect(scaleText(bg)).toBe('축척 미보정: 도면 위 두 점과 실제 길이로 보정하세요.');
    const primary = calibrationResult(bg, { target: 'primary', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }] }, 400)!.background;
    const ok = calibrationResult(primary, { target: 'check', points: [{ x: 0, y: 0 }, { x: 0, y: 300 }] }, 301)!.background;
    expect(scaleText(ok)).toBe('축척 1px = 1.00cm (기준 400cm) · 검증 길이와 일치');
  });
});
