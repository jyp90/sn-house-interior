import { useContext, useRef, type PointerEvent } from 'react';
import { corners } from '../geometry/obb';
import { wallDir, wallLength, wallObb } from '../geometry/walls';
import type { Vec2 } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { snapToEndpoint } from './snapping';
import { pointsAttr } from './svg';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';

function EndpointHandle({ point, otherEnd, px }: { point: Vec2; otherEnd: Vec2; px: number }) {
  const store = usePlanStore();
  const svgRef = useContext(SvgContext);
  const setDragging = useUi((s) => s.setDragging);
  const from = useRef<Vec2 | null>(null);

  const onDown = (e: PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    from.current = point;
    e.currentTarget.setPointerCapture(e.pointerId);
    store.getState().beginDrag();
    setDragging(true);
  };
  const onMove = (e: PointerEvent<SVGCircleElement>) => {
    const start = from.current;
    if (!start || !svgRef.current) return;
    const raw = clientToPlan(svgRef.current, e.clientX, e.clientY);
    const s = store.getState();
    // 선택한 벽의 반대쪽 끝점으로는 스냅하지 않는다 — 벽이 길이 0으로 붕괴하는 것을 막는다
    const others = (s.dragOrigin ?? s.plan).walls
      .flatMap((w) => [w.a, w.b])
      .filter((p) => (p.x !== start.x || p.y !== start.y) && (p.x !== otherEnd.x || p.y !== otherEnd.y));
    const to = useUi.getState().snap ? (snapToEndpoint(raw, others) ?? raw) : raw;
    s.dragEndpoint(start, to);
  };
  const onUp = () => {
    if (!from.current) return;
    from.current = null;
    store.getState().endDrag();
    setDragging(false);
  };

  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={6 * px}
      className="endpoint-handle"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}

export function Walls2D({ px }: { px: number }) {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const selectedId = usePlan((s) => s.selectedId);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const interactive = mode === 'structure' && tool === 'select';
  const selected = walls.find((w) => w.id === selectedId);

  return (
    <g className="walls2d">
      {walls.map((w) => {
        const len = Math.round(wallLength(w));
        const u = wallDir(w);
        const off = w.thickness / 2 + 12 * px;
        const label = { x: (w.a.x + w.b.x) / 2 - u.y * off, y: (w.a.y + w.b.y) / 2 + u.x * off };
        return (
          <g key={w.id}>
            <polygon
              points={pointsAttr(corners(wallObb(w)))}
              className={w.id === selectedId ? 'wall wall-selected' : 'wall'}
              data-testid={`wall-${w.id}`}
              onPointerDown={
                interactive
                  ? (e) => {
                      e.stopPropagation();
                      store.getState().select(w.id);
                    }
                  : undefined
              }
            />
            {len > 0 && (
              <text x={label.x} y={label.y} fontSize={11 * px} className={w.verified ? 'dim' : 'dim dim-unverified'} textAnchor="middle" dominantBaseline="middle">
                {w.verified ? `${len}` : `≈${len}`}
              </text>
            )}
          </g>
        );
      })}
      {interactive && selected && (
        <>
          <EndpointHandle key="a" point={selected.a} otherEnd={selected.b} px={px} />
          <EndpointHandle key="b" point={selected.b} otherEnd={selected.a} px={px} />
        </>
      )}
    </g>
  );
}
