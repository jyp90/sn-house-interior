import { activeItems } from './layout';
import type { Fixture, Item, Opening, Plan, Room, Wall } from './schema';

export type Entity =
  | { kind: 'item'; item: Item }
  | { kind: 'wall'; wall: Wall }
  | { kind: 'opening'; opening: Opening }
  | { kind: 'room'; room: Room }
  | { kind: 'fixture'; fixture: Fixture };

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
  const fixture = plan.fixtures.find((f) => f.id === id);
  if (fixture) return { kind: 'fixture', fixture };
  return null;
}
