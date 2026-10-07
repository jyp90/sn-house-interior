import type { Vec2 } from '../model/schema';

export function clientToPlan(svg: SVGSVGElement, clientX: number, clientY: number): Vec2 {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}
