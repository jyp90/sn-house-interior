import { useMemo, useState } from 'react';
import { ceilingHeightCm, itemElevationCm } from '../../catalog/elevation';
import { findProduct } from '../../catalog/products';
import { DEDICATED_RADIUS_CM, missingDedicatedCircuit } from '../../electrical/fixtures';
import type { Item } from '../../model/schema';
import { usePlan, usePlanStore } from '../../model/StoreContext';
import { useValidation } from '../../model/useValidation';
import { conflictLines } from '../../validation/describe';
import { CheckboxField, NumberField, TextAreaField, TextField } from '../fields';

export function ItemProperties({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const status = useValidation();
  const product = findProduct(plan, item.productId);
  const customProduct = product && plan.customProducts.some((p) => p.id === product.id) ? product : null;
  const st = status[item.id];
  const s = store.getState();
  const locked = !!item.locked;
  const placements = customProduct ? plan.layouts.flatMap((l) => l.items).filter((i) => i.productId === customProduct.id) : [];
  const dimsLocked = placements.some((i) => i.locked);
  const missingCircuit = useMemo(
    () => missingDedicatedCircuit(plan, (id) => findProduct(plan, id)).includes(item.id),
    [plan, item.id],
  );
  return (
    <>
      <h3>{product?.name ?? '알 수 없는 제품'}</h3>
      {customProduct ? (
        <>
          <TextField
            label="이름"
            value={customProduct.name}
            onCommit={(v) => s.updateCustomProduct(customProduct.id, { name: v })}
          />
          <div className="row">
            <NumberField
              key={`${customProduct.id}-w`}
              label="폭 W"
              unit="cm"
              value={customProduct.dims.w}
              disabled={dimsLocked}
              onCommit={(v) => s.updateCustomProduct(customProduct.id, { w: v })}
            />
            <NumberField
              key={`${customProduct.id}-d`}
              label="깊이 D"
              unit="cm"
              value={customProduct.dims.d}
              disabled={dimsLocked}
              onCommit={(v) => s.updateCustomProduct(customProduct.id, { d: v })}
            />
            <NumberField
              key={`${customProduct.id}-h`}
              label="높이 H"
              unit="cm"
              value={customProduct.dims.h}
              disabled={dimsLocked}
              onCommit={(v) => s.updateCustomProduct(customProduct.id, { h: v })}
            />
          </div>
          {placements.length > 1 && (
            <p className="muted">이 제품을 쓰는 가구 {placements.length}개에 모두 적용됩니다.</p>
          )}
        </>
      ) : (
        product && (
          <p className="muted">
            {product.model && `${product.model} · `}
            {product.dims.w}×{product.dims.d}×{product.dims.h}cm
          </p>
        )
      )}
      {product?.power && (
        <p className="muted">
          소비전력 {product.power.watts}W{product.power.dedicatedCircuit ? ' · 전용회로 필요' : ''}
        </p>
      )}
      {missingCircuit && (
        <p className="badge warn" data-testid="status-circuit">
          전용회로 콘센트 없음 ({DEDICATED_RADIUS_CM}cm 이내)
        </p>
      )}
      {st && (st.collides || st.blocksDoor || st.clearanceBlocked) && (
        <>
          <div className="badges">
            {st.collides && (
              <button type="button" className="badge danger" data-testid="status-collides" aria-expanded={open} onClick={() => setOpen(!open)}>충돌</button>
            )}
            {st.blocksDoor && (
              <button type="button" className="badge danger" data-testid="status-blocks-door" aria-expanded={open} onClick={() => setOpen(!open)}>방문 열림 간섭</button>
            )}
            {st.clearanceBlocked && (
              <button type="button" className="badge warn" data-testid="status-clearance" aria-expanded={open} onClick={() => setOpen(!open)}>문 열림 공간 부족</button>
            )}
          </div>
          {open && (
            <ul className="conflicts" data-testid="conflict-details">
              {conflictLines(st, plan).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <NumberField key={`${item.id}-x`} label="X" unit="cm" value={item.x} disabled={locked} onCommit={(v) => s.updateItem(item.id, { x: v })} />
      <NumberField key={`${item.id}-y`} label="Y" unit="cm" value={item.y} disabled={locked} onCommit={(v) => s.updateItem(item.id, { y: v })} />
      <NumberField key={`${item.id}-r`} label="회전" unit="°" value={item.rotation} disabled={locked} onCommit={(v) => s.updateItem(item.id, { rotation: v })} />
      {product && (
        <div className="row">
          <NumberField
            key={`${item.id}-e`}
            label="설치 높이"
            unit="cm"
            value={itemElevationCm(item, product, ceilingHeightCm(plan))}
            disabled={locked}
            onCommit={(v) => s.updateItem(item.id, { elevation: Math.max(0, v) })}
          />
          {item.elevation !== undefined && (
            <button type="button" disabled={locked} onClick={() => s.updateItem(item.id, { elevation: undefined })}>기본값</button>
          )}
        </div>
      )}
      {product && <p className="muted">바닥에서 밑면까지. 벽걸이·상부장·천장형은 제품 기본값에서 시작합니다.</p>}
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
      <TextAreaField key={`${item.id}-note`} label="메모" value={item.note ?? ''} onCommit={(v) => s.updateItem(item.id, { note: v })} />
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
