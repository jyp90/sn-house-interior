import { useSyncExternalStore } from 'react';
import { getLabels, subscribeLabels } from './labelBridge';

/** Canvas 밖: 투영된 3D 라벨을 뷰포트 위에 일반 DOM으로 그린다 */
export function LabelOverlay() {
  const labels = useSyncExternalStore(subscribeLabels, getLabels);
  return (
    <>
      {labels.map((l) => (
        <div
          key={`${l.kind}-${l.key}`}
          className={l.kind === 'room' ? 'room-label label-3d' : 'dist-label label-3d'}
          style={{ left: l.x, top: l.y }}
        >
          {l.text}
        </div>
      ))}
    </>
  );
}
