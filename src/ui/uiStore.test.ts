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
});
