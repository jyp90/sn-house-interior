import type * as THREE from 'three';

export function itemIdsFromIntersections(hits: { object: THREE.Object3D }[]): string[] {
  const ids: string[] = [];
  for (const hit of hits) {
    let o: THREE.Object3D | null = hit.object;
    while (o && typeof o.userData.itemId !== 'string') o = o.parent;
    const id: unknown = o?.userData.itemId;
    if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
