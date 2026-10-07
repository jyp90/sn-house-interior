import { findProduct } from '../../catalog/products';
import type { Item } from '../../model/schema';
import { usePlan, usePlanStore } from '../../model/StoreContext';
import { useValidation } from '../../model/useValidation';
import { CheckboxField, NumberField } from '../fields';

export function ItemProperties({ item }: { item: Item }) {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const status = useValidation();
  const product = findProduct(plan, item.productId);
  const st = status[item.id];
  const s = store.getState();
  const locked = !!item.locked;
  return (
    <>
      <h3>{product?.name ?? '알 수 없는 제품'}</h3>
      {product && (
        <p className="muted">
          {product.model && `${product.model} · `}
          {product.dims.w}×{product.dims.d}×{product.dims.h}cm
        </p>
      )}
      <div className="badges">
        {st?.collides && <span className="badge danger" data-testid="status-collides">충돌</span>}
        {st?.blocksDoor && <span className="badge danger" data-testid="status-blocks-door">방문 열림 간섭</span>}
        {st?.clearanceBlocked && <span className="badge warn" data-testid="status-clearance">문 열림 공간 부족</span>}
      </div>
      <NumberField key={`${item.id}-x`} label="X" unit="cm" value={item.x} disabled={locked} onCommit={(v) => s.updateItem(item.id, { x: v })} />
      <NumberField key={`${item.id}-y`} label="Y" unit="cm" value={item.y} disabled={locked} onCommit={(v) => s.updateItem(item.id, { y: v })} />
      <NumberField key={`${item.id}-r`} label="회전" unit="°" value={item.rotation} disabled={locked} onCommit={(v) => s.updateItem(item.id, { rotation: v })} />
      {product && product.variants.length > 1 && (
        <label className="field">
          색상
          <select value={item.variantId} onChange={(e) => s.updateItem(item.id, { variantId: e.target.value })}>
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </label>
      )}
      <CheckboxField label="잠금 (이동·회전 막기)" checked={locked} onChange={(v) => s.updateItem(item.id, { locked: v })} />
      <CheckboxField label="실측 확인" checked={!!item.verified} onChange={(v) => s.updateItem(item.id, { verified: v })} />
      <div className="row">
        <button type="button" disabled={locked} onClick={() => s.rotateItem(item.id, 90)}>90° 회전 (R)</button>
        <button type="button" onClick={() => s.duplicateItem(item.id)}>복제</button>
        <button type="button" className="danger" onClick={() => s.removeItem(item.id)}>삭제</button>
      </div>
    </>
  );
}
