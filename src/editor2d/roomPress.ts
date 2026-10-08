// 방 영역/이름을 누른 포인터 이벤트를 표시한다. 방은 선택하되 이벤트 전파는 막지 않아,
// svg의 onPointerDown이 선택 해제는 건너뛰고 화면 이동(pan)은 그대로 시작할 수 있게 한다
const pressed = new WeakSet<Event>();

export function markRoomPress(e: Event): void {
  pressed.add(e);
}

export function isRoomPress(e: Event): boolean {
  return pressed.has(e);
}
