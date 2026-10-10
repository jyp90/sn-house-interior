import type { Plan } from '../model/schema';
import type { ImageStore } from './images';
import { parsePlan } from './parse';

// 우리 집 프리셋(home/)은 virtual:home-preset으로 들어온다. 테스트·HOMEFIT_SAMPLE=1에서는 null(스펙 §15.1, §20)
type HomePresetSource = { plan: unknown; imageUrl: string | null };

export const HOME_IMAGE_REF = 'image-home-floorplan';

type HomePresetResult = { ok: true; plan: Plan; imageMissing: boolean } | { ok: false; error: string };

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`평면도 이미지를 받지 못했습니다: ${res.status}`);
  return res.blob();
}

export async function prepareHomePreset(
  source: HomePresetSource,
  store: ImageStore,
  fetchImage: (url: string) => Promise<Blob> = fetchBlob,
): Promise<HomePresetResult> {
  const parsed = parsePlan(source.plan);
  if (!parsed.ok) return parsed;
  const ref = parsed.plan.background?.imageRef;
  if (!ref) return { ok: true, plan: parsed.plan, imageMissing: false };
  try {
    if (!(await store.get(ref))) {
      if (!source.imageUrl) return { ok: true, plan: parsed.plan, imageMissing: true };
      await store.put(ref, await fetchImage(source.imageUrl));
    }
    return { ok: true, plan: parsed.plan, imageMissing: false };
  } catch {
    return { ok: true, plan: parsed.plan, imageMissing: true };
  }
}

// 프리셋 갱신 안내(스펙 §39.4): 프리셋 JSON의 지문을 브라우저에 기억해 두고, 저장된 평면으로 시작하는데 지문이 바뀌었으면 한 번 안내한다
export const PRESET_SEEN_KEY = 'homefit:preset-seen:v1';

export function presetFingerprint(plan: unknown): string {
  const s = JSON.stringify(plan);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return `${(h >>> 0).toString(16)}-${s.length}`;
}

type SeenStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };

// 지문이 새것이면 true를 돌려주고 기억한다(한 번만 안내). 저장소 오류는 안내 생략
export function markPresetSeen(fingerprint: string, storage: SeenStore | undefined): boolean {
  try {
    if (!storage) return false;
    if (storage.getItem(PRESET_SEEN_KEY) === fingerprint) return false;
    storage.setItem(PRESET_SEEN_KEY, fingerprint);
    return true;
  } catch {
    return false;
  }
}

export const PRESET_UPDATED_TEXT = '우리 집 기본 평면이 갱신되었습니다. 구조 탭의 「우리 집 기본 평면 불러오기」로 새 평면을 적용하세요(현재 평면은 덮어씁니다).';
