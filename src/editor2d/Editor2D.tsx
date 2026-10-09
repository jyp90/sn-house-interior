import { useEffect, useRef, useState, type DragEvent, type PointerEvent, type WheelEvent } from 'react';
import { planBounds } from '../geometry/bounds';
import type { Vec2 } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { DND_MIME } from '../ui/dnd';
import { useUi } from '../ui/uiStore';
import { BackgroundImage } from './BackgroundImage';
import { Fixtures2D } from './Fixtures2D';
import { Items2D } from './Items2D';
import { Openings2D } from './Openings2D';
import { Overlays2D } from './Overlays2D';
import { RoomVertexHandles, Rooms2D } from './Rooms2D';
import { isRoomPress } from './roomPress';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';
import { ToolPreview } from './ToolPreview';
import { applyToolClick, finishArea, finishWall } from './tools';
import { fitViewBox, panBy, zoomAt, type ViewBox } from './viewBox';
import { Walls2D } from './Walls2D';

const ZOOM_STEP = 1.15;
const NO_POINTS: Vec2[] = [];

export function Editor2D() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const resetKey = useUi((s) => s.viewResetKey);
  const areaSession = useUi((s) => s.areaSession);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [vb, setVb] = useState<ViewBox>(() => fitViewBox(planBounds({ walls }), 4 / 3));
  const [wallPoints, setWallPoints] = useState<Vec2[]>([]);
  // 영역 초안은 그린 세션 번호와 함께 둔다. 「영역 (다시) 그리기」로 세션이 바뀐 바로 그 렌더부터 빈 초안으로 보이므로,
  // 효과(effect)가 비우기 전에 들어온 클릭이 옛 점에 이어 붙는 일이 없다
  const [areaDraft, setAreaDraft] = useState<{ session: number; points: Vec2[] }>({ session: areaSession, points: [] });
  const areaPoints = areaDraft.session === areaSession ? areaDraft.points : NO_POINTS;
  const setAreaPoints = (points: Vec2[]) => setAreaDraft({ session: useUi.getState().areaSession, points });
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

  // 도구를 바꾸면 그리던 벽/영역은 버린다(새 영역 세션의 초안은 위 areaDraft가 바로 비운다)
  useEffect(() => {
    setWallPoints([]);
    setAreaDraft((d) => ({ ...d, points: [] }));
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
      if (tool === 'area') {
        if (e.key === 'Enter' && areaPoints.length > 0) {
          e.preventDefault();
          if (finishArea(store, areaPoints)) setAreaPoints([]);
          return;
        }
        if (e.key === 'Escape') {
          setAreaPoints([]);
          useUi.getState().setTool('select');
          return;
        }
      }
      if (e.key === 'Escape' && tool === 'measure') {
        useUi.getState().clearMeasure();
        return;
      }
      if (e.key === 'Escape') {
        const ui = useUi.getState();
        ui.clearCandidates();
        if (ui.calibration) ui.cancelCalibration();
        if (ui.tool === 'fixture') ui.setTool('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, wallPoints, areaPoints, tool]);

  const px = vb.w / size.w;
  const toPlan = (e: { clientX: number; clientY: number }) => clientToPlan(svgRef.current!, e.clientX, e.clientY);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // 보기 전용(스펙 §32)에서는 그리기 도구가 (경합 등으로) 여전히 남아 있어도 클릭을 팬으로만 다룬다
    if (tool === 'select' || useUi.getState().viewOnly) {
      // 방을 눌렀으면 그 선택은 유지하고, 빈 곳이면 선택 해제. 어느 쪽이든 끌면 화면 이동
      if (!isRoomPress(e.nativeEvent)) {
        store.getState().select(null);
        useUi.getState().clearCandidates();
      }
      pan.current = { x: e.clientX, y: e.clientY, vb };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    applyToolClick(tool, toPlan(e), { store, wallPoints, setWallPoints, areaPoints, setAreaPoints });
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
    if (useUi.getState().viewOnly) return;
    if (tool === 'wall' && wallPoints.length > 0) {
      finishWall(store, wallPoints);
      setWallPoints([]);
      return;
    }
    if (tool === 'area' && areaPoints.length >= 3) {
      if (finishArea(store, areaPoints)) setAreaPoints([]);
    }
  };
  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    const p = toPlan(e);
    setVb((v) => zoomAt(v, p, e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
  };
  const onDragOver = (e: DragEvent) => {
    if (mode === 'place' && !useUi.getState().viewOnly && e.dataTransfer.types.includes(DND_MIME)) e.preventDefault();
  };
  const onDrop = (e: DragEvent) => {
    const data = e.dataTransfer.getData(DND_MIME);
    if (!data || mode !== 'place' || useUi.getState().viewOnly) return; // 보기 전용: 카탈로그 추가·드래그 금지(스펙 §32)
    e.preventDefault();
    const [productId, variantId] = data.split('|');
    const p = toPlan(e);
    store.getState().addItem(productId, variantId, { x: Math.round(p.x), y: Math.round(p.y) });
  };

  return (
    <div className={`editor2d mode-${mode}`} onDragOver={onDragOver} onDrop={onDrop}>
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
          <Overlays2D px={px} />
          <Items2D px={px} />
          <Walls2D px={px} />
          <Openings2D px={px} />
          <Fixtures2D />
          <RoomVertexHandles px={px} />
          <ToolPreview px={px} wallPoints={wallPoints} areaPoints={areaPoints} cursor={cursor} />
        </svg>
      </SvgContext.Provider>
    </div>
  );
}
