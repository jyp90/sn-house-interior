import { wallLength } from '../../geometry/walls';
import type { Wall } from '../../model/schema';
import { usePlanStore } from '../../model/StoreContext';
import { CheckboxField, NumberField } from '../fields';
import { useUi } from '../uiStore';

export function WallProperties({ wall }: { wall: Wall }) {
  const s = usePlanStore().getState();
  const showBanner = useUi((u) => u.showBanner);
  return (
    <>
      <h3>벽</h3>
      <p className="muted">{wall.verified ? '실측 확인됨' : '추정 치수'}</p>
      <NumberField
        key={`${wall.id}-len`}
        label="길이"
        unit="cm"
        value={Math.round(wallLength(wall))}
        onCommit={(v) => {
          const err = s.resizeWall(wall.id, v);
          if (err) showBanner({ kind: 'error', text: err });
        }}
      />
      <NumberField key={`${wall.id}-t`} label="두께" unit="cm" value={wall.thickness} onCommit={(v) => s.updateWall(wall.id, { thickness: Math.max(1, v) })} />
      <NumberField key={`${wall.id}-h`} label="높이" unit="cm" value={wall.height} onCommit={(v) => s.updateWall(wall.id, { height: Math.max(1, v) })} />
      <CheckboxField label="실측 확인" checked={!!wall.verified} onChange={(v) => s.updateWall(wall.id, { verified: v })} />
      <button type="button" className="danger" onClick={() => s.removeWall(wall.id)}>벽 삭제</button>
    </>
  );
}
