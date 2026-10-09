// 모바일(스펙 §44): 모바일 전용 화면은 일부러 두지 않는다. 폭이 좁은 기기에서는 PC 레이아웃을 그대로 축소해 보여 주고(viewport 폭 고정),
// 캔버스 밖은 브라우저 핀치로, 캔버스 안은 도면 핀치 줌으로 확대한다. 판정은 창 폭이 아니라 기기 화면 폭(`screen.width`)으로 한다
export const SMALL_SCREEN_MAX = 1000;
export const DESKTOP_VIEWPORT_WIDTH = 1200;
export const MOBILE_NOTE = '모바일 전용 화면은 일부러 두지 않았습니다. PC 화면을 그대로 축소해 보여 주니 두 손가락으로 확대해 쓰세요.';

export function isSmallScreen(screenWidth: number): boolean {
  return screenWidth > 0 && screenWidth < SMALL_SCREEN_MAX;
}

export function viewportContent(screenWidth: number): string {
  return isSmallScreen(screenWidth) ? `width=${DESKTOP_VIEWPORT_WIDTH}` : 'width=device-width, initial-scale=1.0';
}

export function applyViewport(doc: Document, screenWidth: number): void {
  doc.querySelector('meta[name="viewport"]')?.setAttribute('content', viewportContent(screenWidth));
}

// 잠금 화면(스펙 §46.1)처럼 기기 폭 그대로 보여야 할 때
export function resetViewport(doc: Document): void {
  doc.querySelector('meta[name="viewport"]')?.setAttribute('content', viewportContent(Infinity));
}
