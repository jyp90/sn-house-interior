import { FIXTURE_KINDS, FIXTURE_LABEL, keepWallIdAfterMove, kindChangePatch, switchGroups, type FixtureKind } from '../../electrical/fixtures';
import type { Fixture, Vec2 } from '../../model/schema';
import { usePlan, usePlanStore } from '../../model/StoreContext';
import { NumberField, TextField } from '../fields';

export function FixtureProperties({ fixture }: { fixture: Fixture }) {
  const store = usePlanStore();
  const s = store.getState();
  const fixtures = usePlan((st) => st.plan.fixtures);
  const hasGroup = fixture.kind === 'switch' || fixture.kind === 'light';
  // 좌표를 고친 뒤 벽면을 벗어나면 벽 부착을 푼다
  const move = (pos: Vec2) => s.updateFixture(fixture.id, { pos, wallId: keepWallIdAfterMove(store.getState().plan.walls, fixture, pos) });
  return (
    <>
      <h3>{FIXTURE_LABEL[fixture.kind]}</h3>
      <p className="muted">{fixture.wallId ? '벽에 붙어 있음' : '벽에 붙지 않음'}</p>
      <label className="field">
        종류
        <select value={fixture.kind} onChange={(e) => s.updateFixture(fixture.id, kindChangePatch(fixture, e.target.value as FixtureKind))}>
          {FIXTURE_KINDS.map((k) => (
            <option key={k} value={k}>{FIXTURE_LABEL[k]}</option>
          ))}
        </select>
      </label>
      <NumberField key={`${fixture.id}-x`} label="X" unit="cm" value={fixture.pos.x} onCommit={(v) => move({ ...fixture.pos, x: v })} />
      <NumberField key={`${fixture.id}-y`} label="Y" unit="cm" value={fixture.pos.y} onCommit={(v) => move({ ...fixture.pos, y: v })} />
      <NumberField key={`${fixture.id}-h`} label="설치 높이" unit="cm" value={fixture.height} onCommit={(v) => s.updateFixture(fixture.id, { height: v })} />
      {hasGroup && (
        <>
          <TextField
            key={`${fixture.id}-group`}
            label="스위치 그룹"
            value={fixture.group ?? ''}
            allowEmpty
            list="switch-group-names"
            onCommit={(v) => s.updateFixture(fixture.id, { group: v })}
          />
          <datalist id="switch-group-names">
            {switchGroups(fixtures).map((g) => (
              <option key={g.name} value={g.name} />
            ))}
          </datalist>
        </>
      )}
      <TextField key={`${fixture.id}-memo`} label="메모" value={fixture.memo ?? ''} allowEmpty onCommit={(v) => s.updateFixture(fixture.id, { memo: v })} />
      <div className="row">
        <button type="button" className="danger" onClick={() => s.removeFixture(fixture.id)}>삭제</button>
      </div>
    </>
  );
}
