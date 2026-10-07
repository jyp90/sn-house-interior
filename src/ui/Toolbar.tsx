import { useRef, type ChangeEvent } from 'react';
import { findEntity } from '../model/entities';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { downloadText, planToJson, readPlanFile } from '../persistence/file';
import { ExportButtons } from './ExportButtons';
import { canSelectInMode, MODES } from './modes';
import { saveLabel } from './saveLabel';
import { useUi, type Mode, type View } from './uiStore';

const VIEWS: [View, string][] = [
  ['2d', '2D'],
  ['persp', '3D'],
  ['top', '3D 탑뷰'],
];

export function Toolbar() {
  const store = usePlanStore();
  const canUndo = usePlan((s) => s.past.length > 0);
  const canRedo = usePlan((s) => s.future.length > 0);
  const mode = useUi((s) => s.mode);
  const view = useUi((s) => s.view);
  const snap = useUi((s) => s.snap);
  const saveStatus = useUi((s) => s.saveStatus);
  const historyOpen = useUi((s) => s.historyOpen);
  const ui = useUi.getState();
  const fileRef = useRef<HTMLInputElement>(null);

  const onOpen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = await readPlanFile(file);
    if (r.ok) {
      store.getState().replacePlan(r.plan);
      ui.resetView();
      ui.showBanner({ kind: 'info', text: `"${r.plan.info.title}"을(를) 불러왔습니다.` });
    } else {
      ui.showBanner({ kind: 'error', text: `불러오기 실패\n${r.error}` });
    }
  };

  const changeMode = (m: Mode) => {
    ui.setMode(m);
    const s = store.getState();
    const entity = findEntity(s.plan, s.selectedId);
    if (entity && !canSelectInMode(m, entity.kind)) s.select(null);
  };

  return (
    <header className="toolbar">
      <strong className="brand">homefit</strong>
      <div className="segmented" role="group" aria-label="모드">
        {MODES.map(([m, label]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => changeMode(m)}>{label}</button>
        ))}
      </div>
      {mode === 'place' && (
        <div className="segmented" role="group" aria-label="보기">
          {VIEWS.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => ui.setView(v)}>{label}</button>
          ))}
        </div>
      )}
      <button type="button" aria-pressed={snap} onClick={() => ui.toggleSnap()}>{snap ? '스냅 켜짐' : '스냅 꺼짐'}</button>
      <button type="button" onClick={() => ui.resetView()}>시점 초기화</button>
      <span className="sep" />
      <button type="button" onClick={() => fileRef.current?.click()}>JSON 열기</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="open-json" onChange={onOpen} />
      <button type="button" onClick={() => downloadText(planToJson(store.getState().plan), 'homefit-plan.json')}>JSON 저장</button>
      {mode === 'place' && <ExportButtons />}
      <span className="sep" />
      <button type="button" aria-pressed={historyOpen} onClick={() => ui.setHistoryOpen(!historyOpen)}>이력</button>
      <button type="button" disabled={!canUndo} onClick={() => store.getState().undo()}>실행 취소</button>
      <button type="button" disabled={!canRedo} onClick={() => store.getState().redo()}>다시 실행</button>
      <span className={`save-status save-${saveStatus.state}`} data-testid="save-status">{saveLabel(saveStatus)}</span>
    </header>
  );
}
