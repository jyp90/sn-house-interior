import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildProduct, disposeObject, mountHeightCm } from '../catalog/builders';
import { findProduct } from '../catalog/products';
import { deg2rad, itemObb } from '../geometry/obb';
import { snapToWalls } from '../geometry/snap';
import { planWallObbs } from '../geometry/walls';
import type { Item, Product } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { FLOOR_PLANE } from './units';

const MISSING = '#9aa0a6';

function ItemMesh({ item, product }: { item: Item; product: Product | undefined }) {
  const store = usePlanStore();
  const setDragging = useUi((s) => s.setDragging);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const object = useMemo(() => (product ? buildProduct(product, item.variantId) : null), [product, item.variantId]);
  useEffect(() => () => {
    if (object) disposeObject(object);
  }, [object]);

  const floorPoint = (e: ThreeEvent<PointerEvent>) => {
    const p = new THREE.Vector3();
    return e.ray.intersectPlane(FLOOR_PLANE, p) ? { x: p.x * 100, y: p.z * 100 } : null;
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    store.getState().select(item.id);
    const p = floorPoint(e);
    if (!p) return;
    grab.current = { dx: item.x - p.x, dy: item.y - p.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    store.getState().beginDrag();
    setDragging(true);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current) return;
    e.stopPropagation();
    const p = floorPoint(e);
    if (!p) return;
    const dims = product?.dims ?? { w: 50, d: 50 };
    const fp = itemObb(p.x + grab.current.dx, p.y + grab.current.dy, item.rotation, dims.w, dims.d);
    const snapped = snapToWalls(fp, planWallObbs(store.getState().plan));
    store.getState().dragItem(item.id, snapped.cx, snapped.cy);
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current) return;
    grab.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    store.getState().endDrag();
    setDragging(false);
  };

  const y = product ? mountHeightCm(product) / 100 : 0;
  return (
    <group
      position={[item.x / 100, y, item.y / 100]}
      rotation={[0, -deg2rad(item.rotation), 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
      {plan.items.map((item) => (
        <ItemMesh key={item.id} item={item} product={findProduct(plan, item.productId)} />
      ))}
    </group>
  );
}
