import type { FloorFinish, Plan, PlanFinish, Room, WallFinish } from '../model/schema';

export type FloorPreset = { id: string; label: string; finish: FloorFinish };
export type WallPreset = { id: string; label: string; finish: WallFinish };

export const FLOOR_PRESETS: readonly FloorPreset[] = [
  { id: 'oak-natural', label: '내추럴 오크', finish: { material: 'wood', color: '#c9a06c' } },
  { id: 'oak-white', label: '화이트 오크', finish: { material: 'wood', color: '#e2d3b6' } },
  { id: 'walnut', label: '월넛', finish: { material: 'wood', color: '#7a5230' } },
  { id: 'porcelain-grey', label: '그레이 포세린', finish: { material: 'tile', color: '#b8b5ae' } },
  { id: 'mosaic-white', label: '화이트 모자이크', finish: { material: 'tile', color: '#ececea' } },
];

export const WALL_PRESETS: readonly WallPreset[] = [
  { id: 'white', label: '화이트', finish: { material: 'paint', color: '#f4f1ec' } },
  { id: 'warm-grey', label: '웜 그레이', finish: { material: 'paint', color: '#d9d3ca' } },
  { id: 'beige', label: '베이지', finish: { material: 'wallpaper', color: '#e8dcc8' } },
  { id: 'sage', label: '세이지', finish: { material: 'wallpaper', color: '#c7cfbf' } },
];

export const DEFAULT_FINISH: PlanFinish = { floor: FLOOR_PRESETS[0].finish, wall: WALL_PRESETS[0].finish };

export function planFinish(plan: Pick<Plan, 'finish'>): PlanFinish {
  return plan.finish ?? DEFAULT_FINISH;
}
export function roomFloor(room: Room, plan: Pick<Plan, 'finish'>): FloorFinish {
  return room.floor ?? planFinish(plan).floor;
}
export function roomWall(room: Room, plan: Pick<Plan, 'finish'>): WallFinish {
  return room.wall ?? planFinish(plan).wall;
}

const MATERIAL_LABEL: Record<FloorFinish['material'] | WallFinish['material'], string> = {
  wood: '마루',
  tile: '타일',
  plain: '단색',
  paint: '페인트',
  wallpaper: '벽지',
};

function presetLabel(finish: FloorFinish | WallFinish): string | undefined {
  const presets: readonly { finish: FloorFinish | WallFinish; label: string }[] =
    finish.material === 'paint' || finish.material === 'wallpaper' ? WALL_PRESETS : FLOOR_PRESETS;
  const color = finish.color.toLowerCase();
  return presets.find((p) => p.finish.material === finish.material && p.finish.color.toLowerCase() === color)?.label;
}

// PDF 표용: 프리셋이면 「재질 · 라벨」, 아니면 「재질 · #rrggbb」
export function finishLabel(finish: FloorFinish | WallFinish): string {
  return `${MATERIAL_LABEL[finish.material]} · ${presetLabel(finish) ?? finish.color}`;
}
