import { describe, expect, it } from 'vitest';
import { fitWithin, memoryImageStore, saveBackgroundImage } from './images';

describe('fitWithin', () => {
  it('긴 변이 4096px를 넘으면 비율을 유지해 줄인다', () => {
    expect(fitWithin(8000, 4000)).toEqual({ w: 4096, h: 2048 });
    expect(fitWithin(1000, 500)).toEqual({ w: 1000, h: 500 });
  });
});

describe('memoryImageStore', () => {
  it('넣은 이미지를 꺼내고, 없는 키는 undefined', async () => {
    const store = memoryImageStore();
    const blob = new Blob(['x']);
    await store.put('k', blob);
    expect(await store.get('k')).toBe(blob);
    expect(await store.get('none')).toBeUndefined();
  });
});

describe('saveBackgroundImage', () => {
  it('준비한 이미지를 새 키로 저장하고 크기를 돌려준다', async () => {
    const store = memoryImageStore();
    const prepared = new Blob(['png']);
    const r = await saveBackgroundImage(store, new Blob(['raw']), async () => ({ blob: prepared, widthPx: 400, heightPx: 300 }));
    expect(r.imageRef).toMatch(/^image-/);
    expect(r).toMatchObject({ widthPx: 400, heightPx: 300 });
    expect(await store.get(r.imageRef)).toBe(prepared);
  });
});
