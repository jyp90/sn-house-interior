import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const COUNTER = 0.04;
const PANEL = 0.018;
const GAP = 0.003;

// 주방 하부장(상판 포함)·상부장·TV장. 문짝 수는 doors, 상판은 base일 때 counter(기본 true)
export function buildCabinetRun(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const part = (p.builderParams?.part as 'base' | 'upper' | undefined) ?? 'base';
  const doors = Math.max(1, Math.round(Number(p.builderParams?.doors ?? 2)));
  const counter = part === 'base' && p.builderParams?.counter !== false;
  const sink = counter && p.builderParams?.sink === true;
  const bodyH = counter ? H - COUNTER : H;
  const parts = [box(W, bodyH, D - PANEL, color(v.colors, 'body', '#d9d3ca'), 0, bodyH / 2, -PANEL / 2)];
  const dw = W / doors;
  for (let i = 0; i < doors; i++) {
    const door = box(dw - GAP, bodyH - GAP, PANEL, color(v.colors, 'door', '#efe9df'), -W / 2 + dw * (i + 0.5), bodyH / 2, D / 2 - PANEL / 2);
    door.name = 'door';
    parts.push(door);
  }
  if (counter) {
    const top = box(W, COUNTER, D, color(v.colors, 'counter', '#bdb6ad'), 0, H - COUNTER / 2, 0);
    top.name = 'counter';
    parts.push(top);
  }
  if (sink) {
    const bowl = box(Math.min(0.8, W * 0.4), 0.002, D * 0.6, color(v.colors, 'sink', '#aeb4ba'), 0, H - 0.001, 0);
    bowl.name = 'sink';
    parts.push(bowl);
  }
  return group(...parts);
}
