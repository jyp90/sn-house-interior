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
import { isPageMode, shows2d } from './ui/modes';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { useShortcuts } from './ui/shortcuts';
import { StructurePanel } from './ui/StructurePanel';
import { SyncPanel } from './ui/SyncPanel';
import { Toolbar } from './ui/Toolbar';
import { useUi } from './ui/uiStore';

export function App() {
  useShortcuts(usePlanStore());
  const mode = useUi((s) => s.mode);
  const view = useUi((s) => s.view);
  const page = isPageMode(mode);
  const show2d = !page && shows2d(mode, view);
  const show3d = !page && !shows2d(mode, view);
  const appClass = ['app', page && 'app-wide'].filter(Boolean).join(' ');
  return (
    <div className={appClass}>
      <Toolbar />
      <Banner />
      {!page && (
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
        <SyncPanel />
      </main>
      {!page && (
        <aside className="right">
          <PropertiesPanel />
        </aside>
      )}
    </div>
  );
}
