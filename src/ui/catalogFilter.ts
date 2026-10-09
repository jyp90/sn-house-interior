import { CATEGORY_LABEL } from '../catalog/products';
import type { Product } from '../model/schema';

// 이름·모델명·분류명 부분 일치, 대소문자 무시
export function filterCatalog(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter(
    (p) => p.name.toLowerCase().includes(q) || p.model.toLowerCase().includes(q) || CATEGORY_LABEL[p.category].toLowerCase().includes(q),
  );
}
