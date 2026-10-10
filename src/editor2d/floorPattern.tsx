import type { Plan, Room } from '../model/schema';
import { roomFloor } from '../materials/presets';
import { patternSpec, shade } from '../materials/pattern';

function floorPatternId(roomId: string): string {
  return `floor-${roomId}`;
}

export function FloorPatternDefs({ rooms, plan }: { rooms: Room[]; plan: Pick<Plan, 'finish'> }) {
  return (
    <defs>
      {rooms.map((r) => {
        const finish = roomFloor(r, plan);
        const spec = patternSpec(finish);
        if (!spec) return null;
        const grout = finish.material === 'tile' ? shade(finish.color, -0.25) : shade(finish.color, -0.35);
        return (
          <pattern key={r.id} id={floorPatternId(r.id)} patternUnits="userSpaceOnUse" width={spec.w} height={spec.h}>
            <rect width={spec.w} height={spec.h} fill={grout} />
            {spec.shapes.map((s, i) => (
              <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={shade(finish.color, s.shade)} />
            ))}
          </pattern>
        );
      })}
    </defs>
  );
}

export function floorFill(room: Room, plan: Pick<Plan, 'finish'>): string {
  const finish = roomFloor(room, plan);
  return patternSpec(finish) ? `url(#${floorPatternId(room.id)})` : finish.color;
}
