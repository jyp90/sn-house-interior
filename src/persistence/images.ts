import { newId } from '../model/ids';

export type ImageStore = {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | undefined>;
};

const MAX_IMAGE_PX = 4096;

export function fitWithin(w: number, h: number, max = MAX_IMAGE_PX): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

export function memoryImageStore(): ImageStore {
  const images = new Map<string, Blob>();
  return {
    put: async (key, blob) => {
      images.set(key, blob);
    },
    get: async (key) => images.get(key),
  };
}

function indexedDbImageStore(dbName = 'homefit', storeName = 'images'): ImageStore {
  let db: Promise<IDBDatabase> | null = null;
  const fail = (e: DOMException | null, what: string) => e ?? new Error(`IndexedDB ${what}에 실패했습니다`);
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(storeName);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(fail(req.error, '열기'));
    }).catch((e: unknown) => {
      // 한 번 실패해도 다음 호출에서 다시 열 수 있게 캐시를 비운다
      db = null;
      throw e;
    }));
  return {
    put: (key, blob) =>
      open().then(
        (d) =>
          new Promise<void>((resolve, reject) => {
            const tx = d.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put(blob, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(fail(tx.error, '저장'));
            tx.onabort = () => reject(fail(tx.error, '저장'));
          }),
      ),
    get: (key) =>
      open().then(
        (d) =>
          new Promise<Blob | undefined>((resolve, reject) => {
            const req = d.transaction(storeName, 'readonly').objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(fail(req.error, '읽기'));
          }),
      ),
  };
}

let defaultStore: ImageStore | null = null;

export function getDefaultImageStore(): ImageStore {
  return (defaultStore ??= indexedDbImageStore());
}

type PreparedImage = { blob: Blob; widthPx: number; heightPx: number };

async function prepareImage(file: Blob, max = MAX_IMAGE_PX): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = fitWithin(bitmap.width, bitmap.height, max);
    if (size.w === bitmap.width && size.h === bitmap.height) return { blob: file, widthPx: size.w, heightPx: size.h };
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d 컨텍스트를 만들 수 없습니다');
    ctx.drawImage(bitmap, 0, 0, size.w, size.h);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환에 실패했습니다'))), file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92),
    );
    return { blob, widthPx: size.w, heightPx: size.h };
  } finally {
    bitmap.close();
  }
}

export async function saveBackgroundImage(
  store: ImageStore,
  file: Blob,
  prepare: (f: Blob) => Promise<PreparedImage> = prepareImage,
): Promise<{ imageRef: string; widthPx: number; heightPx: number }> {
  const img = await prepare(file);
  const imageRef = newId('image');
  await store.put(imageRef, img.blob);
  return { imageRef, widthPx: img.widthPx, heightPx: img.heightPx };
}
