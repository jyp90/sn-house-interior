import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import type { CameraFit } from './cameraFit';

export const capture3d: { current: (() => HTMLCanvasElement) | null } = { current: null };
export const captureViews: { current: ((fits: CameraFit[], width: number, height: number) => string[]) | null } = { current: null };

export function CaptureBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    capture3d.current = () => {
      gl.render(scene, camera);
      return gl.domElement;
    };
    // 화면 카메라·크기와 무관하게 지정 시점·고정 크기로 그린다(3D 보기가 숨겨져 있어도 동작). 끝나면 원래 크기로 되돌린다
    captureViews.current = (fits, width, height) => {
      const size = gl.getSize(new THREE.Vector2());
      const ratio = gl.getPixelRatio();
      const cam = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);
      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const ctx = out.getContext('2d');
      if (!ctx) return [];
      try {
        gl.setPixelRatio(1);
        gl.setSize(width, height, false);
        return fits.map((fit) => {
          cam.position.set(...fit.position);
          cam.lookAt(...fit.target);
          cam.updateProjectionMatrix();
          gl.render(scene, cam);
          // 투명 배경이 JPEG에서 검게 나오지 않게 흰 바탕 위에 옮긴다
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(gl.domElement, 0, 0, width, height);
          return out.toDataURL('image/jpeg', 0.9);
        });
      } finally {
        gl.setPixelRatio(ratio);
        gl.setSize(size.x, size.y, false);
      }
    };
    return () => {
      capture3d.current = null;
      captureViews.current = null;
    };
  }, [gl, scene, camera]);
  return null;
}
