import type { Plan } from '../model/schema';
import { parsePlan, type ParseResult } from './parse';

export function planToJson(plan: Plan): string {
  return JSON.stringify(plan, null, 2);
}

export async function readPlanFile(file: Blob): Promise<ParseResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: 'JSON 형식이 아닙니다' };
  }
  return parsePlan(raw);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string): void {
  downloadBlob(new Blob([text], { type: 'application/json' }), filename);
}
