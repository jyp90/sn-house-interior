import { describe, expect, it } from 'vitest';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { escapeXml, exportFileName, itemNumbers, pdfFileName, planSvg, unverifiedCount } from './planSvg';

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

  it('글자는 모든 도형 위에 흰 테두리로 그린다', () => {
    const { svg } = planSvg(withActiveItems(SAMPLE_PLAN, [sofa]));
    const lastShape = Math.max(svg.lastIndexOf('<polygon'), svg.lastIndexOf('<path'));
    expect(svg.indexOf('>3인 소파<')).toBeGreaterThan(lastShape);
    expect(svg.indexOf('>≈600<')).toBeGreaterThan(lastShape);
    expect(svg).not.toContain('paint-order');
    expect(svg).toMatch(/<text[^>]*stroke="#ffffff"[^>]*>3인 소파<\/text><text[^>]*fill="#1f2328"[^>]*>3인 소파<\/text>/);
  });

  it('방 이름표는 마지막 폴리곤보다 뒤에 그린다', () => {
    const { svg } = planSvg(SAMPLE_PLAN);
    const roomName = SAMPLE_PLAN.rooms[0].name;
    const lastPolygon = svg.lastIndexOf('<polygon');
    expect(lastPolygon).toBeGreaterThan(-1);
    expect(svg.indexOf(`>${roomName}<`)).toBeGreaterThan(lastPolygon);
  });

  it('가구는 벽보다 나중에 그려 벽 두께에 걸쳐도 가려지지 않는다', () => {
    const { svg } = planSvg(withActiveItems(SAMPLE_PLAN, [sofa]));
    const wallFill = '"#3f3a33"/>';
    const lastWallIndex = svg.lastIndexOf(wallFill);
    const firstItemPolygon = svg.indexOf('fill-opacity="0.85"');
    expect(lastWallIndex).toBeGreaterThan(-1);
    expect(firstItemPolygon).toBeGreaterThan(-1);
    expect(lastWallIndex).toBeLessThan(firstItemPolygon);
  });

  it('제어 문자는 SVG와 파일명에서 지운다', () => {
    expect(escapeXml('a\u0001b')).toBe('ab');
    expect(exportFileName('a\u0001b', 'A안', '2d')).toBe('homefit-a-b-A안-2d.png');
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

describe('planSvg 옵션', () => {
  const washer = { id: 'wa', productId: 'samsung-grande-washer-sample', variantId: 'white', x: 300, y: 200, rotation: 0 };
  const plan = withActiveItems(SAMPLE_PLAN, [sofa, washer]);

  it('글꼴 이름을 바꿀 수 있고 기본은 sans-serif', () => {
    expect(planSvg(plan).svg).toContain('font-family="sans-serif"');
    const pdf = planSvg(plan, { fontFamily: 'Pretendard' }).svg;
    expect(pdf).toContain('font-family="Pretendard"');
    expect(pdf).not.toContain('sans-serif');
  });

  it('header:false면 머리글을 빼고 높이가 줄어든다', () => {
    const r = planSvg(plan, { header: false });
    expect(r.svg).not.toContain('단위: cm');
    expect(r.width).toBe(1520);
    expect(r.height).toBe(1260 - 140);
  });

  it('items:number는 이름 대신 배치 순서 번호', () => {
    const { svg } = planSvg(plan, { items: 'number' });
    expect(svg).toContain('>1<');
    expect(svg).toContain('>2<');
    expect(svg).not.toContain('>3인 소파<');
    expect(itemNumbers(plan)).toEqual(new Map([['s', 1], ['wa', 2]]));
  });

  it('items:none은 가구를 그리지 않는다', () => {
    const { svg } = planSvg(plan, { items: 'none' });
    expect(svg).not.toContain('fill-opacity');
    expect(svg).not.toContain('>3인 소파<');
    expect(svg).toContain('>거실<');
  });

  it('items:faint는 흐리게 그리고 강조한 가구만 주황 테두리와 이름', () => {
    const { svg } = planSvg(plan, { items: 'faint', highlightIds: ['wa'] });
    expect(svg).toContain('fill-opacity="0.3"');
    expect(svg).not.toContain('fill-opacity="0.85"');
    expect(svg).toContain('stroke="#c2410c" stroke-width="3"');
    expect(svg).toContain('>그랑데 드럼세탁기<');
    expect(svg).not.toContain('>3인 소파<');
  });

  it('dimensions:false는 벽·개구부 치수를 뺀다', () => {
    const { svg } = planSvg(plan, { dimensions: false });
    expect(svg).not.toContain('>≈600<');
    expect(svg).not.toContain('>≈90<');
    expect(svg).toContain('>거실<');
  });

  it('fixtures:true는 설비 마커와 있는 종류만 범례로 그리고 높이를 늘린다', () => {
    const withFx = {
      ...plan,
      fixtures: [
        { id: 'f1', kind: 'outlet-dedicated' as const, pos: { x: 356, y: 200 }, wallId: 'w5', height: 30 },
        { id: 'f2', kind: 'switch' as const, pos: { x: 10, y: 100 }, height: 120 },
      ],
    };
    const off = planSvg(withFx);
    expect(off.svg).not.toContain('>전<');
    expect(off.svg).not.toContain('<circle');
    const on = planSvg(withFx, { fixtures: true });
    expect(on.svg).toContain('<circle cx="356" cy="200" r="9"');
    expect(on.svg).toContain('<rect x="1" y="91" width="18" height="18"');
    expect(on.svg).toContain('>전<');
    expect(on.svg).toContain('>전용회로 콘센트<');
    expect(on.svg).toContain('>스위치<');
    expect(on.svg).not.toContain('>방수 콘센트<');
    expect(on.height).toBe(off.height + 100);
  });

  it('fixtures:true는 마커 오른쪽에 E번호를 흰 테두리 글자로 붙인다', () => {
    const withFx = {
      ...plan,
      fixtures: [
        { id: 'f1', kind: 'outlet-dedicated' as const, pos: { x: 356, y: 200 }, wallId: 'w5', height: 30 },
        { id: 'f2', kind: 'switch' as const, pos: { x: 10, y: 100 }, height: 120 },
      ],
    };
    const on = planSvg(withFx, { fixtures: true }).svg;
    expect(on).toMatch(/<text x="367" y="200" font-size="9"[^>]*stroke="#ffffff"[^>]*>E1<\/text><text x="367" y="200" font-size="9"[^>]*fill="#1f2328"[^>]*>E1<\/text>/);
    expect(on).toContain('<text x="21" y="100" font-size="9"');
    expect(on).toContain('>E2<');
    expect(planSvg(withFx).svg).not.toContain('>E1<');
  });

  it('dimensionLines:true는 벽 치수선·끝 눈금과 개구부 위치(벽 시작점 기준)를 그린다', () => {
    const on = planSvg(plan, { dimensionLines: true }).svg;
    // 벽 5개 × (치수선 1 + 눈금 2)
    expect(on.match(/<line [^>]*stroke="#8b8b8b" stroke-width="0.8"/g)).toHaveLength(15);
    // w1 (0,0)→(600,0), 두께 20: 법선 (0,1) 쪽 16cm
    expect(on).toContain('<line x1="0" y1="16" x2="600" y2="16"');
    expect(on).toContain('<line x1="0" y1="13" x2="0" y2="19"');
    expect(on).toContain('>250–340<');
    expect(on).toContain('>80–260<');
    expect(on).toMatch(/font-size="9"[^>]*fill="#4f6b8a"[^>]*>250–340</);
    const off = planSvg(plan).svg;
    expect(off).not.toContain('<line');
    expect(off).not.toContain('>250–340<');
  });

  it('개구부 위치 글자는 폭 글자보다 16cm 더 바깥쪽이고, 폭 글자가 나중에 그려져 항상 위에 보인다', () => {
    // o1: wallId w5 (350,0)→(350,400) 수직, offset 250, width 90 → mid 295, 법선 바깥쪽
    const on = planSvg(plan, { dimensionLines: true }).svg;
    // 폭 글자(font-size 11): off = -(thickness/2 + 14) = -20 → x = 350 + 20 = 370
    expect(on).toContain('<text x="370" y="295" font-size="11"');
    // 위치 글자(font-size 9): off2 = off - 16 = -36 → x = 350 + 36 = 386 (폭 글자보다 16cm 바깥)
    expect(on).toContain('<text x="386" y="295" font-size="9"');
    // 위치 글자를 먼저 그리고 폭 글자를 나중에 그려, 겹치더라도 폭 글자가 항상 위에 보인다
    expect(on.indexOf('>250–340<')).toBeLessThan(on.indexOf('<text x="370" y="295" font-size="11"'));
  });

  it('제품을 찾을 수 없는 가구는 번호를 매기지 않는다', () => {
    const ghost = { id: 'g', productId: 'no-such-product', variantId: 'x', x: 100, y: 100, rotation: 0 };
    const p = withActiveItems(SAMPLE_PLAN, [ghost, sofa, washer]);
    expect(itemNumbers(p)).toEqual(new Map([['s', 1], ['wa', 2]]));
    const { svg } = planSvg(p, { items: 'number' });
    expect(svg).not.toContain('>undefined<');
    expect(svg).toContain('>2<');
  });

  it('pdfFileName', () => {
    expect(pdfFileName('샘플 평면', 'A안')).toBe('homefit-샘플-평면-A안.pdf');
  });
});
