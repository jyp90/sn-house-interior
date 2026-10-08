import { areaM2 } from '../geometry/polygon';
import type { Vec2 } from '../model/schema';
import { usePlan } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { imagePxToPlan } from './calibration';
import { wallToolPoint } from './snapping';
import { pointsAttr } from './svg';
import { areaToolPoint } from './tools';

export function ToolPreview({
  px,
  wallPoints,
  areaPoints,
  cursor,
}: {
  px: number;
  wallPoints: Vec2[];
  areaPoints: Vec2[];
  cursor: Vec2 | null;
}) {
  const tool = useUi((s) => s.tool);
  const snap = useUi((s) => s.snap);
  const room = useUi((s) => s.roomDraft);
  const calibration = useUi((s) => s.calibration);
  const walls = usePlan((s) => s.plan.walls);
  const bg = usePlan((s) => s.plan.background);

  if (tool === 'wall' && wallPoints.length > 0) {
    const endpoints = [...walls.flatMap((w) => [w.a, w.b]), ...wallPoints];
    const last = wallPoints[wallPoints.length - 1];
    const next = cursor ? wallToolPoint(cursor, last, endpoints, snap) : null;
    const pts = next ? [...wallPoints, next] : wallPoints;
    return (
      <g className="tool-preview">
        <polyline points={pointsAttr(pts)} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4 * px} />
        ))}
        {next && (
          <text x={next.x + 8 * px} y={next.y - 8 * px} fontSize={11 * px}>
            {Math.round(Math.hypot(next.x - last.x, next.y - last.y))}cm
          </text>
        )}
      </g>
    );
  }
  if (tool === 'area' && (areaPoints.length > 0 || cursor)) {
    const next = cursor ? areaToolPoint(cursor, areaPoints, walls, snap) : null;
    const pts = next ? [...areaPoints, next] : areaPoints;
    return (
      <g className="tool-preview">
        {pts.length >= 2 && <polygon points={pointsAttr(pts)} className="tool-preview-area" />}
        {areaPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={(i === 0 ? 6 : 4) * px} />
        ))}
        {pts.length >= 3 && (
          <text x={pts[0].x + 8 * px} y={pts[0].y - 8 * px} fontSize={11 * px}>
            {areaM2(pts)}㎡
          </text>
        )}
      </g>
    );
  }
  if (tool === 'room' && cursor) {
    return (
      <g className="tool-preview">
        <rect x={cursor.x} y={cursor.y} width={room.w} height={room.d} className="tool-preview-room" />
        <text x={cursor.x + room.w / 2} y={cursor.y + room.d / 2} fontSize={12 * px} textAnchor="middle">
          {room.w}×{room.d}cm
        </text>
      </g>
    );
  }
  if (tool === 'calibrate' && calibration && bg) {
    const pts = calibration.points.map((p) => imagePxToPlan(bg, p));
    return (
      <g className="tool-preview">
        {pts.length === 2 && <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} className="calib-line" />}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={5 * px} className="calib-point" />
        ))}
      </g>
    );
  }
  return null;
}
