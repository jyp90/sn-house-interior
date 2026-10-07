import { PlanSchema, type Plan } from '../model/schema';

export type ParseResult = { ok: true; plan: Plan } | { ok: false; error: string };

export function parsePlan(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: '평면 파일 형식이 아닙니다' };
  const version = (raw as { version?: unknown }).version;
  if (version !== 1) return { ok: false, error: `지원하지 않는 파일 버전입니다: ${String(version)}` };
  const r = PlanSchema.safeParse(raw);
  if (r.success) return { ok: true, plan: r.data };
  const error = r.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  return { ok: false, error };
}
