import { newId } from '../model/ids';

export type ImageStore = {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | undefined>;
};

export const MAX_IMAGE_PX = 4096;

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

export function indexedDbImageStore(dbName = 'homefit', storeName = 'images'): ImageStore {
  let db: Promise<IDBDatabase> | null = null;
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(storeName);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
    open().then(
      (d) =>
        new Promise<T>((resolve, reject) => {
          const req = fn(d.transaction(storeName, mode).objectStore(storeName));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );
  return {
    put: async (key, blob) => {
      await run('readwrite', (s) => s.put(blob, key));
    },
    get: (key) => run<Blob | undefined>('readonly', (s) => s.get(key)),
  };
}

let defaultStore: ImageStore | null = null;

export function getDefaultImageStore(): ImageStore {
  return (defaultStore ??= indexedDbImageStore());
}

export type PreparedImage = { blob: Blob; widthPx: number; heightPx: number };

export async function prepareImage(file: Blob, max = MAX_IMAGE_PX): Promise<PreparedImage> {
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
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환에 실패했습니다'))), 'image/png'),
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
