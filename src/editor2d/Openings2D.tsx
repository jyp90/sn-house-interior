import { useContext, useRef, type PointerEvent } from 'react';
import { doorSwing } from '../geometry/clearance';
import { corners } from '../geometry/obb';
import { openingAtPoint } from '../geometry/structure';
import { openingObb, wallDir } from '../geometry/walls';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { pointsAttr, sectorPath } from './svg';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';

export function Openings2D() {
  const store = usePlanStore();
  const svgRef = useContext(SvgContext);
  const walls = usePlan((s) => s.plan.walls);
  const openings = usePlan((s) => s.plan.openings);
  const selectedId = usePlan((s) => s.selectedId);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const setDragging = useUi((s) => s.setDragging);
  const dragging = useRef<string | null>(null);
  const interactive = mode === 'structure' && tool === 'select';
  const byId = new Map(walls.map((w) => [w.id, w]));

  const onDown = (e: PointerEvent<SVGGElement>, id: string) => {
    e.stopPropagation();
    store.getState().select(id);
    dragging.current = id;
    e.currentTarget.setPointerCapture(e.pointerId);
    store.getState().beginDrag();
    setDragging(true);
  };
  const onMove = (e: PointerEvent<SVGGElement>) => {
    const id = dragging.current;
    if (!id || !svgRef.current) return;
    const s = store.getState();
    const current = s.plan.openings.find((o) => o.id === id);
    const wall = current && s.plan.walls.find((w) => w.id === current.wallId);
    if (!current || !wall) return;
    const offset = openingAtPoint(wall, clientToPlan(svgRef.current, e.clientX, e.clientY), current.width);
    // 드래그 중 커밋은 드래그 트랜잭션에 흡수돼 실행 취소 한 번으로 돌아간다
    if (offset !== null && offset !== current.offset) s.updateOpening(id, { offset });
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = null;
    store.getState().endDrag();
    setDragging(false);
  };

  return (
    <g className="openings2d">
      {openings.map((o) => {
        const w = byId.get(o.wallId);
        if (!w) return null;
        const u = wallDir(w);
        const a = { x: w.a.x + u.x * o.offset, y: w.a.y + u.y * o.offset };
        const b = { x: a.x + u.x * o.width, y: a.y + u.y * o.width };
        const swing = o.kind === 'door' ? doorSwing(w, o) : null;
        return (
          <g
            key={o.id}
            data-testid={`opening-${o.id}`}
            className={o.id === selectedId ? 'opening opening-selected' : 'opening'}
            onPointerDown={interactive ? (e) => onDown(e, o.id) : undefined}
            onPointerMove={interactive ? onMove : undefined}
            onPointerUp={interactive ? onUp : undefined}
            onPointerCancel={interactive ? onUp : undefined}
          >
            <polygon points={pointsAttr(corners(openingObb(w, o)))} className="opening-gap" />
            {o.kind === 'window' && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="opening-window" />}
            {o.kind === 'opening' && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="opening-open" />}
            {swing?.kind === 'sector' && <path d={sectorPath(swing.center, swing.radius, swing.start, swing.end)} className="opening-swing" />}
          </g>
        );
      })}
    </g>
  );
}
