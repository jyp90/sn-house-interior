import { useEffect, useState } from 'react';
import { usePlanStore } from '../model/StoreContext';
import { addRevision, formatRevisionTime, loadRevisions, MAX_REVISIONS, saveRevisions, type Revision } from '../persistence/revisions';
import { useUi } from './uiStore';

export function HistoryPanel() {
  const store = usePlanStore();
  const open = useUi((s) => s.historyOpen);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (open) setRevisions(loadRevisions());
  }, [open]);

  if (!open) return null;
  const ui = useUi.getState();

  const saveNow = () => {
    const next = addRevision(loadRevisions(), store.getState().plan, Date.now(), label);
    if (!saveRevisions(next)) {
      ui.showBanner({ kind: 'error', text: '이력을 저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.' });
      return;
    }
    setRevisions(next);
    setLabel('');
    ui.showBanner({ kind: 'info', text: '현재 상태를 이력에 저장했습니다.' });
  };

  const restore = (r: Revision) => {
    const snapshot = addRevision(loadRevisions(), store.getState().plan, Date.now(), '복원 전');
    saveRevisions(snapshot);
    setRevisions(snapshot);
    store.getState().replacePlan(r.plan);
    ui.resetView();
    ui.setHistoryOpen(false);
    ui.showBanner({ kind: 'info', text: `${formatRevisionTime(r.at)} 버전으로 복원했습니다. 실행 취소로 되돌릴 수 있습니다.` });
  };

  return (
    <div className="history" role="dialog" aria-label="복구 이력" data-testid="history-panel">
      <div className="history-head">
        <h3>복구 이력</h3>
        <button type="button" aria-label="닫기" onClick={() => ui.setHistoryOpen(false)}>×</button>
      </div>
      <p className="muted">자동 저장 중 5분마다 한 번, 최근 {MAX_REVISIONS}개까지 이 브라우저에 보관합니다.</p>
      <div className="row">
        <input aria-label="버전 이름" placeholder="버전 이름(선택)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="button" onClick={saveNow}>지금 버전 저장</button>
      </div>
      {revisions.length === 0 ? (
        <p className="muted">저장된 이력이 없습니다.</p>
      ) : (
        <ul className="history-list">
          {[...revisions].reverse().map((r) => (
            <li key={r.id}>
              <div>
                <strong>{formatRevisionTime(r.at)}</strong>
                {r.label ? ` · ${r.label}` : ''}
              </div>
              <div className="muted">
                배치안 {r.plan.layouts.length}개 · 벽 {r.plan.walls.length}개
              </div>
              <button type="button" onClick={() => restore(r)}>복원</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
