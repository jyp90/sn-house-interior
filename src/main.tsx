import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { StoreApi } from 'zustand/vanilla';
import { App } from './App';
import { SAMPLE_PLAN } from './model/samplePlan';
import { createPlanStore, type PlanState } from './model/store';
import { PlanStoreContext } from './model/StoreContext';
import { backupInvalidPlan, readStoredPlan, startAutosave } from './persistence/storage';
import { useUi } from './ui/uiStore';
import './styles.css';

declare global {
  interface Window {
    __homefit?: { store: StoreApi<PlanState> };
  }
}

const stored = readStoredPlan();
let initialPlan = SAMPLE_PLAN;
if (stored.status === 'ok') {
  initialPlan = stored.plan;
} else if (stored.status === 'invalid') {
  const backupKey = backupInvalidPlan(stored.raw);
  useUi.getState().showBanner({
    kind: 'error',
    text: backupKey
      ? `저장된 평면을 읽을 수 없어 샘플 평면으로 시작합니다. 기존 데이터는 브라우저에 "${backupKey}" 키로 백업해 두었습니다.`
      : '저장된 평면을 읽을 수 없어 샘플 평면으로 시작합니다. 백업도 실패했습니다. 기존 데이터가 필요하면 지금은 편집하지 마세요.',
  });
}

const store = createPlanStore(initialPlan);
let saveFailedShown = false;
startAutosave(store, {
  onResult: (ok) => {
    if (ok) {
      saveFailedShown = false;
      return;
    }
    if (saveFailedShown) return;
    saveFailedShown = true;
    useUi.getState().showBanner({ kind: 'error', text: '브라우저 저장에 실패했습니다. 상단의 "JSON 저장"으로 백업하세요.' });
  },
});
if (import.meta.env.DEV) window.__homefit = { store };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlanStoreContext.Provider value={store}>
      <App />
    </PlanStoreContext.Provider>
  </StrictMode>,
);
