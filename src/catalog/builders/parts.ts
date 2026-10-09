import * as THREE from 'three';
import { cmToM } from '../../model/units';

const materials = new Map<string, THREE.MeshStandardMaterial>();

export function material(color: string): THREE.MeshStandardMaterial {
  let m = materials.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
    materials.set(color, m);
  }
  return m;
}

// 크기(w,h,d)와 중심(x,y,z) 모두 m
export function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.position.set(x, y, z);
  return mesh;
}

// 전면(+z)을 바라보는 원판
export function disc(r: number, thickness: number, color: string, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thickness, 32), material(color));
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.add(...children);
  return g;
}

export function color(colors: Record<string, string>, key: string, fallback: string): string {
  return colors[key] ?? fallback;
}

export function meters(dims: { w: number; d: number; h: number }) {
  return { W: cmToM(dims.w), D: cmToM(dims.d), H: cmToM(dims.h) };
}

// 세로(y축) 원기둥, 중심 (x,y,z)
export function cylinder(r: number, h: number, c: string, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), material(c));
  mesh.position.set(x, y, z);
  return mesh;
}

// 반투명 유리(공유 재질, 해제하지 않음)
const glassMaterial = new THREE.MeshStandardMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0 });
export function glass(w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMaterial);
  mesh.position.set(x, y, z);
  mesh.name = 'glass';
  return mesh;
}
