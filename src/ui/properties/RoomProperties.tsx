import type { Room } from '../../model/schema';
import { areaM2 } from '../../geometry/polygon';
import { FLOOR_MATERIALS, FinishPicker, WALL_MATERIALS } from '../FinishPicker';
import { FLOOR_PRESETS, roomFloor, roomWall, WALL_PRESETS } from '../../materials/presets';
import { usePlan, usePlanStore } from '../../model/StoreContext';
import { useUi } from '../uiStore';
import { NumberField, TextField } from '../fields';

export function RoomProperties({ room }: { room: Room }) {
  const s = usePlanStore().getState();
  const finish = usePlan((st) => st.plan.finish);
  const plan = { finish };
  return (
    <>
      <h3>방 이름</h3>
      <TextField key={`${room.id}-name`} label="이름" value={room.name} onCommit={(name) => s.updateRoom(room.id, { name })} />
      <NumberField key={`${room.id}-x`} label="X" unit="cm" value={room.label.x} onCommit={(x) => s.updateRoom(room.id, { label: { ...room.label, x } })} />
      <NumberField key={`${room.id}-y`} label="Y" unit="cm" value={room.label.y} onCommit={(y) => s.updateRoom(room.id, { label: { ...room.label, y } })} />
      <h3>바닥 영역</h3>
      {room.polygon ? (
        <p className="muted">꼭짓점 {room.polygon.length}개 · {areaM2(room.polygon)}㎡</p>
      ) : (
        <p className="muted">영역이 없습니다. 바닥재·벽지를 보려면 영역을 그리세요.</p>
      )}
      <button type="button" onClick={() => useUi.getState().startArea(room.id)}>
        {room.polygon ? '영역 다시 그리기' : '영역 그리기'}
      </button>
      <FinishPicker label="바닥재" value={roomFloor(room, plan)} presets={FLOOR_PRESETS} materials={FLOOR_MATERIALS} onChange={(floor) => s.setRoomFinish(room.id, { floor })} />
      <FinishPicker label="벽 마감" value={roomWall(room, plan)} presets={WALL_PRESETS} materials={WALL_MATERIALS} onChange={(wall) => s.setRoomFinish(room.id, { wall })} />
      <button type="button" className="danger" onClick={() => s.removeRoom(room.id)}>방 삭제</button>
    </>
  );
}
