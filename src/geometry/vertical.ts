export type Span = { lo: number; hi: number };

// 경계가 닿기만 하면 겹침이 아니다(세탁기 위 건조기)
export function spansOverlap(a: Span, b: Span): boolean {
  return a.lo < b.hi && b.lo < a.hi;
}

export function itemSpan(elevation: number, h: number): Span {
  return { lo: elevation, hi: elevation + h };
}
