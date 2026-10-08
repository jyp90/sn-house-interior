import { useContext, useRef, type PointerEvent } from 'react';
import { doorLeaves } from '../geometry/clearance';
import { corners } from '../geometry/obb';
import { fitOpening } from '../geometry/structure';
import { openingObb, wallDir } from '../geometry/walls';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { pointsAttr, sectorPath } from './svg';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';

const CLICK_SLOP_PX = 3;

type Drag = { id: string; grab: number; startX: number; startY: number; moved: boolean };

export function Openings2D({ px }: { px: number }) {
  const store = usePlanStore();
  const svgRef = useContext(SvgContext);
  const walls = usePlan((s) => s.plan.walls);
  const openings = usePlan((s) => s.plan.openings);
  const selectedId = usePlan((s) => s.selectedId);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const setDragging = useUi((s) => s.setDragging);
  const drag = useRef<Drag | null>(null);
  const interactive = mode === 'structure' && tool === 'select';
  const byId = new Map(walls.map((w) => [w.id, w]));

  const projectT = (wallId: string, e: { clientX: number; clientY: number }): number | null => {
    const wall = byId.get(wallId);
    if (!wall || !svgRef.current) return null;
    const p = clientToPlan(svgRef.current, e.clientX, e.clientY);
    const u = wallDir(wall);
    return (p.x - wall.a.x) * u.x + (p.y - wall.a.y) * u.y;
  };

  const onDown = (e: PointerEvent<SVGGElement>, id: string) => {
    e.stopPropagation();
    const s = store.getState();
    s.select(id);
    const current = s.plan.openings.find((o) => o.id === id);
    const t0 = current ? projectT(current.wallId, e) : null;
    if (!current || t0 === null) return;
    drag.current = { id, grab: t0 - current.offset, startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    s.beginDrag();
    setDragging(true);
  };
  const onMove = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (store.getState().dragOrigin === null) {
      finish();
      return;
    }
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > CLICK_SLOP_PX) d.moved = true;
    if (!d.moved) return;
    const s = store.getState();
    const current = s.plan.openings.find((o) => o.id === d.id);
    const wall = current && byId.get(current.wallId);
    if (!current || !wall) return;
    const t = projectT(current.wallId, e);
    if (t === null) return;
    const offset = fitOpening(wall, t - d.grab, current.width);
    // 드래그 중 커밋은 드래그 트랜잭션에 흡수돼 실행 취소 한 번으로 돌아간다
    if (offset !== null && offset !== current.offset) s.updateOpening(d.id, { offset });
  };
  const finish = () => {
    if (!drag.current) return;
    drag.current = null;
    store.getState().endDrag();
    setDragging(false);
  };
  const onUp = () => finish();

  return (
    <g className="openings2d">
      {openings.map((o) => {
        const w = byId.get(o.wallId);
        if (!w) return null;
        const u = wallDir(w);
        const a = { x: w.a.x + u.x * o.offset, y: w.a.y + u.y * o.offset };
        const b = { x: a.x + u.x * o.width, y: a.y + u.y * o.width };
        const leaves = o.kind === 'door' ? doorLeaves(w, o) : [];
        const n = o.swingIn ? { x: -u.y, y: u.x } : { x: u.y, y: -u.x };
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
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
            <polygon points={pointsAttr(corners(openingObb(w, o)))} className="opening-gap" data-testid={`opening-gap-${o.id}`} />
            {o.kind === 'window' && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="opening-window" />}
            {o.kind === 'opening' && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="opening-open" />}
            {leaves.map((l, i) => (
              <path key={i} d={sectorPath(l.swing.center, l.swing.radius, l.swing.start, l.swing.end)} className="opening-swing" />
            ))}
            {o.middle &&
              leaves.map((l, i) => (
                <line
                  key={`g${i}`}
                  x1={l.hinge.x}
                  y1={l.hinge.y}
                  x2={l.hinge.x + l.open.x * l.width}
                  y2={l.hinge.y + l.open.y * l.width}
                  className="opening-glass"
                />
              ))}
            {o.middle && (
              <text
                x={mid.x + n.x * (w.thickness / 2 + 12 * px)}
                y={mid.y + n.y * (w.thickness / 2 + 12 * px)}
                fontSize={10 * px}
                textAnchor="middle"
                dominantBaseline="middle"
                className="opening-middle-label"
                data-testid={`opening-middle-${o.id}`}
              >
                중문
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
