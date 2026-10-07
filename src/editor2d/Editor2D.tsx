import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { planBounds } from '../geometry/bounds';
import type { Vec2 } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { BackgroundImage } from './BackgroundImage';
import { Openings2D } from './Openings2D';
import { Rooms2D } from './Rooms2D';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';
import { ToolPreview } from './ToolPreview';
import { applyToolClick, finishWall } from './tools';
import { fitViewBox, panBy, zoomAt, type ViewBox } from './viewBox';
import { Walls2D } from './Walls2D';

const ZOOM_STEP = 1.15;

export function Editor2D() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const resetKey = useUi((s) => s.viewResetKey);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [vb, setVb] = useState<ViewBox>(() => fitViewBox(planBounds({ walls }), 4 / 3));
  const [wallPoints, setWallPoints] = useState<Vec2[]>([]);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const pan = useRef<{ x: number; y: number; vb: ViewBox } | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 처음 열 때, 화면 크기가 바뀔 때, "시점 초기화"를 누를 때 평면 전체가 보이게 맞춘다
  useEffect(() => {
    setVb(fitViewBox(planBounds({ walls: store.getState().plan.walls }), size.w / size.h));
  }, [store, size.w, size.h, resetKey]);

  // 도구를 바꾸면 그리던 벽은 버린다
  useEffect(() => {
    setWallPoints([]);
    setCursor(null);
  }, [tool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if ((e.key === 'Enter' || e.key === 'Escape') && tool === 'wall' && wallPoints.length > 0) {
        e.preventDefault();
        finishWall(store, wallPoints);
        setWallPoints([]);
        return;
      }
      if (e.key === 'Escape') {
        const ui = useUi.getState();
        ui.clearCandidates();
        if (ui.calibration) ui.cancelCalibration();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, wallPoints, tool]);

  const px = vb.w / size.w;
  const toPlan = (e: { clientX: number; clientY: number }) => clientToPlan(svgRef.current!, e.clientX, e.clientY);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    if (tool === 'select') {
      store.getState().select(null);
      useUi.getState().clearCandidates();
      pan.current = { x: e.clientX, y: e.clientY, vb };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    applyToolClick(tool, toPlan(e), { store, wallPoints, setWallPoints });
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const p = pan.current;
    if (p) {
      const k = p.vb.w / size.w;
      setVb(panBy(p.vb, -(e.clientX - p.x) * k, -(e.clientY - p.y) * k));
      return;
    }
    if (tool !== 'select') setCursor(toPlan(e));
  };
  const endPan = () => {
    pan.current = null;
  };
  const onDoubleClick = () => {
    if (tool !== 'wall' || wallPoints.length === 0) return;
    finishWall(store, wallPoints);
    setWallPoints([]);
  };
  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    const p = toPlan(e);
    setVb((v) => zoomAt(v, p, e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
  };

  return (
    <div className={`editor2d mode-${mode}`}>
      <SvgContext.Provider value={svgRef}>
        <svg
          ref={svgRef}
          className={`editor2d-svg tool-${tool}`}
          data-testid="editor2d"
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
        >
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} className="editor2d-bg" />
          <BackgroundImage px={px} />
          <Rooms2D px={px} />
          <Walls2D px={px} />
          <Openings2D />
          <ToolPreview px={px} wallPoints={wallPoints} cursor={cursor} />
        </svg>
      </SvgContext.Provider>
    </div>
  );
}
