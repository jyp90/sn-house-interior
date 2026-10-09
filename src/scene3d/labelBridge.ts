import * as THREE from 'three';

// 3D 라벨(방 이름·벽 간격)을 Canvas 밖 DOM 오버레이로 그리기 위한 다리.
// drei `Html`은 라벨마다 중첩 React 루트를 만들어 React 19 StrictMode에서 라벨을 잃는다(spec §22).
export type LabelKind = 'room' | 'dist';

export interface WorldLabel {
  key: string;
  text: string;
  /** 월드 좌표(m) */
  position: [number, number, number];
}

export interface ScreenLabel {
  key: string;
  kind: LabelKind;
  text: string;
  /** 뷰포트 왼쪽 위 기준 px */
  x: number;
  y: number;
}

/** 월드 좌표를 뷰포트 px로. 카메라 뒤(또는 far 너머)나 화면 밖이면 null */
export function projectToScreen(
  position: [number, number, number],
  camera: THREE.Camera,
  size: { width: number; height: number },
): { x: number; y: number } | null {
  const v = new THREE.Vector3(...position).project(camera);
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || v.z < -1 || v.z > 1) return null;
  const x = ((v.x + 1) / 2) * size.width;
  const y = ((1 - v.y) / 2) * size.height;
  // 가장자리 반올림 오차(0.5px)는 화면 안으로 본다
  if (x < -0.5 || x > size.width + 0.5 || y < -0.5 || y > size.height + 0.5) return null;
  return { x, y };
}

const groups = new Map<LabelKind, ScreenLabel[]>();
let snapshot: ScreenLabel[] = [];
const listeners = new Set<() => void>();

function same(a: ScreenLabel[], b: ScreenLabel[]): boolean {
  return a.length === b.length && a.every((l, i) => l.key === b[i].key && l.text === b[i].text && l.x === b[i].x && l.y === b[i].y);
}

export function publishLabels(kind: LabelKind, labels: ScreenLabel[]): void {
  if (same(groups.get(kind) ?? [], labels)) return;
  if (labels.length) groups.set(kind, labels);
  else groups.delete(kind);
  snapshot = [...(groups.get('room') ?? []), ...(groups.get('dist') ?? [])];
  listeners.forEach((l) => l());
}

export function subscribeLabels(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLabels(): ScreenLabel[] {
  return snapshot;
}
