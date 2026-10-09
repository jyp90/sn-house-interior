import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const PANEL = 0.018;
const GAP = 0.003;

// 옷장·붙박이장·신발장: 몸통 + 문짝(doors) + 손잡이(문짝마다, 이웃 문과 마주 보게)
export function buildWardrobe(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const doors = Math.max(1, Math.round(Number(p.builderParams?.doors ?? 2)));
  const handleC = color(v.colors, 'handle', '#8a8a8a');
  const dw = W / doors;
  const parts = [box(W, H, D - PANEL, color(v.colors, 'body', '#d9d3ca'), 0, H / 2, -PANEL / 2)];
  for (let i = 0; i < doors; i++) {
    const x = -W / 2 + dw * (i + 0.5);
    const door = box(dw - GAP, H - GAP, PANEL, color(v.colors, 'door', '#efe9df'), x, H / 2, D / 2 - PANEL / 2);
    door.name = 'door';
    const hx = x + (i % 2 === 0 ? dw / 2 - 0.04 : -dw / 2 + 0.04);
    const handle = box(0.012, Math.min(0.3, H * 0.2), PANEL / 2, handleC, hx, H / 2, D / 2 - PANEL / 4);
    handle.name = 'handle';
    parts.push(door, handle);
  }
  return group(...parts);
}
