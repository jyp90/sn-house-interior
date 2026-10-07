import { cmToM } from '../model/units';

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
type Vec3 = [number, number, number];
export type CameraFit = { position: Vec3; target: Vec3 };

const center = (b: Bounds): Vec3 => [cmToM((b.minX + b.maxX) / 2), 0, cmToM((b.minY + b.maxY) / 2)];

export function fitTop(b: Bounds): CameraFit {
  const t = center(b);
  return { position: [t[0], 30, t[2] + 0.01], target: t };
}

export function fitPerspective(b: Bounds): CameraFit {
  const t = center(b);
  const dist = cmToM(Math.max(b.maxX - b.minX, b.maxY - b.minY)) * 1.3 + 2;
  return { position: [t[0] + dist * 0.35, dist * 0.8, t[2] + dist * 0.75], target: t };
}

export function fitTopZoom(b: Bounds, width: number, height: number, margin = 1.15): number {
  const bw = Math.max(cmToM(b.maxX - b.minX) * margin, 0.01);
  const bh = Math.max(cmToM(b.maxY - b.minY) * margin, 0.01);
  return Math.min(width / bw, height / bh);
}
