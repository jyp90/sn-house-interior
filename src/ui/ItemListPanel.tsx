import { findProduct } from '../catalog/products';
import { groupItemsByRoom } from '../model/itemList';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useValidation } from '../model/useValidation';
import { useUi } from './uiStore';

export function ItemListPanel() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const status = useValidation();
  const open = useUi((s) => s.itemListOpen);
  const setOpen = useUi((s) => s.setItemListOpen);
  const groups = groupItemsByRoom(plan, (id) => findProduct(plan, id));
  const count = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className="item-list" data-testid="item-list">
      <button type="button" aria-expanded={open} aria-controls="item-list-body" onClick={() => setOpen(!open)}>
        배치된 가구 ({count})
      </button>
      {open && (
        <div id="item-list-body" className="item-list-body">
          {count === 0 && <p className="muted">아직 배치한 가구가 없습니다.</p>}
          {groups.map((g) => (
            <div key={g.room?.id ?? 'unassigned'}>
              <h4>{g.room?.name ?? '방 미지정'} ({g.items.length})</h4>
              <ul>
                {g.items.map(({ item, product, number }) => {
                  const st = status[item.id];
                  const selected = item.id === selectedId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={selected ? 'item-row selected' : 'item-row'}
                        data-testid={`item-row-${item.id}`}
                        onClick={() => store.getState().select(item.id)}
                      >
                        {number} · {product.name}
                        {st && (st.collides || st.blocksDoor) && <span className="badge danger">충돌</span>}
                        {st && !(st.collides || st.blocksDoor) && st.clearanceBlocked && <span className="badge warn">경고</span>}
                        {item.locked && <span className="muted">잠금</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
