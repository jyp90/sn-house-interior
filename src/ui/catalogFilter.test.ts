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
});
