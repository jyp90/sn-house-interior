import { Html, Line } from '@react-three/drei';
import { useMemo } from 'react';
import { findProduct } from '../catalog/products';
import { doorSwings, itemClearances, type ClearanceShape } from '../geometry/clearance';
import { wallDistances } from '../geometry/distance';
import { corners, itemObb, type OBB } from '../geometry/obb';
import { planWallObbs } from '../geometry/walls';
import { activeItems } from '../model/layout';
import { usePlan } from '../model/StoreContext';
import { useValidation } from '../model/useValidation';
import { cmToM } from '../model/units';
import { sectorToCircleArgs, toWorld } from './units';

const Y = 0.004;
const OUTLINE_Y = 0.02;

function outline(o: OBB): [number, number, number][] {
  const c = corners(o);
  return [...c, c[0]].map((p) => [cmToM(p.x), OUTLINE_Y, cmToM(p.y)]);
}

function Shape({ shape, color }: { shape: ClearanceShape; color: string }) {
  if (shape.kind === 'rect') {
    const o = shape.obb;
    return (
      <mesh position={[cmToM(o.cx), Y, cmToM(o.cy)]} rotation={[-Math.PI / 2, 0, -o.angle]}>
        <planeGeometry args={[cmToM(o.hw * 2), cmToM(o.hd * 2)]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} />
      </mesh>
    );
  }
  const { thetaStart, thetaLength } = sectorToCircleArgs(shape.start, shape.end);
  return (
    <mesh position={[cmToM(shape.center.x), Y, cmToM(shape.center.y)]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[cmToM(shape.radius), 24, thetaStart, thetaLength]} />
      <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} />
    </mesh>
  );
}

export function Overlays() {
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const status = useValidation();
  const wallObbs = useMemo(() => planWallObbs(plan), [plan]);
  const doors = useMemo(() => doorSwings(plan), [plan]);

  const placed = activeItems(plan).flatMap((item) => {
    const product = findProduct(plan, item.productId);
    return product ? [{ item, product, fp: itemObb(item.x, item.y, item.rotation, product.dims.w, product.dims.d) }] : [];
  });
  const selected = placed.find((p) => p.item.id === selectedId);
  const rays = selected ? wallDistances(selected.fp, wallObbs) : [];

  return (
    <group>
      {doors.map((s, i) => (
        <Shape key={`door-${i}`} shape={s} color="#8b8b8b" />
      ))}
      {placed.map(({ item, product, fp }) => {
        const st = status[item.id];
        const color = st?.collides || st?.blocksDoor ? '#e5484d' : st?.clearanceBlocked ? '#f5a524' : item.id === selectedId ? '#3b82f6' : null;
        return (
          <group key={item.id}>
            {itemClearances(item, product).map((s, i) => (
              <Shape key={i} shape={s} color={st?.clearanceBlocked ? '#f5a524' : '#4f9dde'} />
            ))}
            {color && <Line points={outline(fp)} color={color} lineWidth={2} depthTest={false} renderOrder={10} />}
          </group>
        );
      })}
      {rays.map((r) => (
        <group key={r.dir}>
          <Line points={[toWorld(r.from, 1), toWorld(r.to, 1)]} color="#3b82f6" lineWidth={1.5} dashed dashSize={0.05} gapSize={0.03} />
          <Html position={toWorld({ x: (r.from.x + r.to.x) / 2, y: (r.from.y + r.to.y) / 2 }, 2)} center className="dist-label">
            {r.distance}cm
          </Html>
        </group>
      ))}
    </group>
  );
}
