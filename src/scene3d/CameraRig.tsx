import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { planBounds } from '../geometry/bounds';
import { usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { fitPerspective, fitTop, fitTopZoom } from './cameraFit';

type OrbitLike = { target: THREE.Vector3; update(): void };

const isOrbit = (c: unknown): c is OrbitLike => typeof c === 'object' && c !== null && 'target' in c && 'update' in c;

export function CameraRig() {
  const store = usePlanStore();
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const view = useUi((s) => s.view);
  const resetKey = useUi((s) => s.viewResetKey);

  useEffect(() => {
    const b = planBounds({ walls: store.getState().plan.walls });
    const fit = view === 'top' ? fitTop(b) : fitPerspective(b);
    camera.position.set(...fit.position);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = fitTopZoom(b, width, height);
      camera.updateProjectionMatrix();
    }
    camera.lookAt(...fit.target);
    if (isOrbit(controls)) {
      controls.target.set(...fit.target);
      controls.update();
    }
    // 창 크기(width, height)는 일부러 의존성에서 뺀다: 크기가 바뀔 때마다 사용자가 옮긴 시점을 덮어쓰지 않도록
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, camera, controls, view, resetKey]);

  return null;
}
