import { DEFAULT_LAYOUT_ID } from '../model/layout';
import { PlanSchema, type Plan } from '../model/schema';

export type ParseResult = { ok: true; plan: Plan } | { ok: false; error: string };

type RawPlan = Record<string, unknown>;

const CURRENT_VERSION = 10;

// version N → N+1 변환. 스키마 버전을 올릴 때 여기에 추가한다.
const MIGRATIONS: Record<number, (raw: RawPlan) => RawPlan> = {
  // v2: 배치안 도입. 기존 아이템은 A안으로 옮긴다
  1: ({ items, ...rest }) => ({
    ...rest,
    version: 2,
    layouts: [{ id: DEFAULT_LAYOUT_ID, name: 'A안', items: Array.isArray(items) ? items : [] }],
    activeLayoutId: DEFAULT_LAYOUT_ID,
  }),
  // v3: 문에 선택 필드 middle·leaves 추가. 둘 다 선택이라 버전만 올린다
  2: (raw) => ({ ...raw, version: 3 }),
  // v4: 방 영역(polygon)·바닥/벽 마감, 평면 기본 마감 추가. 모두 선택이라 버전만 올린다
  3: (raw) => ({ ...raw, version: 4 }),
  // v5: 아이템·제품 설치 높이(elevation), mount 'ceiling', 분류 'bath', builder 4종 추가. 모두 선택·확장이라 버전만 올린다
  4: (raw) => ({ ...raw, version: 5 }),
  // v6: 아이템 메모(note) 추가. 선택 필드라 버전만 올린다
  5: (raw) => ({ ...raw, version: 6 }),
  // v7: 설비 스위치 그룹(group) 추가. 선택 필드라 버전만 올린다
  6: (raw) => ({ ...raw, version: 7 }),
  // v8: 코너 싱크대·레인지후드 builder(corner-cabinet) 추가. 확장이라 버전만 올린다
  7: (raw) => ({ ...raw, version: 8 }),
  // v9: 문짝 'sliding' 추가. 확장이라 버전만 올린다
  8: (raw) => ({ ...raw, version: 9 }),
  // v10: 설비 종류 'ceiling-fan'(실링팬) 추가. 확장이라 버전만 올린다
  9: (raw) => ({ ...raw, version: 10 }),
};

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
