import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useState, type DragEvent } from 'react';
import { usePlanStore } from '../model/StoreContext';
import { DND_MIME } from '../ui/dnd';
import { useUi } from '../ui/uiStore';
import { CameraRig } from './CameraRig';
import { CaptureBridge } from './CaptureBridge';
import { DropBridge, screenToFloor } from './DropBridge';
import { Floor } from './Floor';
import { Items3D } from './Items3D';
import { Overlays } from './Overlays';
import { Walls3D } from './Walls3D';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Viewport({ active }: { active: boolean }) {
  const store = usePlanStore();
  const view = useUi((s) => s.view);
  const dragging = useUi((s) => s.dragging);
  const [webgl] = useState(hasWebGL);

  if (!webgl) {
    return <div className="viewport viewport-fallback">이 브라우저는 WebGL을 지원하지 않아 3D 보기를 사용할 수 없습니다.</div>;
  }

  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes(DND_MIME)) e.preventDefault();
  };
  const onDrop = (e: DragEvent) => {
    const data = e.dataTransfer.getData(DND_MIME);
    if (!data) return;
    e.preventDefault();
    const [productId, variantId] = data.split('|');
    const p = screenToFloor.current?.(e.clientX, e.clientY);
    if (p) store.getState().addItem(productId, variantId, p);
  };

  return (
    <div className="viewport" onDragOver={onDragOver} onDrop={onDrop}>
      <Canvas
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
        frameloop={active ? 'always' : 'never'}
        onPointerMissed={() => {
          store.getState().select(null);
          useUi.getState().clearCandidates();
        }}
      >
        {view === 'top' ? (
          <OrthographicCamera makeDefault near={0.1} far={200} />
        ) : (
          <PerspectiveCamera makeDefault fov={50} near={0.1} far={500} />
        )}
        <OrbitControls makeDefault enabled={!dragging} enableRotate={view === 'persp'} />
        <CameraRig />
        <color attach="background" args={['#efeae2']} />
        <ambientLight intensity={0.75} color="#fff4e6" />
        <directionalLight position={[5, 10, 5]} intensity={1.0} />
        <Floor />
        <Walls3D />
        <Items3D />
        <Overlays />
        <DropBridge />
        <CaptureBridge />
      </Canvas>
    </div>
  );
}
