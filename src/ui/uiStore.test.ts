import { beforeEach, describe, expect, it } from 'vitest';
import { useUi } from './uiStore';

beforeEach(() => useUi.setState(useUi.getInitialState(), true));

describe('useUi', () => {
  it('모드를 바꾸면 도구가 선택으로 돌아간다', () => {
    useUi.getState().setTool('wall');
    useUi.getState().setMode('structure');
    expect(useUi.getState()).toMatchObject({ mode: 'structure', tool: 'select' });
  });

  it('축척 보정 점은 두 개까지만 받는다', () => {
    useUi.getState().startCalibration('primary');
    for (const x of [0, 10, 20]) useUi.getState().addCalibrationPoint({ x, y: 0 });
    expect(useUi.getState().calibration?.points).toHaveLength(2);
    expect(useUi.getState().tool).toBe('calibrate');
    useUi.getState().cancelCalibration();
    expect(useUi.getState()).toMatchObject({ calibration: null, tool: 'select' });
  });

  it('스냅 토글과 시점 초기화 키', () => {
    useUi.getState().toggleSnap();
    useUi.getState().resetView();
    expect(useUi.getState()).toMatchObject({ snap: false, viewResetKey: 1 });
  });

  it('초안 값은 부분 수정된다', () => {
    useUi.getState().setRoomDraft({ w: 500 });
    expect(useUi.getState().roomDraft).toMatchObject({ w: 500, d: 300, name: '방' });
  });

  it('이력 패널 열고 닫기', () => {
    useUi.getState().setHistoryOpen(true);
    expect(useUi.getState().historyOpen).toBe(true);
    useUi.getState().setHistoryOpen(false);
    expect(useUi.getState().historyOpen).toBe(false);
  });

  it('비교 대상 배치안 설정과 해제', () => {
    useUi.getState().setCompareLayout('layout-b');
    expect(useUi.getState().compareLayoutId).toBe('layout-b');
    useUi.getState().setCompareLayout(null);
    expect(useUi.getState().compareLayoutId).toBeNull();
  });

  it('설비 도구를 고르면 도구가 fixture가 되고 종류를 기억한다', () => {
    useUi.getState().setFixtureTool('switch');
    expect(useUi.getState()).toMatchObject({ tool: 'fixture', fixtureKind: 'switch' });
    useUi.getState().setMode('electric');
    expect(useUi.getState()).toMatchObject({ mode: 'electric', tool: 'select', fixtureKind: 'switch' });
  });

  it('startArea는 이미 area 도구여도 매번 새 영역 세션을 연다', () => {
    useUi.getState().startArea('r1');
    const first = useUi.getState().areaSession;
    useUi.getState().startArea('r1');
    expect(useUi.getState()).toMatchObject({ tool: 'area', areaTarget: 'r1', areaSession: first + 1 });
  });

  it('측정 클릭은 시작점 → 끝점 → 새 시작점 순서로 쌓인다', () => {
    const ui = useUi.getState();
    ui.setTool('measure');
    ui.measureClick({ x: 0, y: 0 });
    expect(useUi.getState().measure).toEqual({ a: { x: 0, y: 0 }, b: null });
    ui.measureClick({ x: 300, y: 0 });
    expect(useUi.getState().measure).toEqual({ a: { x: 0, y: 0 }, b: { x: 300, y: 0 } });
    ui.measureClick({ x: 50, y: 50 });
    expect(useUi.getState().measure).toEqual({ a: { x: 50, y: 50 }, b: null });
    ui.clearMeasure();
    expect(useUi.getState()).toMatchObject({ measure: null, tool: 'measure' });
  });

  it('도구나 모드를 바꾸면 측정이 지워진다', () => {
    useUi.getState().setTool('measure');
    useUi.getState().measureClick({ x: 0, y: 0 });
    useUi.getState().setTool('select');
    expect(useUi.getState().measure).toBeNull();
    useUi.getState().setTool('measure');
    useUi.getState().measureClick({ x: 0, y: 0 });
    useUi.getState().setMode('structure');
    expect(useUi.getState()).toMatchObject({ measure: null, tool: 'select' });
  });

  it('시작점과 같은 자리를 다시 클릭해도 끝점은 고정되지 않는다', () => {
    const ui = useUi.getState();
    ui.setTool('measure');
    ui.measureClick({ x: 0, y: 0 });
    ui.measureClick({ x: 0, y: 0 });
    expect(useUi.getState().measure).toEqual({ a: { x: 0, y: 0 }, b: null });
  });

  it('보기 전용(모바일) 설정과 해제', () => {
    expect(useUi.getState().viewOnly).toBe(false);
    useUi.getState().setViewOnly(true);
    expect(useUi.getState().viewOnly).toBe(true);
    useUi.getState().setViewOnly(false);
    expect(useUi.getState().viewOnly).toBe(false);
  });

  it('보기 전용으로 들어가면 도구·초안 상태가 모두 선택으로 돌아간다', () => {
    const ui = useUi.getState();
    ui.setTool('wall');
    ui.startCalibration('primary');
    ui.showCandidates({ ids: ['a', 'b'], clientX: 0, clientY: 0 });
    ui.setViewOnly(true);
    expect(useUi.getState()).toMatchObject({
      viewOnly: true,
      tool: 'select',
      calibration: null,
      areaTarget: null,
      measure: null,
      candidates: null,
    });
  });

  it('모바일 배치 아이템 목록은 기본 접힘이고 토글된다(데스크톱 itemListOpen과 별개)', () => {
    expect(useUi.getState().mobileItemListOpen).toBe(false);
    expect(useUi.getState().itemListOpen).toBe(true);
    useUi.getState().setMobileItemListOpen(true);
    expect(useUi.getState()).toMatchObject({ mobileItemListOpen: true, itemListOpen: true });
    useUi.getState().setMobileItemListOpen(false);
    expect(useUi.getState().mobileItemListOpen).toBe(false);
  });

  it('배치 아이템 목록 패널은 기본 펼침이고 토글된다', () => {
    expect(useUi.getState().itemListOpen).toBe(true);
    useUi.getState().setItemListOpen(false);
    expect(useUi.getState().itemListOpen).toBe(false);
    useUi.getState().setItemListOpen(true);
    expect(useUi.getState().itemListOpen).toBe(true);
  });
});
