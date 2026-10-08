import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import homePreset from 'virtual:home-preset';
import type { StoreApi } from 'zustand/vanilla';
import { App } from './App';
import { SAMPLE_PLAN } from './model/samplePlan';
import { createPlanStore, type PlanState } from './model/store';
import { PlanStoreContext } from './model/StoreContext';
import { prepareHomePreset } from './persistence/homePreset';
import { getDefaultImageStore } from './persistence/images';
import { recordAutoRevision } from './persistence/revisions';
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
} else if (stored.status === 'empty' && homePreset) {
  // 로컬 dev 전용: 저장된 평면이 없으면 우리 집 기본 평면으로 시작한다(스펙 §15.1)
  const r = await prepareHomePreset(homePreset, getDefaultImageStore());
  if (r.ok) {
    initialPlan = r.plan;
    if (r.imageMissing) useUi.getState().showBanner({ kind: 'error', text: '우리 집 평면도 이미지를 불러오지 못했습니다. private/home-floorplan.jpg를 확인하세요.' });
  } else {
    useUi.getState().showBanner({ kind: 'error', text: `우리 집 기본 평면을 읽을 수 없어 샘플 평면으로 시작합니다: ${r.error}` });
  }
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
  onPending: () => useUi.getState().setSaveStatus({ state: 'pending' }),
  onResult: (ok) => {
    useUi.getState().setSaveStatus(ok ? { state: 'saved', at: Date.now() } : { state: 'error' });
    if (ok) {
      saveFailedShown = false;
      recordAutoRevision(store.getState().plan, Date.now());
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
