import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64, loadPdfFonts, PdfFontError, resetPdfFontCache } from './pdfFont';

afterEach(() => {
  vi.unstubAllGlobals();
  resetPdfFontCache();
});

describe('pdfFont', () => {
  it('bytesToBase64는 큰 배열도 Buffer와 같은 결과', () => {
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe('aGk=');
    const big = new Uint8Array(100_000).map((_, i) => i % 251);
    expect(bytesToBase64(big)).toBe(Buffer.from(big).toString('base64'));
  });

  it('두 글꼴을 base64로 받아 한 번만 내려받는다', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetchMock);
    const a = await loadPdfFonts();
    const b = await loadPdfFonts();
    expect(a).toEqual({ regular: 'AQID', bold: 'AQID' });
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/Pretendard-Regular\.ttf/);
  });

  it('네트워크 실패는 PdfFontError이고, 다음 호출은 다시 내려받는다', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockImplementation(async () => new Response(new Uint8Array([1])));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadPdfFonts()).rejects.toBeInstanceOf(PdfFontError);
    await expect(loadPdfFonts()).resolves.toEqual({ regular: 'AQ==', bold: 'AQ==' });
  });

  it('HTTP 오류도 PdfFontError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404 })));
    await expect(loadPdfFonts()).rejects.toBeInstanceOf(PdfFontError);
  });
});
