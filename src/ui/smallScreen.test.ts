// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyViewport, isSmallScreen, resetViewport, viewportContent } from './smallScreen';

describe('smallScreen', () => {
  it('기기 화면 폭 1000px 미만이면 작은 화면이다', () => {
    expect(isSmallScreen(390)).toBe(true);
    expect(isSmallScreen(999)).toBe(true);
    expect(isSmallScreen(1000)).toBe(false);
    expect(isSmallScreen(0)).toBe(false);
  });

  it('작은 화면은 viewport 폭을 1200으로 고정하고, 아니면 기기 폭을 쓴다', () => {
    expect(viewportContent(390)).toBe('width=1200');
    expect(viewportContent(1440)).toBe('width=device-width, initial-scale=1.0');
  });

  it('applyViewport는 meta viewport의 content를 바꾼다', () => {
    const doc = document.implementation.createHTMLDocument();
    const meta = doc.createElement('meta');
    meta.setAttribute('name', 'viewport');
    doc.head.appendChild(meta);
    applyViewport(doc, 390);
    expect(meta.getAttribute('content')).toBe('width=1200');
    resetViewport(doc);
    expect(meta.getAttribute('content')).toBe('width=device-width, initial-scale=1.0');
  });
});
