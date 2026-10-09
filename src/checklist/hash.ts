// FNV-1a 32비트 → base36. 자동 체크리스트 id에 문구 지문을 붙이는 용도(암호용 아님)
export function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
