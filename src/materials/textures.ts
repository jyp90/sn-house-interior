import * as THREE from 'three';
import type { FloorFinish, WallFinish } from '../model/schema';
import { patternSpec, shade, wallPatternSpec, type PatternSpec } from './pattern';

export type FinishTexture = { texture: THREE.Texture; sizeCm: { w: number; h: number } };

const cache = new Map<string, THREE.Texture>();
const PX_PER_CM = 4;

function drawSpec(spec: PatternSpec, color: string, groutShade: number): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(spec.w * PX_PER_CM);
  canvas.height = Math.round(spec.h * PX_PER_CM);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = shade(color, groutShade);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const s of spec.shapes) {
    ctx.fillStyle = shade(color, s.shade);
    ctx.fillRect(s.x * PX_PER_CM, s.y * PX_PER_CM, s.w * PX_PER_CM, s.h * PX_PER_CM);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

// 캐시된 원본은 공유되므로 메시마다 clone()해서 repeat를 정하고, 그 복제본만 dispose한다
export function floorTexture(finish: FloorFinish): FinishTexture | null {
  const spec = patternSpec(finish);
  if (!spec) return null;
  const grout = finish.material === 'tile' ? -0.25 : -0.35;
  return { texture: cached(`floor:${finish.material}:${finish.color}`, () => drawSpec(spec, finish.color, grout)), sizeCm: { w: spec.w, h: spec.h } };
}

export function wallTexture(finish: WallFinish): FinishTexture | null {
  const spec = wallPatternSpec(finish);
  if (!spec) return null;
  return { texture: cached(`wall:${finish.material}:${finish.color}`, () => drawSpec(spec, finish.color, 0)), sizeCm: { w: spec.w, h: spec.h } };
}
