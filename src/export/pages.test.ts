import { describe, expect, it } from 'vitest';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Plan, Product } from '../model/schema';
import { buildPdf, clampLines, MAX_CELL_LINES, rowHeightMm, TABLE_BODY_MM, textUnits, wrapText, type TablePage } from './pages';

const NOW = new Date(2026, 9, 8);
const input = { views: [], now: NOW };
const sofa = (id: string) => ({ id, productId: 'sofa-3seat', variantId: 'gray', x: 175, y: 200, rotation: 0 });
const washer = { id: 'wa', productId: 'samsung-grande-washer-sample', variantId: 'white', x: 300, y: 200, rotation: 0 };
// 전용회로 가전 11대를 콘센트 없이 두면 주석은 설비 없음 1줄 + 가전 목록 2줄 + 경고 11줄 = 14줄
const CAP_WASHERS = 11;
const usedMm = (p: TablePage) => p.rows.reduce((sum, r) => sum + rowHeightMm(Math.max(...r.map((c) => c.length))), 0);

describe('wrapText / clampLines', () => {
  it('한글은 1, 그 밖은 0.6 너비로 세어 단어 단위로 줄을 바꾼다', () => {
    expect(textUnits('가a')).toBeCloseTo(1.6);
    expect(wrapText('가나다 라마', 3)).toEqual(['가나다', '라마']);
    expect(wrapText('abc def', 2)).toEqual(['abc', 'def']);
    expect(wrapText('가나다라마바', 4)).toEqual(['가나다라', '마바']);
    expect(wrapText('', 4)).toEqual(['']);
    expect(wrapText('가\n나', 4)).toEqual(['가', '나']);
  });

  it('줄 수를 넘으면 자르고 …으로 끝낸다', () => {
    const lines = wrapText('가'.repeat(100), 10);
    expect(lines).toHaveLength(10);
    expect(clampLines(lines, 3)).toEqual(['가'.repeat(10), '가'.repeat(10), `${'가'.repeat(9)}…`]);
    expect(clampLines(['a'], 3)).toEqual(['a']);
  });
});

describe('buildPdf', () => {
  it('쪽 순서와 제목, 머리글, 파일명', () => {
    const doc = buildPdf(withActiveItems(SAMPLE_PLAN, [washer]), input);
    expect(doc.header).toBe('샘플 평면 · A안');
    expect(doc.fileName).toBe('sn-house-interior-샘플-평면-A안.pdf');
    expect(doc.pages.slice(0, 12).map((p) => [p.kind, p.title])).toEqual([
      ['cover', '샘플 평면'],
      ['table', '견적 요청 — 공정별 항목'],
      ['table', '견적서에 함께 적어주실 내용'],
      ['table', '사양 결정사항'],
      ['table', '사진 기록 요청'],
      ['drawing', '치수 평면도'],
      ['drawing', '가구·가전 배치도 (A안)'],
      ['drawing', '전기 계획도'],
      ['table', '전기 설비 목록'],
      ['table', '빌트인 상세'],
      ['table', '제품 목록 (A안)'],
      ['views', '3D 보기'],
    ]);
    const rest = doc.pages.slice(12);
    expect(rest.length).toBeGreaterThanOrEqual(1);
    expect(rest.every((p) => p.kind === 'table' && p.title.startsWith('공사 체크리스트'))).toBe(true);
  });

  it('견적 요청 쪽: 공정별 항목은 자재비+시공비 합산 안내와 11개 공정, 예산 금액은 넣지 않는다', () => {
    const doc = buildPdf(SAMPLE_PLAN, input);
    const groups = doc.pages.find((p) => p.title === '견적 요청 — 공정별 항목') as TablePage;
    expect(groups.columns.map((c) => c.label)).toEqual(['공정', '세부 항목 (항목별 자재비+시공비 합산, 해당 없으면 비움)']);
    expect(groups.rows.map((r) => r[0].join(''))).toEqual([
      '철거·폐기', '창호·확장·단열', '설비', '전기', '목공·천장', '욕실', '주방', '수납·가구', '마감', '조명', '부대비용',
    ]);
    const quoteText = doc.pages
      .filter((p): p is TablePage => p.kind === 'table' && ['견적', '사양', '사진'].some((w) => p.title.startsWith(w)))
      .flatMap((p) => p.rows.flat(2))
      .join(' ');
    expect(quoteText).toContain('내력벽');
    expect(quoteText).toContain('3.2T');
    expect(quoteText).not.toMatch(/예산|천만|5천|4천/);
  });

  it('도면 SVG는 Pretendard만 쓰고 머리글·배경 이미지를 넣지 않는다', () => {
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [washer]),
      background: { imageRef: 'i', widthPx: 10, heightPx: 10, cmPerPx: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 1 },
    };
    const drawings = buildPdf(plan, input).pages.filter((p) => p.kind === 'drawing');
    expect(drawings).toHaveLength(3);
    for (const d of drawings) {
      expect(d.svg).toContain('font-family="Pretendard"');
      expect(d.svg).not.toContain('sans-serif');
      expect(d.svg).not.toContain('<image');
      expect(d.svg).not.toContain('단위: cm ·');
    }
  });

  it('활성 배치안만 담고 이름을 밝힌다', () => {
    const plan: Plan = {
      ...SAMPLE_PLAN,
      layouts: [
        { id: 'layout-a', name: 'A안', items: [washer] },
        { id: 'layout-b', name: '창가안', items: [sofa('s1')] },
      ],
      activeLayoutId: 'layout-b',
    };
    const doc = buildPdf(plan, input);
    expect(doc.header).toBe('샘플 평면 · 창가안');
    const products = doc.pages.find((p) => p.title.startsWith('제품 목록')) as TablePage;
    expect(products.title).toBe('제품 목록 (창가안)');
    expect(products.rows.map((r) => r[2].join(''))).toEqual(['3인 소파']);
    const cover = doc.pages[0];
    expect(cover.kind === 'cover' && cover.rows.find((r) => r.label === '배치안')?.lines).toEqual(['창가안']);
  });

  it('표지는 비어 있는 정보를 빼고 작성일을 넣는다', () => {
    const plan: Plan = { ...SAMPLE_PLAN, info: { title: '우리 집', address: '어딘가 1', supplyArea: 93.6, exclusiveArea: 59.9, builtYear: 1999 } };
    const cover = buildPdf(plan, input).pages[0];
    if (cover.kind !== 'cover') throw new Error('cover 아님');
    expect(cover.title).toBe('우리 집');
    expect(cover.rows.map((r) => [r.label, r.lines.join(' ')])).toEqual([
      ['주소', '어딘가 1'],
      ['면적', '공급 93.6m² / 전용 59.9m²'],
      ['준공연도', '1999년'],
      ['배치안', 'A안'],
      ['작성일', '2026-10-08'],
    ]);
  });

  it('제품 목록: 번호·모델·이름·치수(미확인 ≈)·설치 높이·소비전력·전용회로', () => {
    const products = buildPdf(withActiveItems(SAMPLE_PLAN, [sofa('s1'), washer]), input).pages[10] as TablePage;
    expect(products.columns.map((c) => c.label)).toEqual(['번호', '모델명', '이름', 'W×D×H (cm)', '설치 높이', '소비전력', '전용회로']);
    expect(products.rows.map((r) => r.map((c) => c.join(' ')))).toEqual([
      ['1', '-', '3인 소파', '≈210×90×80', '-', '-', '-'],
      ['2', '그랑데 세탁기 (샘플 치수)', '그랑데 드럼세탁기', '≈70×85×110', '-', '2000W', '필요 (콘센트 없음)'],
    ]);
  });

  it('제품 목록·빌트인 상세에 설치 높이가 들어간다', () => {
    const upper: Product = {
      id: 'c-upper', brand: 'custom', model: '', name: '상부장', category: 'kitchen',
      dims: { w: 240, d: 35, h: 70 }, variants: [{ id: 'v', label: '기본', colors: {} }],
      builder: 'cabinet-run', clearances: [], builtIn: true, mount: 'wall', elevation: 145,
    };
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [
        { id: 'u', productId: 'c-upper', variantId: 'v', x: 150, y: 40, rotation: 0 },
        { id: 'u2', productId: 'c-upper', variantId: 'v', x: 150, y: 300, rotation: 0, elevation: 160 },
      ]),
      customProducts: [upper],
    };
    const doc = buildPdf(plan, input);
    const products = doc.pages.find((p) => p.title.startsWith('제품 목록')) as TablePage;
    expect(products.rows.map((r) => r[4].join(' '))).toEqual(['145cm', '160cm']);
    const builtIn = doc.pages.find((p) => p.title === '빌트인 상세') as TablePage;
    expect(builtIn.rows[0][3].join(' ')).toMatch(/, 바닥에서 145cm$/);
    expect(builtIn.rows[1][3].join(' ')).toMatch(/, 바닥에서 160cm$/);
  });

  it('빌트인 상세: 번호·제품·치수(미확인 ≈)·벽 기준 위치', () => {
    const builtIn: Product = {
      id: 'custom-dw', brand: 'custom', model: '', name: '식기세척기', category: 'kitchen',
      dims: { w: 60, d: 60, h: 85 }, variants: [{ id: 'v', label: '기본', colors: {} }],
      builder: 'box', clearances: [], builtIn: true, mount: 'floor',
    };
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [sofa('s1'), { id: 'dw', productId: 'custom-dw', variantId: 'v', x: 100, y: 60, rotation: 0 }]),
      customProducts: [builtIn],
    };
    const table = buildPdf(plan, input).pages[9] as TablePage;
    expect(table.rows.map((r) => r.map((c) => c.join(' ')))).toEqual([
      ['2', '식기세척기', '≈60×60×85', '왼쪽 벽까지 60cm, 오른쪽 벽까지 214cm, 뒤 벽까지 20cm'],
    ]);
    const verified = withActiveItems(plan, [{ id: 'dw', productId: 'custom-dw', variantId: 'v', x: 100, y: 60, rotation: 0, verified: true }]);
    expect((buildPdf(verified, input).pages[9] as TablePage).rows[0][2]).toEqual(['60×60×85']);
  });

  it('제품이 많으면 여러 쪽으로 나누고 행을 잃지 않는다', () => {
    const many = Array.from({ length: 60 }, (_, i) => sofa(`s${i}`));
    const pages = buildPdf(withActiveItems(SAMPLE_PLAN, many), input).pages.filter((p) => p.title.startsWith('제품 목록')) as TablePage[];
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[1].title).toBe('제품 목록 (A안) (계속)');
    expect(pages.flatMap((p) => p.rows.map((r) => r[0][0]))).toEqual(many.map((_, i) => String(i + 1)));
    for (const p of pages) expect(usedMm(p)).toBeLessThanOrEqual(TABLE_BODY_MM);
  });

  it('아주 긴 메모는 칸 높이 안에서 자르고 …으로 끝낸다', () => {
    const plan: Plan = { ...SAMPLE_PLAN, checklist: [{ itemId: 'i-demo-1', checked: true, memo: '메모'.repeat(2000) }] };
    const pages = buildPdf(plan, input).pages.filter((p) => p.title.startsWith('공사 체크리스트')) as TablePage[];
    const row = pages.flatMap((p) => p.rows).find((r) => r[2].join('').includes('바닥·현관문·창호'))!;
    expect(row[0]).toEqual(['완료']);
    expect(row[1]).toEqual(['철거']);
    expect(row[3]).toHaveLength(MAX_CELL_LINES);
    expect(row[3].at(-1)!.endsWith('…')).toBe(true);
    for (const p of pages) expect(usedMm(p)).toBeLessThanOrEqual(TABLE_BODY_MM);
  });

  it('체크리스트 자동 항목은 [자동]으로 표시한다', () => {
    const pages = buildPdf(withActiveItems(SAMPLE_PLAN, [washer]), input).pages.filter((p) => p.title.startsWith('공사 체크리스트')) as TablePage[];
    const texts = pages.flatMap((p) => p.rows.map((r) => r[2].join('')));
    expect(texts.some((t) => t.startsWith('[자동] 전용회로 확인: 그랑데 드럼세탁기'))).toBe(true);
    expect(pages[0].columns.map((c) => c.label)).toEqual(['완료', '공정', '항목', '메모']);
  });

  it('빌트인이 없으면 안내 문구, 3D 캡처가 없으면 안내 문구', () => {
    const doc = buildPdf(SAMPLE_PLAN, input);
    const builtin = doc.pages[9] as TablePage;
    expect(builtin.rows).toEqual([]);
    expect(builtin.emptyText).toBe('빌트인 항목이 없습니다');
    const views = doc.pages[11];
    expect(views.kind === 'views' && views.views).toEqual([]);
    const withViews = buildPdf(SAMPLE_PLAN, { views: [{ label: '위에서 본 전체', dataUrl: 'data:image/jpeg;base64,AA' }], now: NOW }).pages[11];
    expect(withViews.kind === 'views' && withViews.views.map((v) => v.label)).toEqual(['위에서 본 전체']);
  });

  it('전기 계획도 주석: 설비 요약, 목록 안내, 전용회로 가전, 콘센트 없음 경고(설비별 메모는 넣지 않음)', () => {
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [washer]),
      fixtures: [{ id: 'f', kind: 'outlet', pos: { x: 10, y: 100 }, wallId: 'w4', height: 30, memo: 'TV 뒤' }],
    };
    const electric = buildPdf(plan, input).pages[7];
    expect(electric.kind === 'drawing' && electric.notes).toEqual([
      '설비: 콘센트 1개',
      '설비별 높이·메모는 다음 쪽 전기 설비 목록 참고',
      '전용회로 필요 가전(주황 테두리): 그랑데 드럼세탁기',
      '주의: 그랑데 드럼세탁기 주변 150cm 이내에 전용회로 콘센트가 없습니다',
    ]);
  });

  it('주석이 많으면 8줄로 줄이고 나머지 줄 수를 알린다', () => {
    const washers = Array.from({ length: CAP_WASHERS }, (_, i) => ({ ...washer, id: `wa${i}`, x: 100 + i }));
    const electric = buildPdf(withActiveItems(SAMPLE_PLAN, washers), input).pages[7];
    if (electric.kind !== 'drawing') throw new Error('drawing 아님');
    expect(electric.notes).toHaveLength(8);
    expect(electric.notes.at(-1)).toBe('외 7줄은 앱에서 확인하세요');
  });

  it('전기 설비 목록: E번호·종류·설치 높이·벽 부착·메모, 없으면 안내 문구', () => {
    const plan: Plan = {
      ...SAMPLE_PLAN,
      fixtures: [
        { id: 'f1', kind: 'outlet', pos: { x: 10, y: 100 }, wallId: 'w4', height: 30, memo: 'TV 뒤' },
        { id: 'f2', kind: 'light', pos: { x: 200, y: 200 }, height: 230 },
      ],
    };
    const table = buildPdf(plan, input).pages[8] as TablePage;
    expect(table.title).toBe('전기 설비 목록');
    expect(table.columns).toEqual([
      { label: '번호', width: 18 },
      { label: '종류', width: 50 },
      { label: '설치 높이', width: 30 },
      { label: '벽 부착', width: 25 },
      { label: '메모', width: 144 },
    ]);
    expect(table.rows.map((r) => r.map((c) => c.join(' ')))).toEqual([
      ['E1', '콘센트', '30cm', '예', 'TV 뒤'],
      ['E2', '조명', '230cm', '아니오', ''],
    ]);
    const empty = buildPdf(SAMPLE_PLAN, input).pages[8] as TablePage;
    expect(empty.title).toBe('전기 설비 목록');
    expect(empty.rows).toEqual([]);
    expect(empty.emptyText).toBe('배치된 전기 설비가 없습니다');
  });

  it('치수 평면도: 벽 치수선과 개구부 위치, 위치 표기 안내', () => {
    const dims = buildPdf(SAMPLE_PLAN, input).pages[5];
    if (dims.kind !== 'drawing') throw new Error('drawing 아님');
    expect(dims.svg).toContain('<line ');
    expect(dims.svg).toContain('>250–340<');
    expect(dims.notes).toContain('개구부 아래 숫자는 벽 시작점 기준 위치(cm)');
  });
});
