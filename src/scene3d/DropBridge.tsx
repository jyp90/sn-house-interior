import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import type { Vec2 } from '../model/schema';
import { FLOOR_PLANE } from './units';

export const screenToFloor: { current: ((clientX: number, clientY: number) => Vec2 | null) | null } = { current: null };

export function DropBridge() {
  const { camera, gl, raycaster } = useThree();
  useEffect(() => {
    screenToFloor.current = (clientX, clientY) => {
      const r = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(FLOOR_PLANE, hit)) return null;
      return { x: Math.round(hit.x * 100), y: Math.round(hit.z * 100) };
    };
    return () => {
      screenToFloor.current = null;
    };
  }, [camera, gl, raycaster]);
  return null;
}
