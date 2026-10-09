import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildProduct, disposeObject } from '../catalog/builders';
import { ceilingHeightCm, itemElevationCm } from '../catalog/elevation';
import { findProduct } from '../catalog/products';
import { deg2rad, itemObb } from '../geometry/obb';
import { snapToWalls } from '../geometry/snap';
import { planWallObbs } from '../geometry/walls';
import { activeItems } from '../model/layout';
import type { Item, Product } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { cmToM, mToCm } from '../model/units';
import { useUi } from '../ui/uiStore';
import { itemIdsFromIntersections } from './pick3d';
import { FLOOR_PLANE } from './units';

const MISSING = '#9aa0a6';
const CLICK_SLOP_PX = 3;

type Grab = { dx: number; dy: number; startX: number; startY: number; moved: boolean; locked: boolean };

function ItemMesh({ item, product }: { item: Item; product: Product | undefined }) {
  const store = usePlanStore();
  const setDragging = useUi((s) => s.setDragging);
  const grab = useRef<Grab | null>(null);
  const object = useMemo(() => (product ? buildProduct(product, item.variantId) : null), [product, item.variantId]);
  useEffect(() => () => {
    if (object) disposeObject(object);
  }, [object]);

  const ceiling = usePlan((s) => ceilingHeightCm(s.plan));
  const elevation = product ? itemElevationCm(item, product, ceiling) : 0;
  // 드래그 레이가 아이템이 놓인 높이의 수평면과 만나야 커서를 따라간다(바닥(0)은 그대로 FLOOR_PLANE)
  const dragPlane = useMemo(
    () => (elevation === 0 ? FLOOR_PLANE : new THREE.Plane(new THREE.Vector3(0, 1, 0), -cmToM(elevation))),
    [elevation],
  );

  const floorPoint = (e: ThreeEvent<PointerEvent>) => {
    const p = new THREE.Vector3();
    return e.ray.intersectPlane(dragPlane, p) ? { x: mToCm(p.x), y: mToCm(p.z) } : null;
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    store.getState().select(item.id);
    useUi.getState().clearCandidates();
    const p = floorPoint(e);
    if (!p) return;
    grab.current = {
      dx: item.x - p.x,
      dy: item.y - p.y,
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
      moved: false,
      locked: !!item.locked,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (!item.locked) {
      store.getState().beginDrag();
      setDragging(true);
    }
  };

  const finishDrag = () => {
    const g = grab.current;
    if (!g) return false;
    grab.current = null;
    if (!g.locked) {
      store.getState().endDrag();
      setDragging(false);
    }
    return true;
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const g = grab.current;
    if (!g) return;
    if (!g.locked && store.getState().dragOrigin === null) {
      finishDrag();
      return;
    }
    e.stopPropagation();
    if (!g.moved && Math.hypot(e.nativeEvent.clientX - g.startX, e.nativeEvent.clientY - g.startY) > CLICK_SLOP_PX) g.moved = true;
    if (!g.moved || g.locked) return;
    const p = floorPoint(e);
    if (!p) return;
    const dims = product?.dims ?? { w: 50, d: 50 };
    const x = p.x + g.dx;
    const y = p.y + g.dy;
    const target = useUi.getState().snap
      ? snapToWalls(itemObb(x, y, item.rotation, dims.w, dims.d), planWallObbs(store.getState().plan))
      : { cx: x, cy: y };
    store.getState().dragItem(item.id, target.cx, target.cy);
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const wasClick = grab.current !== null && !grab.current.moved;
    if (finishDrag()) (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (!wasClick) return;
    const ids = itemIdsFromIntersections(e.intersections);
    if (ids.length > 1) useUi.getState().showCandidates({ ids, clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY });
  };

  useEffect(() => () => {
    finishDrag();
  }, []);

  const y = cmToM(elevation);
  return (
    <group
      position={[cmToM(item.x), y, cmToM(item.y)]}
      rotation={[0, -deg2rad(item.rotation), 0]}
      userData={{ itemId: item.id }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={finishDrag}
      onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()}
    >
      {object ? (
        <primitive object={object} />
      ) : (
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color={MISSING} />
        </mesh>
      )}
    </group>
  );
}

export function Items3D() {
  const plan = usePlan((s) => s.plan);
  return (
    <group>
      {activeItems(plan).map((item) => (
        <ItemMesh key={item.id} item={item} product={findProduct(plan, item.productId)} />
      ))}
    </group>
  );
}
