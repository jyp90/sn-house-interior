import { Editor2D } from './editor2d/Editor2D';
import { usePlanStore } from './model/StoreContext';
import { Viewport } from './scene3d/Viewport';
import { Banner } from './ui/Banner';
import { CatalogPanel } from './ui/CatalogPanel';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { useShortcuts } from './ui/shortcuts';
import { Toolbar } from './ui/Toolbar';
import { useUi } from './ui/uiStore';

export function App() {
  useShortcuts(usePlanStore());
  const mode = useUi((s) => s.mode);
  const view = useUi((s) => s.view);
  const show2d = mode === 'structure' || view === '2d';
  return (
    <div className="app">
      <Toolbar />
      <Banner />
      <aside className="left">
        <CatalogPanel />
      </aside>
      <main className="center">
        <div className={show2d ? 'layer' : 'layer layer-hidden'}>
          <Editor2D />
        </div>
        <div className={show2d ? 'layer layer-hidden' : 'layer'}>
          <Viewport active={!show2d} />
        </div>
      </main>
      <aside className="right">
        <PropertiesPanel />
      </aside>
    </div>
  );
}
