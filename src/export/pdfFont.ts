import boldUrl from 'pretendard/dist/public/static/alternative/Pretendard-Bold.ttf?url';
import regularUrl from 'pretendard/dist/public/static/alternative/Pretendard-Regular.ttf?url';

type PdfFonts = { regular: string; bold: string };

export class PdfFontError extends Error {
  constructor(message = '글꼴을 불러오지 못했습니다') {
    super(message);
    this.name = 'PdfFontError';
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

async function fetchBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new PdfFontError();
    return bytesToBase64(new Uint8Array(await res.arrayBuffer()));
  } catch (e) {
    throw e instanceof PdfFontError ? e : new PdfFontError();
  }
}

let cache: Promise<PdfFonts> | null = null;

// PDF를 만들 때만 내려받는다(약 5MB). 실패한 시도는 캐시하지 않아 "다시 시도"가 새로 내려받는다
export function loadPdfFonts(): Promise<PdfFonts> {
  if (!cache) {
    const p = Promise.all([fetchBase64(regularUrl), fetchBase64(boldUrl)]).then(([regular, bold]) => ({ regular, bold }));
    cache = p;
    p.catch(() => {
      if (cache === p) cache = null;
    });
  }
  return cache;
}

export function resetPdfFontCache(): void {
  cache = null;
}
