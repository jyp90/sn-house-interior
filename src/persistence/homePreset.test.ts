import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkMismatch } from '../editor2d/calibration';
import { isSimplePolygon, isValidPolygon, pointInPolygon } from '../geometry/polygon';
import { distanceToWall } from '../geometry/structure';
import { wallLength } from '../geometry/walls';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { HOME_IMAGE_REF, markPresetSeen, presetFingerprint, PRESET_SEEN_KEY, prepareHomePreset } from './homePreset';
import { memoryImageStore } from './images';
import { parsePlan } from './parse';

const withBg = {
  ...SAMPLE_PLAN,
  background: { imageRef: HOME_IMAGE_REF, widthPx: 10, heightPx: 10, cmPerPx: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 0.5 },
};
const blob = new Blob(['jpg'], { type: 'image/jpeg' });

describe('prepareHomePreset', () => {
  it('배경 이미지가 저장소에 없으면 받아서 고정 키로 넣는다', async () => {
    const store = memoryImageStore();
    const urls: string[] = [];
    const r = await prepareHomePreset({ plan: withBg, imageUrl: '/img.jpg' }, store, async (url) => {
      urls.push(url);
      return blob;
    });
    expect(r).toEqual({ ok: true, plan: withBg, imageMissing: false });
    expect(urls).toEqual(['/img.jpg']);
    expect(await store.get(HOME_IMAGE_REF)).toBe(blob);
  });

  it('이미 저장돼 있으면 다시 받지 않는다', async () => {
    const store = memoryImageStore();
    await store.put(HOME_IMAGE_REF, blob);
    const r = await prepareHomePreset({ plan: withBg, imageUrl: '/img.jpg' }, store, async () => {
      throw new Error('호출되면 안 됨');
    });
    expect(r.ok && r.imageMissing).toBe(false);
  });

  it('이미지를 못 받으면 평면은 그대로 쓰고 imageMissing을 알린다', async () => {
    const fail = async () => {
      throw new Error('404');
    };
    expect(await prepareHomePreset({ plan: withBg, imageUrl: '/img.jpg' }, memoryImageStore(), fail)).toEqual({
      ok: true,
      plan: withBg,
      imageMissing: true,
    });
    expect(await prepareHomePreset({ plan: withBg, imageUrl: null }, memoryImageStore(), fail)).toEqual({
      ok: true,
      plan: withBg,
      imageMissing: true,
    });
  });

  it('배경이 없는 평면은 이미지를 받지 않는다', async () => {
    const r = await prepareHomePreset({ plan: SAMPLE_PLAN, imageUrl: '/img.jpg' }, memoryImageStore(), async () => {
      throw new Error('호출되면 안 됨');
    });
    expect(r).toEqual({ ok: true, plan: SAMPLE_PLAN, imageMissing: false });
  });

  it('평면 형식이 틀리면 오류', async () => {
    const r = await prepareHomePreset({ plan: { version: 2 }, imageUrl: null }, memoryImageStore());
    expect(r.ok).toBe(false);
  });
});

// private/(git 제외)에 우리 집 프리셋이 있을 때만 확인한다
const PRESET = new URL('../../private/our-home.local.json', import.meta.url);

describe.skipIf(!existsSync(PRESET))('우리 집 프리셋 (private)', () => {
  it('스키마를 통과하고 배경 축척·문·전기 설비가 문서와 맞는다', async () => {
    const r = await prepareHomePreset({ plan: JSON.parse(readFileSync(PRESET, 'utf8')), imageUrl: null }, memoryImageStore());
    if (!r.ok) throw new Error(r.error);
    const plan = r.plan;
    expect(plan.background?.imageRef).toBe(HOME_IMAGE_REF);
    expect(checkMismatch(plan.background!)).toBeLessThan(0.02);

    const walls = new Map(plan.walls.map((w) => [w.id, w]));
    for (const o of plan.openings) expect(o.offset + o.width).toBeLessThanOrEqual(wallLength(walls.get(o.wallId)!));
    // 욕실만 바깥여닫이(주방 쪽 +y), 중문은 실내(주방 쪽 -x)
    expect(plan.openings.find((o) => o.id === 'bath-door')?.swingIn).toBe(true);
    expect(plan.openings.find((o) => o.id === 'middle-door')).toMatchObject({ swingIn: true, middle: true, leaves: 'single', width: 90 });

    for (const f of plan.fixtures) {
      const w = walls.get(f.wallId!)!;
      expect(distanceToWall(w, f.pos)).toBeCloseTo(w.thickness / 2);
    }
    expect(plan.fixtures.filter((f) => f.kind === 'outlet-waterproof')).toHaveLength(2);
    expect(plan.fixtures.filter((f) => f.kind === 'outlet-dedicated')).toHaveLength(4);
  });
});

// home/plan.json(git 추적, 배포)은 테스트 환경에서 virtual:home-preset이 null이라 파일을 직접 읽는다(스펙 §35.4)
const HOME_PLAN = new URL('../../home/plan.json', import.meta.url);

describe('home/plan.json', () => {
  it('파싱되고 방 9개 모두 polygon이 있으며 라벨은 그 안에 있다', () => {
    const r = parsePlan(JSON.parse(readFileSync(HOME_PLAN, 'utf8')));
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.rooms).toHaveLength(9);
    for (const room of r.plan.rooms) {
      expect(room.polygon, room.id).toBeDefined();
      expect(isValidPolygon(room.polygon!) && isSimplePolygon(room.polygon!), room.id).toBe(true);
      expect(pointInPolygon(room.label, room.polygon!), room.id).toBe(true);
    }
    const living = r.plan.rooms.find((room) => room.id === 'living')!.polygon!;
    expect([...living].sort((a, b) => a.x - b.x || a.y - b.y)).toEqual([
      { x: 9, y: 370 },
      { x: 9, y: 720 },
      { x: 584, y: 370 },
      { x: 584, y: 720 },
    ]);
  });
});

describe('프리셋 갱신 안내 (스펙 §39.4)', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };
  it('지문은 같은 JSON에 같고 다른 JSON에 다르다', () => {
    expect(presetFingerprint({ a: 1 })).toBe(presetFingerprint({ a: 1 }));
    expect(presetFingerprint({ a: 1 })).not.toBe(presetFingerprint({ a: 2 }));
  });
  it('새 지문이면 true를 돌려주고 기억해 두 번째부터는 false', () => {
    const s = mem();
    expect(markPresetSeen('x', s)).toBe(true);
    expect(s.m.get(PRESET_SEEN_KEY)).toBe('x');
    expect(markPresetSeen('x', s)).toBe(false);
    expect(markPresetSeen('y', s)).toBe(true);
  });
  it('저장소가 없거나 던지면 안내하지 않는다', () => {
    expect(markPresetSeen('x', undefined)).toBe(false);
    expect(markPresetSeen('x', { getItem: () => { throw new Error('blocked'); }, setItem: () => {} })).toBe(false);
  });
});
