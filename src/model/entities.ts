import { activeItems } from './layout';
import type { Item, Opening, Plan, Room, Wall } from './schema';

export type Entity =
  | { kind: 'item'; item: Item }
  | { kind: 'wall'; wall: Wall }
  | { kind: 'opening'; opening: Opening }
  | { kind: 'room'; room: Room };

export function findEntity(plan: Plan, id: string | null): Entity | null {
  if (!id) return null;
  const item = activeItems(plan).find((i) => i.id === id);
  if (item) return { kind: 'item', item };
  const wall = plan.walls.find((w) => w.id === id);
  if (wall) return { kind: 'wall', wall };
  const opening = plan.openings.find((o) => o.id === id);
  if (opening) return { kind: 'opening', opening };
  const room = plan.rooms.find((r) => r.id === id);
  if (room) return { kind: 'room', room };
  return null;
}
