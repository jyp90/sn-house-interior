import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import homePreset from 'virtual:home-preset';
import type { StoreApi } from 'zustand/vanilla';
import { App } from './App';
import { isGateEnabled } from './persistence/gate';
import { Gate } from './ui/Gate';
import { SAMPLE_PLAN } from './model/samplePlan';
import { createPlanStore, type PlanState } from './model/store';
import { PlanStoreContext } from './model/StoreContext';
import { markPresetSeen, presetFingerprint, PRESET_UPDATED_TEXT, prepareHomePreset } from './persistence/homePreset';
import { getDefaultImageStore } from './persistence/images';
import { recordAutoRevision } from './persistence/revisions';
import { backupInvalidPlan, readStoredPlan, startAutosave } from './persistence/storage';
import { syncModeWithHash } from './ui/modeHash';
import { applyViewport } from './ui/smallScreen';
import { useUi } from './ui/uiStore';
import './styles.css';

declare global {
  interface Window {
    __homefit?: { store: StoreApi<PlanState>; ui: typeof useUi };
  }
}

// 모바일에서도 PC 레이아웃 그대로(스펙 §44)
applyViewport(document, window.screen.width);

const stored = readStoredPlan();
let initialPlan = SAMPLE_PLAN;
const seenStore = typeof localStorage === 'undefined' ? undefined : localStorage;
if (stored.status === 'ok') {
  initialPlan = stored.plan;
  // 프리셋이 바뀌었는데 예전 저장 평면으로 시작하면 한 번 안내한다(스펙 §39.4)
  if (homePreset && markPresetSeen(presetFingerprint(homePreset.plan), seenStore)) useUi.getState().showBanner({ kind: 'info', text: PRESET_UPDATED_TEXT });
} else if (stored.status === 'empty' && homePreset) {
  markPresetSeen(presetFingerprint(homePreset.plan), seenStore);
  // 저장된 평면이 없으면 우리 집 기본 평면으로 시작한다(스펙 §15.1, §24). 테스트·HOMEFIT_SAMPLE=1에서는 프리셋이 null
  const r = await prepareHomePreset(homePreset, getDefaultImageStore());
  if (r.ok) {
    initialPlan = r.plan;
    if (r.imageMissing) useUi.getState().showBanner({ kind: 'error', text: '우리 집 평면도 이미지를 불러오지 못했습니다. home/floorplan.jpg를 확인하세요.' });
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
syncModeWithHash(useUi);
if (import.meta.env.DEV) window.__homefit = { store, ui: useUi };

// 진입 PIN(스펙 §42): 우리 집 프리셋이 실린 빌드에서만. 테스트·HOMEFIT_SAMPLE=1은 꺼지고 dev의 ?gate=1로 강제한다
const gated = isGateEnabled({ preset: homePreset !== null, search: window.location.search, dev: import.meta.env.DEV });
const app = gated ? (
  <Gate>
    <App />
  </Gate>
) : (
  <App />
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlanStoreContext.Provider value={store}>
      {app}
    </PlanStoreContext.Provider>
  </StrictMode>,
);
