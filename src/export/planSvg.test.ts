import { describe, expect, it } from 'vitest';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { escapeXml, exportFileName, planSvg, unverifiedCount } from './planSvg';

const sofa = { id: 's', productId: 'sofa-3seat', variantId: 'gray', x: 175, y: 200, rotation: 0 };

describe('planSvg', () => {
  it('머리글에 제목·배치안 이름·단위·미확인 수를 넣는다', () => {
    const { svg, width, height } = planSvg(SAMPLE_PLAN);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('샘플 평면 · A안');
    expect(svg).toContain('단위: cm · ≈ 표시는 실측 미확인 치수 (7개)');
    expect(width).toBe(1520);
    expect(height).toBe(1260);
  });

  it('미확인 벽 길이는 ≈, 확인된 길이는 숫자만', () => {
    expect(planSvg(SAMPLE_PLAN).svg).toContain('>≈600<');
    const verified = { ...SAMPLE_PLAN, walls: SAMPLE_PLAN.walls.map((w) => ({ ...w, verified: true })) };
    expect(planSvg(verified).svg).toContain('>600<');
    expect(planSvg(verified).svg).not.toContain('>≈600<');
  });

  it('가구 이름과 치수, 미확인이면 ≈', () => {
    const { svg } = planSvg(withActiveItems(SAMPLE_PLAN, [sofa]));
    expect(svg).toContain('>3인 소파<');
    expect(svg).toContain('>≈210×90<');
    expect(planSvg(withActiveItems(SAMPLE_PLAN, [{ ...sofa, verified: true }])).svg).toContain('>210×90<');
  });

  it('이름의 특수문자를 XML로 이스케이프한다', () => {
    const plan = { ...SAMPLE_PLAN, info: { title: 'A<B & "C"' } };
    const { svg } = planSvg(plan);
    expect(svg).toContain('A&lt;B &amp; &quot;C&quot;');
    expect(svg).not.toContain('A<B');
    expect(escapeXml(`'`)).toBe('&apos;');
  });

  it('배경 이미지는 넣지 않는다', () => {
    const plan = { ...SAMPLE_PLAN, background: { imageRef: 'i', widthPx: 10, heightPx: 10, cmPerPx: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 1 } };
    expect(planSvg(plan).svg).not.toContain('<image');
  });
});

describe('unverifiedCount / exportFileName', () => {
  it('벽·개구부·활성 배치안 아이템의 미확인 수', () => {
    expect(unverifiedCount(SAMPLE_PLAN)).toBe(7);
    expect(unverifiedCount(withActiveItems(SAMPLE_PLAN, [sofa]))).toBe(8);
  });

  it('파일명에 못 쓰는 문자와 공백은 -', () => {
    expect(exportFileName('샘플 평면', 'A안', '2d')).toBe('homefit-샘플-평면-A안-2d.png');
    expect(exportFileName('a/b:c', 'B "안"', '3d')).toBe('homefit-a-b-c-B-안--3d.png');
  });
});
