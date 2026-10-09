import type { Plan } from '../model/schema';
import type { ImageStore } from './images';
import { parsePlan } from './parse';

// 우리 집 프리셋(home/)은 virtual:home-preset으로 들어온다. 테스트·HOMEFIT_SAMPLE=1에서는 null(스펙 §15.1, §20)
export type HomePresetSource = { plan: unknown; imageUrl: string | null };

export const HOME_IMAGE_REF = 'image-home-floorplan';

export type HomePresetResult = { ok: true; plan: Plan; imageMissing: boolean } | { ok: false; error: string };

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
