import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const PANEL = 0.01;
const VENT = 0.03;

// 천장 매립형: 납작한 본체 + 아랫면 패널 + 토출구 4면(아랫면 가장자리)
export function buildCeilingAc(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const body = box(W, H - PANEL, D, color(v.colors, 'body', '#f4f4f4'), 0, PANEL + (H - PANEL) / 2, 0);
  const panel = box(W, PANEL, D, color(v.colors, 'panel', '#ffffff'), 0, PANEL / 2, 0);
  const ventC = color(v.colors, 'vent', '#6b7075');
  const vents = [
    box(W * 0.7, 0.002, VENT, ventC, 0, 0.001, D / 2 - VENT),
    box(W * 0.7, 0.002, VENT, ventC, 0, 0.001, -D / 2 + VENT),
    box(VENT, 0.002, D * 0.7, ventC, W / 2 - VENT, 0.001, 0),
    box(VENT, 0.002, D * 0.7, ventC, -W / 2 + VENT, 0.001, 0),
  ];
  for (const m of vents) m.name = 'vent';
  return group(body, panel, ...vents);
}
