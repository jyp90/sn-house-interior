import { findProduct } from '../catalog/products';
import { findEntity } from '../model/entities';
import { usePlan } from '../model/StoreContext';
import { useValidation } from '../model/useValidation';

const OPENING_LABEL: Record<string, string> = { door: '문', window: '창', opening: '개구부' };

// 모바일 보기 전용: 선택한 항목의 이름·치수·상태를 캔버스 위 작은 띠로 보여 준다(읽기 전용, 스펙 §32.2)
export function MobileInfoBar() {
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const status = useValidation();
  const entity = findEntity(plan, selectedId);

  let name = '선택된 항목 없음';
  let dims: string | null = null;
  const badges: { text: string; cls: string }[] = [];

  if (entity?.kind === 'item') {
    const product = findProduct(plan, entity.item.productId);
    name = product?.name ?? '알 수 없는 제품';
    if (product) dims = `${product.dims.w}×${product.dims.d}×${product.dims.h}cm`;
    const st = status[entity.item.id];
    if (st?.collides || st?.blocksDoor) badges.push({ text: '충돌', cls: 'badge danger' });
    else if (st?.clearanceBlocked) badges.push({ text: '경고', cls: 'badge warn' });
    if (entity.item.locked) badges.push({ text: '잠금', cls: 'muted' });
  } else if (entity?.kind === 'fixture') {
    name = entity.fixture.kind === 'switch' ? '스위치' : entity.fixture.kind === 'light' ? '조명' : '콘센트';
    dims = `설치 높이 ${entity.fixture.height}cm`;
  } else if (entity?.kind === 'wall') {
    name = '벽';
  } else if (entity?.kind === 'opening') {
    name = OPENING_LABEL[entity.opening.kind] ?? '개구부';
    dims = `폭 ${entity.opening.width}cm`;
  } else if (entity?.kind === 'room') {
    name = entity.room.name;
  }

  return (
    <div className="mobile-info" data-testid="mobile-info">
      <span className="mobile-info-name">{name}</span>
      {dims && <span className="mobile-info-dims">{dims}</span>}
      {badges.map((b) => (
        <span key={b.text} className={b.cls}>{b.text}</span>
      ))}
    </div>
  );
}
