import * as THREE from 'three';
import type { Vec2 } from '../model/schema';

export const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function toWorld(p: Vec2, yCm = 0): [number, number, number] {
  return [p.x / 100, yCm / 100, p.y / 100];
}

// circleGeometry를 rotation.x = -π/2로 눕히면 로컬 각도 θ는 2D 각도 -θ에 대응한다
export function sectorToCircleArgs(start: number, end: number) {
  return { thetaStart: -end, thetaLength: end - start };
}
