import { useMemo } from 'react';
import { findProduct } from '../catalog/products';
import { itemClearances } from '../geometry/clearance';
import { wallDistances } from '../geometry/distance';
import { corners, itemObb } from '../geometry/obb';
import { planWallObbs } from '../geometry/walls';
import { activeItems, compareItems } from '../model/layout';
import { usePlan } from '../model/StoreContext';
import { useValidation } from '../model/useValidation';
import { useUi } from '../ui/uiStore';
import { pointsAttr, shapePath } from './svg';

export function Overlays2D({ px }: { px: number }) {
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const status = useValidation();
  const compareId = useUi((s) => s.compareLayoutId);
  const ghosts = compareItems(plan, compareId);
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
      {ghosts.length > 0 && (
        <g className="compare-ghosts" data-testid="compare-ghosts">
          {ghosts.map((item) => {
            const dims = findProduct(plan, item.productId)?.dims ?? { w: 50, d: 50 };
            return (
              <polygon
                key={item.id}
                points={pointsAttr(corners(itemObb(item.x, item.y, item.rotation, dims.w, dims.d)))}
                className="compare-ghost"
              />
            );
          })}
        </g>
      )}
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
