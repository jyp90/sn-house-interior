import { usePlanStore } from './model/StoreContext';
import { Viewport } from './scene3d/Viewport';
import { Banner } from './ui/Banner';
import { CatalogPanel } from './ui/CatalogPanel';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { useShortcuts } from './ui/shortcuts';
import { Toolbar } from './ui/Toolbar';

export function App() {
  useShortcuts(usePlanStore());
  return (
    <div className="app">
      <Toolbar />
      <Banner />
      <aside className="left">
        <CatalogPanel />
      </aside>
      <main className="center">
        <Viewport />
      </main>
      <aside className="right">
        <PropertiesPanel />
      </aside>
    </div>
  );
}
