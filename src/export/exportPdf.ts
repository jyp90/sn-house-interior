import { planBounds } from '../geometry/bounds';
import type { Plan } from '../model/schema';
import { pdfViewPoses } from '../scene3d/cameraFit';
import { captureViews } from '../scene3d/CaptureBridge';
import { buildPdf, type PdfView } from './pages';

export const VIEW_SIZE = { width: 1200, height: 800 };

export function capturePdfViews(plan: Plan): PdfView[] {
  const capture = captureViews.current;
  if (!capture) return [];
  const poses = pdfViewPoses(planBounds(plan));
  try {
    const urls = capture(poses.map((p) => p.fit), VIEW_SIZE.width, VIEW_SIZE.height);
    return urls.map((dataUrl, i) => ({ label: poses[i].label, dataUrl }));
  } catch {
    return [];
  }
}

export async function exportPdf(
  plan: Plan,
  onProgress?: (done: number, total: number) => void,
): Promise<{ blob: Blob; pageCount: number; fileName: string }> {
  const doc = buildPdf(plan, { views: capturePdfViews(plan), now: new Date() });
  const { renderPdf } = await import('./pdf'); // jsPDF·svg2pdf·글꼴은 PDF를 만들 때만 불러온다
  const result = await renderPdf(doc, onProgress);
  return { ...result, fileName: doc.fileName };
}
