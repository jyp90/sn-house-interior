import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/products';
import { filterCatalog } from './catalogFilter';

describe('filterCatalog', () => {
  it('빈 문자열이면 전부', () => {
    expect(filterCatalog(CATALOG, '  ')).toHaveLength(CATALOG.length);
  });
  it('이름·모델명 부분 일치, 대소문자 무시', () => {
    expect(filterCatalog(CATALOG, '에어컨').map((p) => p.id)).toEqual(['samsung-stand-ac-sample', 'samsung-wall-ac-sample', 'samsung-ceiling-ac-sample']);
    expect(filterCatalog(CATALOG, 'tv').length).toBeGreaterThan(0);
    expect(filterCatalog(CATALOG, '없는제품')).toEqual([]);
  });
  it('분류명(욕실·가구 등)으로도 찾는다', () => {
    expect(filterCatalog(CATALOG, '욕실').map((p) => p.id)).toEqual(['toilet-std', 'basin-std', 'shower-90', 'bathtub-150']);
    expect(filterCatalog(CATALOG, '세탁·건조').every((p) => p.category === 'laundry')).toBe(true);
    expect(filterCatalog(CATALOG, '세탁·건조').length).toBeGreaterThan(0);
  });
});
