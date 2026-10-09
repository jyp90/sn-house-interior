import { pointInPolygon } from '../geometry/polygon';
import { activeItems, itemNumbers } from './layout';
import type { Item, Plan, Product, Room } from './schema';

export type ItemListEntry = { item: Item; product: Product; number: number };
export type ItemListGroup = { room: Room | null; items: ItemListEntry[] };

// 배치된 아이템을 방별로 묶는다(스펙 §28). 방은 plan.rooms 순서, 방 미지정은 맨 뒤, 각 묶음 안은 번호 순
export function groupItemsByRoom(plan: Plan, resolve: (productId: string) => Product | undefined): ItemListGroup[] {
  const numbers = itemNumbers(plan);
  const entries: ItemListEntry[] = [];
  for (const item of activeItems(plan)) {
    const product = resolve(item.productId);
    const number = numbers.get(item.id);
    if (!product || number === undefined) continue;
    entries.push({ item, product, number });
  }

  const byRoom = new Map<string, ItemListEntry[]>();
  const unassigned: ItemListEntry[] = [];
  for (const entry of entries) {
    const room = plan.rooms.find((r) => r.polygon && pointInPolygon({ x: entry.item.x, y: entry.item.y }, r.polygon));
    if (!room) {
      unassigned.push(entry);
      continue;
    }
    const list = byRoom.get(room.id);
    if (list) list.push(entry);
    else byRoom.set(room.id, [entry]);
  }

  const byNumber = (a: ItemListEntry, b: ItemListEntry) => a.number - b.number;
  const groups: ItemListGroup[] = [];
  for (const room of plan.rooms) {
    const items = byRoom.get(room.id);
    if (items) groups.push({ room, items: [...items].sort(byNumber) });
  }
  if (unassigned.length > 0) groups.push({ room: null, items: unassigned.sort(byNumber) });
  return groups;
}
