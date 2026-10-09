import type { Product, Variant } from '../../model/schema';
import { box, color, cylinder, group, meters } from './parts';

const BOWL_H = 0.15;
const TAP_H = 0.02;

// 세면볼 + 받침(기둥 또는 하부장) + 수전
export function buildBasin(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const c = color(v.colors, 'body', '#f7f7f5');
  const supportH = H - BOWL_H - TAP_H;
  const support = p.builderParams?.cabinet === true
    ? box(W - 0.02, supportH, D - 0.05, color(v.colors, 'cabinet', '#d9d3ca'), 0, supportH / 2, -0.025)
    : cylinder(Math.min(W, D) * 0.12, supportH, c, 0, supportH / 2, -D * 0.1);
  const bowl = box(W, BOWL_H, D, c, 0, supportH + BOWL_H / 2, 0);
  const tap = cylinder(0.012, TAP_H, color(v.colors, 'tap', '#b9bcc0'), 0, H - TAP_H / 2, -D / 2 + 0.04);
  tap.name = 'tap';
  return group(support, bowl, tap);
}
