import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';

export function Rooms2D({ px }: { px: number }) {
  const store = usePlanStore();
  const rooms = usePlan((s) => s.plan.rooms);
  const selectedId = usePlan((s) => s.selectedId);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const interactive = mode === 'structure' && tool === 'select';
  return (
    <g className="rooms2d">
      {rooms.map((r) => (
        <text
          key={r.id}
          x={r.label.x}
          y={r.label.y}
          fontSize={14 * px}
          textAnchor="middle"
          dominantBaseline="middle"
          className={r.id === selectedId ? 'room-name room-selected' : 'room-name'}
          data-testid={`room-${r.id}`}
          onPointerDown={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  store.getState().select(r.id);
                }
              : undefined
          }
        >
          {r.name}
        </text>
      ))}
    </g>
  );
}
