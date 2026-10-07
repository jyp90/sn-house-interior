import { findProduct } from '../catalog/products';
import { PHASES } from '../checklist/defaults';
import { checklistEntry, checklistItems } from '../checklist/items';
import { DEDICATED_RADIUS_CM, FIXTURE_LABEL, fixtureNumbers, fixtureSummary, missingDedicatedCircuit } from '../electrical/fixtures';
import { wallReferenceText } from '../geometry/wallReference';
import { activeItems, activeLayout } from '../model/layout';
import type { Item, Plan, Product } from '../model/schema';
import { itemNumbers, pdfFileName, planSvg, unverifiedCount } from './planSvg';

export const PDF_FONT_FAMILY = 'Pretendard';

// A4 가로, mm
export const PAGE = { width: 297, height: 210, margin: 15, top: 28, bottom: 14 } as const;
export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
export const TABLE_FONT_PT = 10;
export const NOTE_FONT_PT = 9;
export const LINE_MM = 5.2;
export const ROW_PAD_MM = 2.4;
export const HEADER_ROW_MM = 8;
export const TABLE_BODY_MM = PAGE.height - PAGE.top - PAGE.bottom - HEADER_ROW_MM;
export const MAX_CELL_LINES = Math.floor((TABLE_BODY_MM - ROW_PAD_MM) / LINE_MM);
export const MAX_NOTES = 8;
export const NOTE_LINE_MM = 5;
export const COVER_LABEL_MM = 35;
export const COVER_LINE_MM = 6.5;
const COVER_FONT_PT = 12;
const PT_MM = 0.3528;

export const rowHeightMm = (lines: number) => lines * LINE_MM + ROW_PAD_MM;

// 글자 너비 근사: 한글·한자 등은 1em, 그 밖은 0.6em(보수적으로 넉넉하게)
const unitOf = (ch: string) => (ch.charCodeAt(0) >= 0x1100 ? 1 : 0.6);

export function textUnits(s: string): number {
  let n = 0;
  for (const ch of s) n += unitOf(ch);
  return n;
}

export function unitsForWidth(widthMm: number, fontPt = TABLE_FONT_PT): number {
  return Math.max(1, Math.floor((widthMm - 3) / (fontPt * PT_MM)));
}

export function wrapText(text: string, maxUnits: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (textUnits(candidate) <= maxUnits) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      let chunk = '';
      for (const ch of word) {
        if (chunk && textUnits(chunk + ch) > maxUnits) {
          lines.push(chunk);
          chunk = '';
        }
        chunk += ch;
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines;
}

export function clampLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = `${[...kept[max - 1]].slice(0, -1).join('')}…`;
  return kept;
}

export type TableColumn = { label: string; width: number }; // width: mm
export type CoverPage = { kind: 'cover'; title: string; rows: { label: string; lines: string[] }[] };
export type DrawingPage = { kind: 'drawing'; title: string; svg: string; width: number; height: number; notes: string[] };
export type TablePage = { kind: 'table'; title: string; columns: TableColumn[]; rows: string[][][]; emptyText: string };
export type PdfView = { label: string; dataUrl: string };
export type ViewsPage = { kind: 'views'; title: string; views: PdfView[]; emptyText: string };
export type PdfPage = CoverPage | DrawingPage | TablePage | ViewsPage;
export type PdfInput = { views: PdfView[]; now: Date };
export type PdfDocument = { header: string; fileName: string; pages: PdfPage[] };

export function tablePages(title: string, columns: TableColumn[], cells: string[][], emptyText: string): TablePage[] {
  const rows = cells.map((r) => r.map((c, i) => clampLines(wrapText(c, unitsForWidth(columns[i].width)), MAX_CELL_LINES)));
  const chunks: string[][][][] = [];
  let current: string[][][] = [];
  let used = 0;
  for (const row of rows) {
    const h = rowHeightMm(Math.max(...row.map((c) => c.length)));
    if (current.length > 0 && used + h > TABLE_BODY_MM) {
      chunks.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += h;
  }
  chunks.push(current);
  return chunks.map((chunk, i) => ({ kind: 'table', title: i === 0 ? title : `${title} (계속)`, columns, rows: chunk, emptyText }));
}

function noteLines(notes: string[]): string[] {
  const lines = notes.flatMap((n) => wrapText(n, unitsForWidth(CONTENT_WIDTH, NOTE_FONT_PT)));
  return lines.length <= MAX_NOTES ? lines : [...lines.slice(0, MAX_NOTES - 1), `외 ${lines.length - MAX_NOTES + 1}줄은 앱에서 확인하세요`];
}

const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function coverRows(plan: Plan, now: Date): CoverPage['rows'] {
  const i = plan.info;
  const layout = activeLayout(plan);
  const area = [i.supplyArea !== undefined ? `공급 ${i.supplyArea}m²` : '', i.exclusiveArea !== undefined ? `전용 ${i.exclusiveArea}m²` : '']
    .filter(Boolean)
    .join(' / ');
  const rows: [string, string | undefined, number][] = [
    ['주소', i.address, 2],
    ['면적', area, 1],
    ['준공연도', i.builtYear !== undefined ? `${i.builtYear}년` : undefined, 1],
    ['입주 예정일', i.moveInDate, 1],
    ['공사 범위', i.scope, 2],
    ['배치안', layout.memo ? `${layout.name} — ${layout.memo}` : layout.name, 2],
    ['메모', i.notes, 5],
    ['작성일', formatDate(now), 1],
  ];
  const units = unitsForWidth(CONTENT_WIDTH - COVER_LABEL_MM, COVER_FONT_PT);
  return rows
    .filter((r): r is [string, string, number] => !!r[1]?.trim())
    .map(([label, value, max]) => ({ label, lines: clampLines(wrapText(value.trim(), units), max) }));
}

export function buildPdf(plan: Plan, input: PdfInput): PdfDocument {
  const resolve = (id: string) => findProduct(plan, id);
  const layout = activeLayout(plan);
  const base = { fontFamily: PDF_FONT_FAMILY, header: false } as const;
  const numbers = itemNumbers(plan);
  const placed = activeItems(plan).flatMap((item) => {
    const product = resolve(item.productId);
    return product ? [{ item, product }] : [];
  });
  const missing = new Set(missingDedicatedCircuit(plan, resolve));
  const dedicated = placed.filter((p) => p.product.power?.dedicatedCircuit);
  const fxNumbers = fixtureNumbers(plan);
  // 실측 미확인 가구는 ≈ (도면·제품 목록·빌트인 상세 공통)
  const sizeText = (item: Item, product: Product) => {
    const dims = `${product.dims.w}×${product.dims.d}×${product.dims.h}`;
    return item.verified ? dims : `≈${dims}`;
  };

  const drawing = (title: string, svg: ReturnType<typeof planSvg>, notes: string[]): DrawingPage => ({
    kind: 'drawing',
    title,
    svg: svg.svg,
    width: svg.width,
    height: svg.height,
    notes: noteLines(notes),
  });

  const pages: PdfPage[] = [
    { kind: 'cover', title: plan.info.title, rows: coverRows(plan, input.now) },
    drawing('치수 평면도', planSvg(plan, { ...base, items: 'none', dimensionLines: true }), [
      '단위: cm · 벽 길이는 벽 중심선 기준',
      `≈ 표시는 실측 미확인 치수 (${unverifiedCount(plan)}개)`,
      '개구부 아래 숫자는 벽 시작점 기준 위치(cm)',
    ]),
    drawing(`가구·가전 배치도 (${layout.name})`, planSvg(plan, { ...base, items: 'number' }), [
      '번호는 제품 목록의 번호와 같습니다',
      '회색 부채꼴은 방문 열림 반경입니다',
    ]),
    drawing('전기 계획도', planSvg(plan, { ...base, items: 'faint', fixtures: true, highlightIds: dedicated.map((p) => p.item.id) }), [
      ...(plan.fixtures.length > 0
        ? [`설비: ${fixtureSummary(plan.fixtures)}`, '설비별 높이·메모는 다음 쪽 전기 설비 목록 참고']
        : ['배치된 전기 설비가 없습니다']),
      dedicated.length > 0 ? `전용회로 필요 가전(주황 테두리): ${dedicated.map((p) => p.product.name).join(', ')}` : '전용회로가 필요한 가전이 없습니다',
      ...dedicated
        .filter((p) => missing.has(p.item.id))
        .map((p) => `주의: ${p.product.name} 주변 ${DEDICATED_RADIUS_CM}cm 이내에 전용회로 콘센트가 없습니다`),
    ]),
    ...tablePages(
      '전기 설비 목록',
      [
        { label: '번호', width: 18 },
        { label: '종류', width: 50 },
        { label: '설치 높이', width: 30 },
        { label: '벽 부착', width: 25 },
        { label: '메모', width: 144 },
      ],
      plan.fixtures.map((f) => [`E${fxNumbers.get(f.id)}`, FIXTURE_LABEL[f.kind], `${f.height}cm`, f.wallId ? '예' : '아니오', f.memo ?? '']),
      '배치된 전기 설비가 없습니다',
    ),
    ...tablePages(
      '빌트인 상세',
      [
        { label: '번호', width: 15 },
        { label: '제품', width: 70 },
        { label: 'W×D×H (cm)', width: 40 },
        { label: '벽 기준 위치', width: 142 },
      ],
      placed
        .filter((p) => p.product.builtIn)
        .map(({ item, product }) => [
          String(numbers.get(item.id)),
          product.model ? `${product.name}\n${product.model}` : product.name,
          sizeText(item, product),
          wallReferenceText(plan, item, product),
        ]),
      '빌트인 항목이 없습니다',
    ),
    ...tablePages(
      `제품 목록 (${layout.name})`,
      [
        { label: '번호', width: 15 },
        { label: '모델명', width: 75 },
        { label: '이름', width: 60 },
        { label: 'W×D×H (cm)', width: 42 },
        { label: '소비전력', width: 35 },
        { label: '전용회로', width: 40 },
      ],
      placed.map(({ item, product }) => {
        const circuit = product.power?.dedicatedCircuit ? (missing.has(item.id) ? '필요 (콘센트 없음)' : '필요') : '-';
        return [
          String(numbers.get(item.id)),
          product.model || '-',
          product.name,
          sizeText(item, product),
          product.power ? `${product.power.watts}W` : '-',
          circuit,
        ];
      }),
      '배치된 제품이 없습니다',
    ),
    { kind: 'views', title: '3D 보기', views: input.views, emptyText: '3D 화면을 캡처하지 못했습니다(WebGL 미지원). 앱의 3D 보기에서 확인하세요.' },
    ...tablePages(
      '공사 체크리스트',
      [
        { label: '완료', width: 15 },
        { label: '공정', width: 28 },
        { label: '항목', width: 150 },
        { label: '메모', width: 74 },
      ],
      checklistItems(plan, resolve).map((i) => {
        const entry = checklistEntry(plan, i.id);
        return [
          entry?.checked ? '완료' : '',
          PHASES.find((p) => p.id === i.phase)?.label ?? '',
          `${i.auto ? '[자동] ' : ''}${i.text}`,
          entry?.memo ?? '',
        ];
      }),
      '항목이 없습니다',
    ),
  ];

  return { header: `${plan.info.title} · ${layout.name}`, fileName: pdfFileName(plan.info.title, layout.name), pages };
}
