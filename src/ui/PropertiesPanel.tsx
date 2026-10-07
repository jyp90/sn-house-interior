import { useEffect, useState } from 'react';
import { findProduct } from '../catalog/products';
import { activeItems } from '../model/layout';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useValidation } from '../model/useValidation';

function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Number(text);
    if (Number.isFinite(v) && Math.round(v) !== value) onCommit(Math.round(v));
    else setText(String(value));
  };
  return (
    <label>
      {label}
      <input
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

export function PropertiesPanel() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const status = useValidation();
  const item = activeItems(plan).find((i) => i.id === selectedId);

  if (!item) {
    return (
      <div className="props" data-testid="properties-panel">
        <p className="muted">아이템을 선택하세요.</p>
      </div>
    );
  }

  const product = findProduct(plan, item.productId);
  const st = status[item.id];
  const s = store.getState();
  return (
    <div className="props" data-testid="properties-panel">
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
      <NumberField label="X (cm)" value={item.x} onCommit={(v) => s.updateItem(item.id, { x: v })} />
      <NumberField label="Y (cm)" value={item.y} onCommit={(v) => s.updateItem(item.id, { y: v })} />
      <NumberField label="회전 (°)" value={item.rotation} onCommit={(v) => s.updateItem(item.id, { rotation: v })} />
      {product && product.variants.length > 1 && (
        <label>
          색상
          <select value={item.variantId} onChange={(e) => s.updateItem(item.id, { variantId: e.target.value })}>
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </label>
      )}
      <div className="row">
        <button type="button" onClick={() => s.rotateItem(item.id, 90)}>90° 회전 (R)</button>
        <button type="button" onClick={() => s.duplicateItem(item.id)}>복제</button>
        <button type="button" className="danger" onClick={() => s.removeItem(item.id)}>삭제</button>
      </div>
    </div>
  );
}
