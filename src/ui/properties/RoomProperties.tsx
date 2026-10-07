import type { Room } from '../../model/schema';
import { usePlanStore } from '../../model/StoreContext';
import { NumberField, TextField } from '../fields';

export function RoomProperties({ room }: { room: Room }) {
  const s = usePlanStore().getState();
  return (
    <>
      <h3>방 이름</h3>
      <TextField key={`${room.id}-name`} label="이름" value={room.name} onCommit={(name) => s.updateRoom(room.id, { name })} />
      <NumberField key={`${room.id}-x`} label="X" unit="cm" value={room.label.x} onCommit={(x) => s.updateRoom(room.id, { label: { ...room.label, x } })} />
      <NumberField key={`${room.id}-y`} label="Y" unit="cm" value={room.label.y} onCommit={(y) => s.updateRoom(room.id, { label: { ...room.label, y } })} />
      <button type="button" className="danger" onClick={() => s.removeRoom(room.id)}>방 이름 삭제</button>
    </>
  );
}
