import { useEffect } from 'react';
import { Editor2D } from './editor2d/Editor2D';
import { usePlanStore } from './model/StoreContext';
import { Viewport } from './scene3d/Viewport';
import { Banner } from './ui/Banner';
import { CandidatePicker } from './ui/CandidatePicker';
import { CatalogPanel } from './ui/CatalogPanel';
import { ChecklistView } from './ui/ChecklistView';
import { ElectricPanel } from './ui/ElectricPanel';
import { ExportView } from './ui/ExportView';
import { HistoryPanel } from './ui/HistoryPanel';
import { ItemListPanel } from './ui/ItemListPanel';
import { LayoutBar } from './ui/LayoutBar';
import { MobileInfoBar } from './ui/MobileInfoBar';
import { isPageMode, shows2d } from './ui/modes';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { useShortcuts } from './ui/shortcuts';
import { StructurePanel } from './ui/StructurePanel';
import { Toolbar } from './ui/Toolbar';
import { useUi } from './ui/uiStore';

const MOBILE_QUERY = '(max-width: 820px)';

// 화면 폭 820px 이하면 보기 전용(스펙 §32.1). matchMedia 구독, 창 크기 변화도 따라간다. jsdom 등 테스트 환경엔 matchMedia가 없을 수 있다
function useMobileViewOnly() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = () => useUi.getState().setViewOnly(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
}

export function App() {
  useShortcuts(usePlanStore());
  useMobileViewOnly();
  const mode = useUi((s) => s.mode);
  const view = useUi((s) => s.view);
  const viewOnly = useUi((s) => s.viewOnly);
  const page = isPageMode(mode);
  const show2d = !page && shows2d(mode, view);
  const show3d = !page && !shows2d(mode, view);
  const appClass = ['app', page && 'app-wide', viewOnly && 'app-mobile'].filter(Boolean).join(' ');
  return (
    <div className={appClass}>
      <Toolbar />
      <Banner />
      {!page && !viewOnly && (
        <aside className="left">
          {mode === 'structure' ? <StructurePanel /> : mode === 'electric' ? <ElectricPanel /> : <CatalogPanel />}
        </aside>
      )}
      <main className="center">
        <div className={show2d ? 'layer' : 'layer layer-hidden'}>
          <Editor2D />
        </div>
        <div className={show3d ? 'layer' : 'layer layer-hidden'}>
          <Viewport active={show3d} />
        </div>
        {!page && viewOnly && <MobileInfoBar />}
        <CandidatePicker />
        {mode === 'checklist' && (
          <div className="page-panel">
            <ChecklistView />
          </div>
        )}
        {mode === 'export' && (
          <div className="page-panel">
            <ExportView />
          </div>
        )}
        <HistoryPanel />
      </main>
      {!page && !viewOnly && (
        <aside className="right">
          <PropertiesPanel />
        </aside>
      )}
      {!page && viewOnly && (
        <section className="mobile-bottom">
          <LayoutBar />
          <ItemListPanel />
        </section>
      )}
    </div>
  );
}
