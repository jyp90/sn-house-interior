import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import {
  CONTENT_WIDTH,
  COVER_LABEL_MM,
  COVER_LINE_MM,
  HEADER_ROW_MM,
  LINE_MM,
  NOTE_FONT_PT,
  NOTE_LINE_MM,
  PAGE,
  PDF_FONT_FAMILY,
  rowHeightMm,
  TABLE_FONT_PT,
  type CoverPage,
  type DrawingPage,
  type PdfDocument,
  type TablePage,
  type ViewsPage,
} from './pages';
import { loadPdfFonts } from './pdfFont';

const INK = '#1f2328';
const MUTED = '#6b7280';
const RULE = '#e5e1d8';

type PdfResult = { blob: Blob; pageCount: number };

function setFont(doc: jsPDF, style: 'normal' | 'bold', size: number, color: string): void {
  doc.setFont(PDF_FONT_FAMILY, style);
  doc.setFontSize(size);
  doc.setTextColor(color);
}

function drawTitle(doc: jsPDF, title: string): void {
  setFont(doc, 'bold', 15, INK);
  doc.text(title, PAGE.margin, 18);
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.4);
  doc.line(PAGE.margin, 22, PAGE.width - PAGE.margin, 22);
}

function drawCover(doc: jsPDF, page: CoverPage): void {
  setFont(doc, 'bold', 26, INK);
  doc.text(page.title, PAGE.margin, 45);
  setFont(doc, 'normal', 12, MUTED);
  doc.text('인테리어 업체 전달 자료', PAGE.margin, 55);
  let y = 75;
  for (const row of page.rows) {
    setFont(doc, 'bold', 12, INK);
    doc.text(row.label, PAGE.margin, y);
    setFont(doc, 'normal', 12, INK);
    row.lines.forEach((line, k) => doc.text(line, PAGE.margin + COVER_LABEL_MM, y + k * COVER_LINE_MM));
    y += Math.max(1, row.lines.length) * COVER_LINE_MM + 3;
  }
}

async function drawDrawing(doc: jsPDF, page: DrawingPage): Promise<void> {
  const availH = PAGE.height - PAGE.bottom - PAGE.top - page.notes.length * NOTE_LINE_MM - 4;
  const scale = Math.min(CONTENT_WIDTH / page.width, availH / page.height);
  const w = page.width * scale;
  const h = page.height * scale;
  const x = PAGE.margin + (CONTENT_WIDTH - w) / 2;
  const el = new DOMParser().parseFromString(page.svg, 'image/svg+xml').documentElement;
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-100000px;top:0;';
  holder.appendChild(document.importNode(el, true));
  document.body.appendChild(holder);
  try {
    await svg2pdf(holder.firstElementChild!, doc, { x, y: PAGE.top, width: w, height: h });
  } finally {
    holder.remove();
  }
  setFont(doc, 'normal', NOTE_FONT_PT, MUTED);
  page.notes.forEach((note, k) => doc.text(note, PAGE.margin, PAGE.top + h + 6 + k * NOTE_LINE_MM));
}

function drawTable(doc: jsPDF, page: TablePage): void {
  const xs: number[] = [];
  page.columns.reduce<number>((x, c) => {
    xs.push(x);
    return x + c.width;
  }, PAGE.margin);
  let y = PAGE.top;
  doc.setFillColor('#f3f1ec');
  doc.rect(PAGE.margin, y, CONTENT_WIDTH, HEADER_ROW_MM, 'F');
  setFont(doc, 'bold', TABLE_FONT_PT, INK);
  page.columns.forEach((c, i) => doc.text(c.label, xs[i] + 1.5, y + 5.5));
  y += HEADER_ROW_MM;
  if (page.rows.length === 0) {
    setFont(doc, 'normal', TABLE_FONT_PT, MUTED);
    doc.text(page.emptyText, PAGE.margin + 1.5, y + 7);
    return;
  }
  setFont(doc, 'normal', TABLE_FONT_PT, INK);
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.2);
  for (const row of page.rows) {
    row.forEach((cell, i) => cell.forEach((line, k) => doc.text(line, xs[i] + 1.5, y + 4.6 + k * LINE_MM)));
    y += rowHeightMm(Math.max(...row.map((c) => c.length)));
    doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
  }
}

function drawViews(doc: jsPDF, page: ViewsPage): void {
  if (page.views.length === 0) {
    setFont(doc, 'normal', 11, MUTED);
    doc.text(page.emptyText, PAGE.margin, PAGE.top + 8);
    return;
  }
  const gap = 7;
  const availH = PAGE.height - PAGE.top - PAGE.bottom;
  const h = Math.min((CONTENT_WIDTH - gap) / 2 / 1.5, (availH - gap - 12) / 2);
  const w = h * 1.5;
  page.views.forEach((v, i) => {
    const x = PAGE.margin + (i % 2) * (w + gap);
    const y = PAGE.top + Math.floor(i / 2) * (h + gap + 6);
    doc.addImage(v.dataUrl, 'PNG', x, y, w, h);
    setFont(doc, 'normal', NOTE_FONT_PT, MUTED);
    doc.text(v.label, x, y + h + 4.5);
  });
}

export async function renderPdf(data: PdfDocument, onProgress?: (done: number, total: number) => void): Promise<PdfResult> {
  const fonts = await loadPdfFonts();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.addFileToVFS('Pretendard-Regular.ttf', fonts.regular);
  doc.addFont('Pretendard-Regular.ttf', PDF_FONT_FAMILY, 'normal');
  doc.addFileToVFS('Pretendard-Bold.ttf', fonts.bold);
  doc.addFont('Pretendard-Bold.ttf', PDF_FONT_FAMILY, 'bold');

  const total = data.pages.length;
  for (const [i, page] of data.pages.entries()) {
    if (i > 0) doc.addPage();
    if (page.kind === 'cover') {
      drawCover(doc, page);
    } else {
      drawTitle(doc, page.title);
      if (page.kind === 'drawing') await drawDrawing(doc, page);
      else if (page.kind === 'table') drawTable(doc, page);
      else drawViews(doc, page);
    }
    onProgress?.(i + 1, total);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 진행률 표시가 갱신되게 양보
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    setFont(doc, 'normal', 8, MUTED);
    doc.text(`${data.header} · ${p}/${pageCount}`, PAGE.width - PAGE.margin, PAGE.height - 7, { align: 'right' });
  }
  return { blob: doc.output('blob'), pageCount };
}
