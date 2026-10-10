import { useContext, useRef, type PointerEvent } from 'react';
import type { Vec2, Room } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { snapToEndpointGroups } from './snapping';
import { areaSnapGroups } from './tools';
import { pointsAttr } from './svg';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';
import { FloorPatternDefs, floorFill } from './floorPattern';
import { markRoomPress } from './roomPress';
import { areaM2 } from '../geometry/polygon';

const ROOM_NAME_PX = 20; // 방 이름 글씨(화면 px, 스펙 §37.2)
const ROOM_AREA_PX = 14; // 면적 줄 글씨

function VertexHandle({ roomId, index, point, px }: { roomId: string; index: number; point: Vec2; px: number }) {
  const store = usePlanStore();
  const svgRef = useContext(SvgContext);
  const setDragging = useUi((s) => s.setDragging);
  const dragging = useRef(false);
  const snapGroups = useRef<Vec2[][]>([]);

  const onDown = (e: PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const g = areaSnapGroups(store.getState().plan.walls); // 드래그 중 벽은 바뀌지 않으므로 시작할 때 한 번
    snapGroups.current = [g.faces, g.rest];
    store.getState().beginDrag();
    setDragging(true);
  };
  const onMove = (e: PointerEvent<SVGCircleElement>) => {
    if (!dragging.current || !svgRef.current) return;
    const raw = clientToPlan(svgRef.current, e.clientX, e.clientY);
    const s = store.getState();
    const to = useUi.getState().snap ? (snapToEndpointGroups(raw, snapGroups.current) ?? raw) : raw;
    s.dragRoomVertex(roomId, index, to);
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    store.getState().endDrag();
    setDragging(false);
  };

  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={6 * px}
      className="endpoint-handle"
      data-testid={`room-vertex-${roomId}-${index}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}

export function Rooms2D({ px }: { px: number }) {
  const store = usePlanStore();
  const rooms = usePlan((s) => s.plan.rooms);
  const finish = usePlan((s) => s.plan.finish);
  const selectedId = usePlan((s) => s.selectedId);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const interactive = mode === 'structure' && tool === 'select';
  const roomsWithPolygon = rooms.filter((r): r is Room & { polygon: Vec2[] } => !!r.polygon);
  const plan = { finish };

  return (
    <g className="rooms2d">
      <FloorPatternDefs rooms={roomsWithPolygon} plan={plan} />
      {roomsWithPolygon.map((r) => (
        <polygon
          key={r.id}
          points={pointsAttr(r.polygon)}
          fill={floorFill(r, plan)}
          className={r.id === selectedId ? 'room-area room-area-selected' : 'room-area'}
          data-testid={`room-area-${r.id}`}
          onPointerDown={
            interactive
              ? (e) => {
                  // 전파를 막지 않는다: svg가 선택 해제 없이 pan을 시작한다
                  markRoomPress(e.nativeEvent);
                  store.getState().select(r.id);
                }
              : undefined
          }
        />
      ))}
      {rooms.map((r) => (
        <text
          key={r.id}
          x={r.label.x}
          y={r.label.y}
          fontSize={ROOM_NAME_PX * px}
          textAnchor="middle"
          dominantBaseline="middle"
          className={r.id === selectedId ? 'room-name room-selected' : 'room-name'}
          data-testid={`room-${r.id}`}
          onPointerDown={
            interactive
              ? (e) => {
                  // 전파를 막지 않는다: svg가 선택 해제 없이 pan을 시작한다
                  markRoomPress(e.nativeEvent);
                  store.getState().select(r.id);
                }
              : undefined
          }
        >
          {r.polygon ? (
            <>
              <tspan x={r.label.x} dy="-0.55em">{r.name}</tspan>
              <tspan x={r.label.x} dy="1.35em" fontSize={ROOM_AREA_PX * px} className="room-area-label" data-testid={`room-area-label-${r.id}`}>
                ({areaM2(r.polygon).toFixed(1)}㎡)
              </tspan>
            </>
          ) : (
            r.name
          )}
        </text>
      ))}
    </g>
  );
}

// 선택한 방의 꼭짓점 손잡이. 벽·개구부 위에서도 잡히도록 Editor2D가 맨 위 층(ToolPreview 바로 아래)에 그린다
export function RoomVertexHandles({ px }: { px: number }) {
  const rooms = usePlan((s) => s.plan.rooms);
  const selectedId = usePlan((s) => s.selectedId);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const room = rooms.find((r) => r.id === selectedId);
  if (mode !== 'structure' || tool !== 'select' || !room?.polygon) return null;
  return (
    <g className="room-vertex-handles">
      {room.polygon.map((p, i) => (
        <VertexHandle key={i} roomId={room.id} index={i} point={p} px={px} />
      ))}
    </g>
  );
}
