import { useContext, useRef, type PointerEvent } from 'react';
import { findProduct } from '../catalog/products';
import { corners, itemObb } from '../geometry/obb';
import { itemsAtPoint } from '../geometry/pick';
import { snapToWalls } from '../geometry/snap';
import { planWallObbs } from '../geometry/walls';
import { activeItems } from '../model/layout';
import type { Item } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useValidation } from '../model/useValidation';
import { useUi } from '../ui/uiStore';
import { itemColor, MISSING_COLOR } from './itemColor';
import { pointsAttr } from './svg';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';

const CLICK_SLOP_PX = 3;

type Drag = { id: string; dx: number; dy: number; startX: number; startY: number; moved: boolean; locked: boolean };

export function Items2D({ px }: { px: number }) {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const status = useValidation();
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const setDragging = useUi((s) => s.setDragging);
  const svgRef = useContext(SvgContext);
  const drag = useRef<Drag | null>(null);
  const interactive = mode === 'place' && tool === 'select';
  const toPlan = (e: { clientX: number; clientY: number }) => clientToPlan(svgRef.current!, e.clientX, e.clientY);

  const onDown = (e: PointerEvent<SVGPolygonElement>, item: Item) => {
    e.stopPropagation();
    const s = store.getState();
    s.select(item.id);
    useUi.getState().clearCandidates();
    const p = toPlan(e);
    drag.current = { id: item.id, dx: item.x - p.x, dy: item.y - p.y, startX: e.clientX, startY: e.clientY, moved: false, locked: !!item.locked };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!item.locked) {
      s.beginDrag();
      setDragging(true);
    }
  };

  const onMove = (e: PointerEvent<SVGPolygonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > CLICK_SLOP_PX) d.moved = true;
    if (!d.moved || d.locked) return;
    const s = store.getState();
    const item = activeItems(s.plan).find((i) => i.id === d.id);
    if (!item) return;
    const dims = findProduct(s.plan, item.productId)?.dims ?? { w: 50, d: 50 };
    const p = toPlan(e);
    const x = p.x + d.dx;
    const y = p.y + d.dy;
    const target = useUi.getState().snap ? snapToWalls(itemObb(x, y, item.rotation, dims.w, dims.d), planWallObbs(s.plan)) : { cx: x, cy: y };
    s.dragItem(d.id, target.cx, target.cy);
  };

  const finish = () => {
    const d = drag.current;
    if (!d) return null;
    drag.current = null;
    if (!d.locked) {
      store.getState().endDrag();
      setDragging(false);
    }
    return d;
  };

  const onUp = (e: PointerEvent<SVGPolygonElement>) => {
    const d = finish();
    if (!d || d.moved) return;
    const s = store.getState();
    const ids = itemsAtPoint(s.plan, toPlan(e), (id) => findProduct(s.plan, id));
    if (ids.length > 1) useUi.getState().showCandidates({ ids, clientX: e.clientX, clientY: e.clientY });
  };

  return (
    <g className="items2d">
      {activeItems(plan).map((item) => {
        const product = findProduct(plan, item.productId);
        const dims = product?.dims ?? { w: 50, d: 50 };
        const st = status[item.id];
        const cls = [
          'item2d',
          item.id === selectedId ? 'item2d-selected' : '',
          st?.clearanceBlocked ? 'item2d-warn' : '',
          st?.collides || st?.blocksDoor ? 'item2d-danger' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <g key={item.id}>
            <polygon
              points={pointsAttr(corners(itemObb(item.x, item.y, item.rotation, dims.w, dims.d)))}
              fill={product ? itemColor(product, item.variantId) : MISSING_COLOR}
              className={cls}
              data-testid={`item2d-${item.id}`}
              onPointerDown={interactive ? (e) => onDown(e, item) : undefined}
              onPointerMove={interactive ? onMove : undefined}
              onPointerUp={interactive ? onUp : undefined}
              onPointerCancel={interactive ? finish : undefined}
            />
            <text x={item.x} y={item.y} fontSize={10 * px} textAnchor="middle" dominantBaseline="middle" className="item2d-label">
              {product?.name ?? '알 수 없는 제품'}
              {item.locked ? ' (잠금)' : ''}
            </text>
          </g>
        );
      })}
    </g>
  );
}
