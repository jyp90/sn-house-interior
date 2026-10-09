import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { DEFAULT_FINISH, FLOOR_PRESETS, WALL_PRESETS, finishLabel, planFinish, roomFloor, roomWall } from './presets';

describe('presets', () => {
  it('프리셋 id는 겹치지 않고 색은 #rrggbb', () => {
    for (const list of [FLOOR_PRESETS, WALL_PRESETS]) {
      expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
      for (const p of list) expect(p.finish.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it('기본 마감은 평면 finish가 없으면 DEFAULT_FINISH', () => {
    expect(planFinish(SAMPLE_PLAN)).toEqual(DEFAULT_FINISH);
    const custom = { floor: { material: 'tile' as const, color: '#b8b5ae' }, wall: { material: 'paint' as const, color: '#ffffff' } };
    expect(planFinish({ finish: custom })).toEqual(custom);
  });
  it('방 마감이 없으면 평면 기본값을 쓴다', () => {
    const room = SAMPLE_PLAN.rooms[0];
    expect(roomFloor(room, SAMPLE_PLAN)).toEqual(DEFAULT_FINISH.floor);
    expect(roomWall({ ...room, wall: { material: 'paint', color: '#c7cfbf' } }, SAMPLE_PLAN)).toEqual({ material: 'paint', color: '#c7cfbf' });
  });
  it('finishLabel: 프리셋이면 재질 · 라벨, 아니면 재질 · hex', () => {
    expect(finishLabel(DEFAULT_FINISH.floor)).toBe('마루 · 내추럴 오크');
    expect(finishLabel(DEFAULT_FINISH.wall)).toBe('페인트 · 화이트');
    expect(finishLabel({ material: 'tile', color: '#123456' })).toBe('타일 · #123456');
    expect(finishLabel({ material: 'wallpaper', color: '#e8dcc8' })).toBe('벽지 · 베이지');
    expect(finishLabel({ material: 'plain', color: '#ffffff' })).toBe('단색 · #ffffff');
  });
});
