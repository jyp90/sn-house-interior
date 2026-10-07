import type { Plan, Vec2 } from '../model/schema';

export function planBounds(plan: Pick<Plan, 'walls'>) {
  if (plan.walls.length === 0) return { minX: 0, minY: 0, maxX: 600, maxY: 400 };
  const pts = plan.walls.flatMap((w) => [w.a, w.b]);
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

export function planCenter(plan: Pick<Plan, 'walls'>): Vec2 {
  const b = planBounds(plan);
  return { x: Math.round((b.minX + b.maxX) / 2), y: Math.round((b.minY + b.maxY) / 2) };
}
