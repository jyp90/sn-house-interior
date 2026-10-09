import { describe, expect, it } from 'vitest';
import type { Opening, Wall } from '../model/schema';
import { FRAME_CM, GLASS_CM, HANDLE_H_CM, LEAF_CM, openingParts } from './openingParts';

const wall: Wall = { id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 };

const door: Opening = {
  id: 'o',
  wallId: 'w',
  kind: 'door',
  offset: 100,
  width: 90,
  height: 210,
  sill: 0,
  hinge: 'start',
  swingIn: true,
};

const byKind = (parts: ReturnType<typeof openingParts>, kind: string) => parts.filter((p) => p.kind === kind);

describe('openingParts', () => {
  it('single door (외여닫이): 틀 3 + 문짝 1 + 손잡이 1', () => {
    const parts = openingParts(wall, door);
    expect(byKind(parts, 'frame')).toHaveLength(3);
    expect(byKind(parts, 'leaf')).toHaveLength(1);
    expect(byKind(parts, 'handle')).toHaveLength(1);

    const leaf = byKind(parts, 'leaf')[0];
    expect(leaf.cx).toBeCloseTo(145);
    expect(leaf.cy).toBeCloseTo(0);
    expect(leaf.w).toBeCloseTo(89);
    expect(leaf.h).toBeCloseTo(204);
    expect(leaf.yCenter).toBeCloseTo(102);
    expect(leaf.d).toBeCloseTo(4);
    expect(leaf.angle).toBeCloseTo(0);
    expect(leaf.glassLeaf).toBeFalsy();

    const handle = byKind(parts, 'handle')[0];
    expect(handle.cx).toBeCloseTo(184);
    expect(handle.yCenter).toBeCloseTo(HANDLE_H_CM);

    const left = byKind(parts, 'frame').find((p) => p.cx < 145)!;
    expect(left.cx).toBeCloseTo(102.5);

    const head = byKind(parts, 'frame').find((p) => p.w === 80)!;
    expect(head).toBeDefined();
    expect(head.cx).toBeCloseTo(145);
    expect(head.yCenter).toBeCloseTo(207.5);
  });

  it('double door (양여닫이): 문짝 2개, 폭 59씩', () => {
    const parts = openingParts(wall, { ...door, width: 120, leaves: 'double' });
    const leaves = byKind(parts, 'leaf');
    expect(leaves).toHaveLength(2);
    expect(leaves[0].w).toBeCloseTo(59);
    expect(leaves[1].w).toBeCloseTo(59);
    // second leaf centre at offset + 120 - 30
    expect(leaves[1].cx).toBeCloseTo(100 + 120 - 30);
  });

  it('asym door (비대칭): 2/3, 1/3 폭', () => {
    const parts = openingParts(wall, { ...door, width: 120, leaves: 'asym', hinge: 'start' });
    const leaves = byKind(parts, 'leaf');
    expect(leaves).toHaveLength(2);
    expect(leaves[0].w).toBeCloseTo(79); // big = round(80) - 1
    expect(leaves[1].w).toBeCloseTo(39);
  });

  it('middle door (중문): glassLeaf true', () => {
    const parts = openingParts(wall, { ...door, middle: true });
    const leaf = byKind(parts, 'leaf')[0];
    expect(leaf.glassLeaf).toBe(true);
  });

  it('window: 틀 4(아래틀 포함), 유리, 멀리온 없음(폭 100)', () => {
    const window: Opening = {
      id: 'o2',
      wallId: 'w',
      kind: 'window',
      offset: 200,
      width: 100,
      height: 120,
      sill: 90,
      hinge: 'start',
      swingIn: true,
    };
    const parts = openingParts(wall, window);
    expect(byKind(parts, 'frame')).toHaveLength(4);
    const jambs = byKind(parts, 'frame').filter((p) => p.h === 120);
    expect(jambs).toHaveLength(2);
    expect(jambs[0].yCenter).toBeCloseTo(150);
    const head = byKind(parts, 'frame').find((p) => p.yCenter > 150)!;
    expect(head.yCenter).toBeCloseTo(207.5);
    const bottomRail = byKind(parts, 'frame').find((p) => p.yCenter < 150)!;
    expect(bottomRail.yCenter).toBeCloseTo(92.5);

    const glass = byKind(parts, 'glass')[0];
    expect(glass.w).toBeCloseTo(90);
    expect(glass.h).toBeCloseTo(110);
    expect(glass.yCenter).toBeCloseTo(150);
    expect(glass.d).toBeCloseTo(GLASS_CM);
    expect(byKind(parts, 'mullion')).toHaveLength(0);
  });

  it('window width 150: 멀리온 1개, 중심 275', () => {
    const window: Opening = {
      id: 'o3',
      wallId: 'w',
      kind: 'window',
      offset: 200,
      width: 150,
      height: 120,
      sill: 90,
      hinge: 'start',
      swingIn: true,
    };
    const parts = openingParts(wall, window);
    const mullion = byKind(parts, 'mullion');
    expect(mullion).toHaveLength(1);
    expect(mullion[0].cx).toBeCloseTo(275);
  });

  it('vertical wall: leaf cx/cy/angle reflect wall direction', () => {
    const vwall: Wall = { id: 'vw', a: { x: 0, y: 0 }, b: { x: 0, y: 400 }, thickness: 10, height: 230 };
    const parts = openingParts(vwall, door);
    const leaf = byKind(parts, 'leaf')[0];
    expect(leaf.cx).toBeCloseTo(0);
    expect(leaf.cy).toBeCloseTo(145);
    expect(leaf.angle).toBeCloseTo(Math.PI / 2);
  });

  it('opening kind: 부품 없음', () => {
    const parts = openingParts(wall, { ...door, kind: 'opening' });
    expect(parts).toEqual([]);
  });

  it('FRAME_CM/LEAF_CM constants', () => {
    expect(FRAME_CM).toBe(5);
    expect(LEAF_CM).toBe(4);
  });
});
