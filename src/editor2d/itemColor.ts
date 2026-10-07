import type { Product } from '../model/schema';

export const MISSING_COLOR = '#9aa0a6';

const KEYS = ['panel', 'body', 'fabric', 'frame', 'wood'] as const;

export function itemColor(product: Product, variantId: string): string {
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  for (const key of KEYS) {
    const c = variant.colors[key];
    if (c) return c;
  }
  return '#c8b8a0';
}
