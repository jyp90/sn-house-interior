import { useMemo } from 'react';
import { CATALOG, CATEGORY_LABEL, CATEGORY_ORDER } from '../catalog/products';
import { planCenter } from '../geometry/bounds';
import type { Product } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { CustomBoxForm } from './CustomBoxForm';
import { DND_MIME } from './dnd';
import { LayoutBar } from './LayoutBar';

export function CatalogPanel() {
  const store = usePlanStore();
  const custom = usePlan((s) => s.plan.customProducts);
  const groups = useMemo(() => {
    const all = [...CATALOG, ...custom];
    return CATEGORY_ORDER.map((cat) => [cat, all.filter((p) => p.category === cat)] as const).filter(([, list]) => list.length > 0);
  }, [custom]);

  const addAtCenter = (p: Product) => {
    const s = store.getState();
    s.addItem(p.id, p.variants[0].id, planCenter(s.plan));
  };

  return (
    <div className="catalog">
      <LayoutBar />
      {groups.map(([cat, list]) => (
        <section key={cat}>
          <h3>{CATEGORY_LABEL[cat]}</h3>
          {list.map((p) => (
            <div
              key={p.id}
              className="card"
              draggable
              data-testid={`catalog-card-${p.id}`}
              onDragStart={(e) => {
                e.dataTransfer.setData(DND_MIME, `${p.id}|${p.variants[0].id}`);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <div className="card-text">
                <div className="card-name">{p.name}</div>
                <div className="card-dims">{p.dims.w}×{p.dims.d}×{p.dims.h}cm</div>
              </div>
              <button type="button" onClick={() => addAtCenter(p)}>추가</button>
            </div>
          ))}
        </section>
      ))}
      <CustomBoxForm />
    </div>
  );
}
