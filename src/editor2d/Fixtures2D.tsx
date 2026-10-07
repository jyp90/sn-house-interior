import { useContext, useEffect, useRef, type PointerEvent } from 'react';
import { FIXTURE_GLYPH, FIXTURE_R_CM, snapFixture } from '../electrical/fixtures';
import type { Fixture } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';

const CLICK_SLOP_PX = 3;

type Drag = { id: string; dx: number; dy: number; startX: number; startY: number; moved: boolean };

export function Fixtures2D() {
  const store = usePlanStore();
  const fixtures = usePlan((s) => s.plan.fixtures);
  const selectedId = usePlan((s) => s.selectedId);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const setDragging = useUi((s) => s.setDragging);
  const svgRef = useContext(SvgContext);
  const drag = useRef<Drag | null>(null);
  const interactive = mode === 'electric' && tool === 'select';
  const toPlan = (e: { clientX: number; clientY: number }) => clientToPlan(svgRef.current!, e.clientX, e.clientY);

  const onDown = (e: PointerEvent<SVGGElement>, f: Fixture) => {
    e.stopPropagation();
    const s = store.getState();
    s.select(f.id);
    const p = toPlan(e);
    drag.current = { id: f.id, dx: f.pos.x - p.x, dy: f.pos.y - p.y, startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    s.beginDrag();
    setDragging(true);
  };

  const onMove = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > CLICK_SLOP_PX) d.moved = true;
    if (!d.moved) return;
    const s = store.getState();
    const f = s.plan.fixtures.find((x) => x.id === d.id);
    if (!f) return;
    const p = toPlan(e);
    const snapped = snapFixture(s.plan.walls, { x: p.x + d.dx, y: p.y + d.dy }, f.kind, useUi.getState().snap);
    s.dragFixture(d.id, snapped.pos, snapped.wallId);
  };

  const finish = () => {
    if (!drag.current) return;
    drag.current = null;
    store.getState().endDrag();
    setDragging(false);
  };

  // 드래그 중인 설비가 사라지거나(삭제·실행 취소·파일 열기) 조작 불가 상태가 되면 드래그를 닫는다
  useEffect(() => {
    const d = drag.current;
    if (d && (!interactive || !fixtures.some((f) => f.id === d.id))) finish();
  });

  return (
    <g className={interactive ? 'fixtures2d fixtures2d-interactive' : 'fixtures2d'}>
      {fixtures.map((f) => {
        const g = FIXTURE_GLYPH[f.kind];
        const r = FIXTURE_R_CM;
        return (
          <g
            key={f.id}
            className={f.id === selectedId ? 'fixture2d fixture2d-selected' : 'fixture2d'}
            data-testid={`fixture-${f.id}`}
            onPointerDown={interactive ? (e) => onDown(e, f) : undefined}
            onPointerMove={interactive ? onMove : undefined}
            onPointerUp={interactive ? finish : undefined}
            onPointerCancel={interactive ? finish : undefined}
          >
            {g.shape === 'circle' ? (
              <circle cx={f.pos.x} cy={f.pos.y} r={r} fill={g.fill} stroke={g.stroke} className="fixture2d-shape" />
            ) : (
              <rect x={f.pos.x - r} y={f.pos.y - r} width={r * 2} height={r * 2} fill={g.fill} stroke={g.stroke} className="fixture2d-shape" />
            )}
            <text x={f.pos.x} y={f.pos.y} fontSize={r * 1.1} textAnchor="middle" dominantBaseline="central" fill={g.letterFill} className="fixture2d-letter">
              {g.letter}
            </text>
          </g>
        );
      })}
    </g>
  );
}
