import type { Opening } from '../../model/schema';
import { usePlanStore } from '../../model/StoreContext';
import { CheckboxField, NumberField } from '../fields';
import { useUi } from '../uiStore';

const KINDS: [Opening['kind'], string][] = [
  ['door', '문'],
  ['window', '창'],
  ['opening', '개구부'],
];

export function OpeningProperties({ opening }: { opening: Opening }) {
  const s = usePlanStore().getState();
  const showBanner = useUi((u) => u.showBanner);
  const label = KINDS.find(([k]) => k === opening.kind)?.[1] ?? '개구부';
  const update = (patch: Partial<Omit<Opening, 'id' | 'wallId'>>) => {
    const err = s.updateOpening(opening.id, patch);
    if (err) showBanner({ kind: 'error', text: err });
  };
  return (
    <>
      <h3>{label}</h3>
      <label className="field">
        종류
        <select
          value={opening.kind}
          onChange={(e) => {
            const kind = KINDS.find(([k]) => k === e.target.value)?.[0];
            if (kind) update({ kind });
          }}
        >
          {KINDS.map(([k, name]) => (
            <option key={k} value={k}>{name}</option>
          ))}
        </select>
      </label>
      <NumberField key={`${opening.id}-off`} label="벽 시작점에서 거리" unit="cm" value={opening.offset} onCommit={(v) => update({ offset: v })} />
      <NumberField key={`${opening.id}-w`} label="폭" unit="cm" value={opening.width} onCommit={(v) => update({ width: v })} />
      <NumberField key={`${opening.id}-h`} label="높이" unit="cm" value={opening.height} onCommit={(v) => update({ height: v })} />
      <NumberField key={`${opening.id}-s`} label="창턱 높이" unit="cm" value={opening.sill} onCommit={(v) => update({ sill: v })} />
      {opening.kind === 'door' && (
        <div className="row">
          <button type="button" onClick={() => update({ hinge: opening.hinge === 'start' ? 'end' : 'start' })}>경첩 반대로</button>
          <button type="button" onClick={() => update({ swingIn: !opening.swingIn })}>열림 방향 반대로</button>
        </div>
      )}
      <CheckboxField label="실측 확인" checked={!!opening.verified} onChange={(v) => update({ verified: v })} />
      <button type="button" className="danger" onClick={() => s.removeOpening(opening.id)}>{label} 삭제</button>
    </>
  );
}
