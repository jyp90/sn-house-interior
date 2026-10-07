import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { itemIdsFromIntersections } from './pick3d';

describe('itemIdsFromIntersections', () => {
  it('부모 group의 itemId를 가까운 순서로 중복 없이', () => {
    const a = new THREE.Group();
    a.userData.itemId = 'a';
    const meshA1 = new THREE.Mesh();
    const meshA2 = new THREE.Mesh();
    a.add(meshA1, meshA2);
    const b = new THREE.Group();
    b.userData.itemId = 'b';
    const meshB = new THREE.Mesh();
    b.add(meshB);
    const floor = new THREE.Mesh();
    expect(itemIdsFromIntersections([{ object: meshA1 }, { object: floor }, { object: meshB }, { object: meshA2 }])).toEqual(['a', 'b']);
  });
});
