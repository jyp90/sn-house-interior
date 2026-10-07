import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { StoreApi } from 'zustand/vanilla';
import { App } from './App';
import { SAMPLE_PLAN } from './model/samplePlan';
import { createPlanStore, type PlanState } from './model/store';
import { PlanStoreContext } from './model/StoreContext';
import { loadFromStorage, startAutosave } from './persistence/storage';
import { useUi } from './ui/uiStore';
import './styles.css';

declare global {
  interface Window {
    __homefit?: { store: StoreApi<PlanState> };
  }
}

const store = createPlanStore(loadFromStorage() ?? SAMPLE_PLAN);
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
