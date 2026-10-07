import { PlanSchema, type Plan } from '../model/schema';

export type ParseResult = { ok: true; plan: Plan } | { ok: false; error: string };

type RawPlan = Record<string, unknown>;

export const CURRENT_VERSION = 1;

// version N → N+1 변환. 스키마 버전을 올릴 때 여기에 추가한다.
const MIGRATIONS: Record<number, (raw: RawPlan) => RawPlan> = {};

export function migrate(raw: RawPlan, steps = MIGRATIONS, current = CURRENT_VERSION): RawPlan | null {
  let cur = raw;
  while (typeof cur.version === 'number' && cur.version < current) {
    const step = steps[cur.version];
    if (!step) return null;
    const next = step(cur);
    if (typeof next.version !== 'number' || next.version <= cur.version) return null;
    cur = next;
  }
  return cur.version === current ? cur : null;
}

export function parsePlan(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: '평면 파일 형식이 아닙니다' };
  const migrated = migrate(raw as RawPlan);
  if (!migrated) {
    return { ok: false, error: `지원하지 않는 파일 버전입니다: ${String((raw as RawPlan).version)}` };
  }
  const r = PlanSchema.safeParse(migrated);
  if (r.success) return { ok: true, plan: r.data };
  const error = r.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  return { ok: false, error };
}
