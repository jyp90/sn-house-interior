import { useRef, useState, type ChangeEvent } from 'react';
import homePreset from 'virtual:home-preset';
import { backgroundForNewImage, calibrationResult, SCALE_TOLERANCE, scaleText } from '../editor2d/calibration';
import { FLOOR_MATERIALS, FinishPicker, WALL_MATERIALS } from './FinishPicker';
import { FLOOR_PRESETS, planFinish, WALL_PRESETS } from '../materials/presets';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { prepareHomePreset } from '../persistence/homePreset';
import { getDefaultImageStore, saveBackgroundImage } from '../persistence/images';
import { NumberField } from './fields';
import { useUi, type Tool } from './uiStore';

const TOOLS: [Tool, string][] = [
  ['select', '선택'],
  ['wall', '벽 그리기'],
  ['room', '방 만들기'],
  ['door', '문'],
  ['middle-door', '중문'],
  ['window', '창'],
  ['opening', '개구부'],
  ['label', '방 이름'],
  ['area', '영역'],
];

function DraftNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <label className="field">
      {label}
      <span className="field-input">
        <input
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value);
            if (Number.isInteger(v) && v >= 1 && v <= 5000) onChange(v);
          }}
        />
        <span className="unit">cm</span>
      </span>
    </label>
  );
}

function CalibrationForm() {
  const store = usePlanStore();
  const calibration = useUi((s) => s.calibration);
  const [len, setLen] = useState('');
  if (!calibration) return null;
  const ui = useUi.getState();
  const label = calibration.target === 'primary' ? '축척 보정' : '검증 길이';
  if (calibration.points.length < 2) {
    return (
      <div className="calib">
        <p className="muted">{label}: 도면에서 길이를 아는 두 점을 클릭하세요 ({calibration.points.length}/2)</p>
        <button type="button" onClick={() => ui.cancelCalibration()}>취소</button>
      </div>
    );
  }
  const apply = () => {
    const bg = store.getState().plan.background;
    const v = Number(len);
    if (!bg || !(v > 0)) {
      ui.showBanner({ kind: 'error', text: '실제 길이를 cm 단위 양수로 입력하세요.' });
      return;
    }
    const r = calibrationResult(bg, calibration, v);
    if (!r) {
      ui.showBanner({ kind: 'error', text: '두 점이 같거나 기준 축척이 없어 보정할 수 없습니다.' });
      return;
    }
    store.getState().updateBackground(r.background);
    if (r.mismatch !== null && r.mismatch > SCALE_TOLERANCE) {
      ui.showBanner({
        kind: 'error',
        text: `검증 길이와 축척이 ${(r.mismatch * 100).toFixed(1)}% 다릅니다. 도면이 왜곡됐을 수 있어 배경 정렬은 근사치입니다.`,
      });
    }
    ui.cancelCalibration();
  };
  return (
    <div className="calib">
      <label className="field">
        {label}: 두 점 사이 실제 길이
        <span className="field-input">
          <input inputMode="numeric" aria-label="실제 길이" value={len} onChange={(e) => setLen(e.target.value)} />
          <span className="unit">cm</span>
        </span>
      </label>
      <div className="row">
        <button type="button" onClick={apply}>적용</button>
        <button type="button" onClick={() => ui.cancelCalibration()}>취소</button>
      </div>
    </div>
  );
}

export function StructurePanel() {
  const store = usePlanStore();
  const bg = usePlan((s) => s.plan.background);
  const finish = usePlan((s) => s.plan.finish);
  const tool = useUi((s) => s.tool);
  const calibration = useUi((s) => s.calibration);
  const wallDraft = useUi((s) => s.wallDraft);
  const roomDraft = useUi((s) => s.roomDraft);
  const areaTarget = useUi((s) => s.areaTarget);
  const ui = useUi.getState();
  const fileRef = useRef<HTMLInputElement>(null);

  const onImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      ui.showBanner({ kind: 'error', text: 'PNG 또는 JPG 이미지만 불러올 수 있습니다.' });
      return;
    }
    try {
      const img = await saveBackgroundImage(getDefaultImageStore(), file);
      const r = backgroundForNewImage(store.getState().plan.background, img);
      store.getState().setBackground(r.background);
      ui.showBanner({
        kind: 'info',
        text: r.kept ? '배경 이미지를 바꿨습니다. 기존 축척·위치를 유지합니다.' : '배경 이미지를 불러왔습니다. "축척 보정"으로 실제 길이를 맞추세요.',
      });
    } catch {
      ui.showBanner({ kind: 'error', text: '이미지를 불러오지 못했습니다.' });
    }
  };

  const onHomePreset = async () => {
    if (!homePreset) return;
    const r = await prepareHomePreset(homePreset, getDefaultImageStore());
    if (!r.ok) {
      ui.showBanner({ kind: 'error', text: `우리 집 기본 평면을 읽을 수 없습니다: ${r.error}` });
      return;
    }
    if (calibration) ui.cancelCalibration();
    store.getState().replacePlan(r.plan);
    ui.showBanner(
      r.imageMissing
        ? { kind: 'error', text: '우리 집 기본 평면을 불러왔지만 평면도 이미지는 찾지 못했습니다. private/home-floorplan.jpg를 확인하세요.' }
        : { kind: 'info', text: '우리 집 기본 평면을 불러왔습니다. Ctrl+Z로 되돌릴 수 있습니다.' },
    );
  };

  return (
    <div className="structure">
      {homePreset && (
        <>
          <h3>기본 평면</h3>
          <button type="button" onClick={onHomePreset}>우리 집 기본 평면 불러오기</button>
          <p className="muted">로컬 실행 전용입니다. 현재 평면을 덮어씁니다.</p>
        </>
      )}
      <h3>도구</h3>
      <div className="tool-grid">
        {TOOLS.map(([t, label]) => (
          <button key={t} type="button" aria-pressed={tool === t} onClick={() => ui.setTool(t)}>{label}</button>
        ))}
      </div>
      {tool === 'wall' && (
        <fieldset>
          <DraftNumber label="벽 두께" value={wallDraft.thickness} onChange={(v) => ui.setWallDraft({ thickness: v })} />
          <DraftNumber label="높이" value={wallDraft.height} onChange={(v) => ui.setWallDraft({ height: v })} />
          <p className="muted">클릭으로 점을 찍고 더블클릭·Enter·Esc로 끝냅니다.</p>
        </fieldset>
      )}
      {tool === 'room' && (
        <fieldset>
          <label className="field">
            이름
            <input
              defaultValue={roomDraft.name}
              onChange={(e) => {
                if (e.target.value.trim()) ui.setRoomDraft({ name: e.target.value.trim() });
              }}
            />
          </label>
          <DraftNumber label="내측 가로 W" value={roomDraft.w} onChange={(v) => ui.setRoomDraft({ w: v })} />
          <DraftNumber label="내측 세로 D" value={roomDraft.d} onChange={(v) => ui.setRoomDraft({ d: v })} />
          <DraftNumber label="벽 두께" value={roomDraft.thickness} onChange={(v) => ui.setRoomDraft({ thickness: v })} />
          <DraftNumber label="높이" value={roomDraft.height} onChange={(v) => ui.setRoomDraft({ height: v })} />
          <p className="muted">방의 왼쪽 위 안쪽 모서리를 클릭하세요.</p>
        </fieldset>
      )}
      {(tool === 'door' || tool === 'middle-door' || tool === 'window' || tool === 'opening') && (
        <p className="muted">벽 위를 클릭하면 놓입니다. 크기와 위치는 오른쪽 속성창에서 바꿉니다.</p>
      )}
      {tool === 'label' && <p className="muted">방 이름을 놓을 곳을 클릭하세요.</p>}
      {tool === 'area' && (
        <p className="muted">
          {areaTarget ? '이 방의 바닥 꼭짓점을 차례로 클릭하세요.' : '바닥 꼭짓점을 차례로 클릭하세요.'} 첫 점을 다시 클릭하거나 Enter로 닫고, Esc로 취소합니다.
        </p>
      )}

      <h3>배경 도면</h3>
      <button type="button" onClick={() => fileRef.current?.click()}>이미지 불러오기</button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden data-testid="open-background" onChange={onImage} />
      {bg && (
        <>
          <label className="field">
            투명도
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={bg.opacity}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                store.getState().beginDrag();
              }}
              onPointerUp={() => store.getState().endDrag()}
              onPointerCancel={() => store.getState().endDrag()}
              onChange={(e) => store.getState().updateBackground({ opacity: Number(e.target.value) })}
            />
          </label>
          <NumberField
            label="배경 X"
            unit="cm"
            value={Math.round(bg.offsetX)}
            onCommit={(v) => store.getState().updateBackground({ offsetX: v })}
          />
          <NumberField
            label="배경 Y"
            unit="cm"
            value={Math.round(bg.offsetY)}
            onCommit={(v) => store.getState().updateBackground({ offsetY: v })}
          />
          <p className="muted" data-testid="scale-info">{scaleText(bg)}</p>
          <div className="row">
            <button type="button" aria-pressed={calibration?.target === 'primary'} onClick={() => ui.startCalibration('primary')}>축척 보정</button>
            <button type="button" disabled={!bg.calibration} aria-pressed={calibration?.target === 'check'} onClick={() => ui.startCalibration('check')}>검증 길이</button>
            <button type="button" className="danger" onClick={() => { if (calibration) ui.cancelCalibration(); store.getState().setBackground(undefined); }}>배경 제거</button>
          </div>
          <CalibrationForm key={`${calibration?.target ?? 'none'}-${calibration?.points.length === 0}`} />
        </>
      )}

      <h3>기본 마감</h3>
      <FinishPicker label="기본 바닥재" value={planFinish({ finish }).floor} presets={FLOOR_PRESETS} materials={FLOOR_MATERIALS} onChange={(floor) => store.getState().setPlanFinish({ floor })} />
      <FinishPicker label="기본 벽 마감" value={planFinish({ finish }).wall} presets={WALL_PRESETS} materials={WALL_MATERIALS} onChange={(wall) => store.getState().setPlanFinish({ wall })} />
    </div>
  );
}
