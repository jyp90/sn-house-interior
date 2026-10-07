import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

export const capture3d: { current: (() => HTMLCanvasElement) | null } = { current: null };

export function CaptureBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    capture3d.current = () => {
      gl.render(scene, camera);
      return gl.domElement;
    };
    return () => {
      capture3d.current = null;
    };
  }, [gl, scene, camera]);
  return null;
}
