import type { Product } from '../model/schema';

export function filterCatalog(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) => p.name.toLowerCase().includes(q) || p.model.toLowerCase().includes(q));
}
