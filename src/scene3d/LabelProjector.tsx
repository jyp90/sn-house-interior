import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import { projectToScreen, publishLabels, type LabelKind, type ScreenLabel, type WorldLabel } from './labelBridge';

/** Canvas 안: 매 프레임 월드 라벨을 화면 px로 투영해 labelBridge에 올린다(같으면 알리지 않음) */
export function LabelProjector({ kind, labels }: { kind: LabelKind; labels: WorldLabel[] }) {
  useFrame(({ camera, size }) => {
    const out: ScreenLabel[] = [];
    for (const l of labels) {
      const p = projectToScreen(l.position, camera, size);
      if (p) out.push({ key: l.key, kind, text: l.text, x: Math.round(p.x), y: Math.round(p.y) });
    }
    publishLabels(kind, out);
  });
  useEffect(() => () => publishLabels(kind, []), [kind]);
  return null;
}
