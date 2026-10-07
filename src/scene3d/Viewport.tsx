import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo, useState, type DragEvent } from 'react';
import { planCenter } from '../geometry/bounds';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { cmToM } from '../model/units';
import { DND_MIME } from '../ui/dnd';
import { useUi } from '../ui/uiStore';
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

export function Viewport() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const view = useUi((s) => s.view);
  const dragging = useUi((s) => s.dragging);
  const [webgl] = useState(hasWebGL);
  // 벽이 바뀔 때만 카메라 기준점을 다시 계산한다(아이템 이동 때 카메라가 리셋되지 않도록)
  const c = useMemo(() => planCenter({ walls }), [walls]);
  const cx = cmToM(c.x);
  const cz = cmToM(c.y);

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
      <Canvas dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }} onPointerMissed={() => store.getState().select(null)}>
        {view === 'top' ? (
          <OrthographicCamera makeDefault position={[cx, 30, cz + 0.01]} zoom={60} near={0.1} far={100} />
        ) : (
          <PerspectiveCamera makeDefault position={[cx + 4, 7, cz + 9]} fov={50} />
        )}
        <OrbitControls makeDefault target={[cx, 0, cz]} enabled={!dragging} enableRotate={view === 'persp'} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 5]} intensity={1.1} />
        <Floor />
        <Walls3D />
        <Items3D />
        <Overlays />
        <DropBridge />
      </Canvas>
    </div>
  );
}
