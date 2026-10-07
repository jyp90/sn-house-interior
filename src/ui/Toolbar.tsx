import { useRef, type ChangeEvent } from 'react';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { downloadText, planToJson, readPlanFile } from '../persistence/file';
import { useUi } from './uiStore';

export function Toolbar() {
  const store = usePlanStore();
  const canUndo = usePlan((s) => s.past.length > 0);
  const canRedo = usePlan((s) => s.future.length > 0);
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const showBanner = useUi((s) => s.showBanner);
  const fileRef = useRef<HTMLInputElement>(null);

  const onOpen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = await readPlanFile(file);
    if (r.ok) {
      store.getState().loadPlan(r.plan);
      showBanner({ kind: 'info', text: `"${r.plan.info.title}"을(를) 불러왔습니다.` });
    } else {
      showBanner({ kind: 'error', text: `불러오기 실패\n${r.error}` });
    }
  };

  return (
    <header className="toolbar">
      <strong className="brand">homefit</strong>
      <button type="button" onClick={() => fileRef.current?.click()}>JSON 열기</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="open-json" onChange={onOpen} />
      <button type="button" onClick={() => downloadText(planToJson(store.getState().plan), 'homefit-plan.json')}>JSON 저장</button>
      <span className="sep" />
      <button type="button" disabled={!canUndo} onClick={() => store.getState().undo()}>실행 취소</button>
      <button type="button" disabled={!canRedo} onClick={() => store.getState().redo()}>다시 실행</button>
      <span className="sep" />
      <button type="button" onClick={() => setView(view === 'persp' ? 'top' : 'persp')}>
        {view === 'persp' ? '탑뷰로 보기' : '원근으로 보기'}
      </button>
    </header>
  );
}
