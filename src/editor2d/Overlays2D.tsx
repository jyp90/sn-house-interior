import { useMemo } from 'react';
import { findProduct } from '../catalog/products';
import { itemClearances } from '../geometry/clearance';
import { wallDistances } from '../geometry/distance';
import { itemObb } from '../geometry/obb';
import { planWallObbs } from '../geometry/walls';
import { activeItems } from '../model/layout';
import { usePlan } from '../model/StoreContext';
import { useValidation } from '../model/useValidation';
import { shapePath } from './svg';

export function Overlays2D({ px }: { px: number }) {
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const status = useValidation();
  const wallObbs = useMemo(() => planWallObbs(plan), [plan]);
  const placed = activeItems(plan).flatMap((item) => {
    const product = findProduct(plan, item.productId);
    return product ? [{ item, product }] : [];
  });
  const selected = placed.find((p) => p.item.id === selectedId);
  const rays = selected
    ? wallDistances(itemObb(selected.item.x, selected.item.y, selected.item.rotation, selected.product.dims.w, selected.product.dims.d), wallObbs)
    : [];

  return (
    <g className="overlays2d" pointerEvents="none">
      {placed.flatMap(({ item, product }) =>
        itemClearances(item, product).map((shape, i) => (
          <path key={`${item.id}-${i}`} d={shapePath(shape)} className={status[item.id]?.clearanceBlocked ? 'clearance clearance-blocked' : 'clearance'} />
        )),
      )}
      {rays.map((r) => (
        <g key={r.dir}>
          <line x1={r.from.x} y1={r.from.y} x2={r.to.x} y2={r.to.y} className="dist-line" />
          <text x={(r.from.x + r.to.x) / 2} y={(r.from.y + r.to.y) / 2} fontSize={10 * px} className="dist-text" textAnchor="middle" dominantBaseline="middle">
            {r.distance}cm
          </text>
        </g>
      ))}
    </g>
  );
}
