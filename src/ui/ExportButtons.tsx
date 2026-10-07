import { planSvg, exportFileName, unverifiedCount } from '../export/planSvg';
import { canvasWithHeader, svgToPngBlob } from '../export/png';
import { activeLayout } from '../model/layout';
import { usePlanStore } from '../model/StoreContext';
import { downloadBlob } from '../persistence/file';
import { capture3d } from '../scene3d/CaptureBridge';
import { useUi } from './uiStore';

export function ExportButtons() {
  const store = usePlanStore();
  const view = useUi((s) => s.view);

  const export2d = async () => {
    const plan = store.getState().plan;
    try {
      const { svg, width, height } = planSvg(plan);
      downloadBlob(await svgToPngBlob(svg, width, height), exportFileName(plan.info.title, activeLayout(plan).name, '2d'));
    } catch {
      useUi.getState().showBanner({ kind: 'error', text: '2D 이미지를 만들지 못했습니다.' });
    }
  };

  const export3d = async () => {
    const plan = store.getState().plan;
    const canvas = capture3d.current?.();
    if (!canvas) {
      useUi.getState().showBanner({ kind: 'error', text: '3D 보기에서 내보낼 수 있습니다.' });
      return;
    }
    try {
      const lines = [`${plan.info.title} · ${activeLayout(plan).name}`, `단위: cm · 실측 미확인 치수 ${unverifiedCount(plan)}개`];
      downloadBlob(await canvasWithHeader(canvas, lines), exportFileName(plan.info.title, activeLayout(plan).name, '3d'));
    } catch {
      useUi.getState().showBanner({ kind: 'error', text: '3D 이미지를 만들지 못했습니다.' });
    }
  };

  return (
    <>
      <button type="button" onClick={export2d}>2D PNG</button>
      <button type="button" disabled={view === '2d'} onClick={export3d}>3D PNG</button>
    </>
  );
}
