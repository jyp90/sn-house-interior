import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const PANEL = 0.02;
const GAP = 0.004;

// 하부장 매립 가전: 본체는 짙은 회색, 전면 패널(또는 인덕션 윗면 유리)만 변형 색
export function buildBuiltInAppliance(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const kind = (p.builderParams?.panel as 'door' | 'drawer' | 'top' | undefined) ?? 'door';
  const body = box(W, H, kind === 'top' ? D : D - PANEL, color(v.colors, 'body', '#3a3d42'), 0, H / 2, kind === 'top' ? 0 : -PANEL / 2);
  if (kind === 'top') {
    const glass = box(W - 0.01, 0.002, D - 0.01, color(v.colors, 'panel', '#15171a'), 0, H - 0.001, 0);
    glass.name = 'cooktop-glass';
    return group(body, glass);
  }
  const panel = box(W - GAP, H - GAP, PANEL, color(v.colors, 'panel', '#e9e6df'), 0, H / 2, D / 2 - PANEL / 2);
  panel.name = 'front-panel';
  const handleY = kind === 'door' ? Math.max(0.03, H - 0.06) : H / 2;
  const handle = box(W * 0.8, 0.012, PANEL / 2, color(v.colors, 'handle', '#9a9a9a'), 0, handleY, D / 2 - PANEL / 4);
  handle.name = 'handle';
  return group(body, panel, handle);
}
