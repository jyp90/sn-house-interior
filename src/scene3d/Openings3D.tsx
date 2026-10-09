import { useMemo } from 'react';
import * as THREE from 'three';
import { usePlan } from '../model/StoreContext';
import { cmToM } from '../model/units';
import { type OpeningPart, openingParts } from './openingParts';

// 재질은 종류별로 공유·캐시한다(벽 재질과 같은 방식). 지오메트리는 boxGeometry JSX로 둬 R3F가 언마운트 시 해제하게 한다
const frameMaterial = new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.9 });
const middleFrameMaterial = new THREE.MeshStandardMaterial({ color: '#8a8a8a', roughness: 0.9 });
const leafMaterial = new THREE.MeshStandardMaterial({ color: '#d9cdb8', roughness: 0.8 });
const glassMaterial = new THREE.MeshStandardMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.35, roughness: 0.1 });
const handleMaterial = new THREE.MeshStandardMaterial({ color: '#6f6f6f', roughness: 0.6, metalness: 0.3 });

// 문짝·틀·유리는 클릭을 가로채지 않는다 — 3D 클릭은 아이템 선택·빈 곳 선택 해제만 다룬다
const noRaycast = () => null;

function materialFor(part: OpeningPart, isMiddleDoor: boolean): THREE.Material {
  switch (part.kind) {
    case 'frame':
      return isMiddleDoor ? middleFrameMaterial : frameMaterial;
    case 'leaf':
      return part.glassLeaf ? glassMaterial : leafMaterial;
    case 'glass':
      return glassMaterial;
    case 'handle':
      return handleMaterial;
    case 'mullion':
      return isMiddleDoor ? middleFrameMaterial : frameMaterial;
    default:
      return frameMaterial;
  }
}

function Part({ part, isMiddleDoor }: { part: OpeningPart; isMiddleDoor: boolean }) {
  return (
    <mesh
      position={[cmToM(part.cx), cmToM(part.yCenter), cmToM(part.cy)]}
      rotation={[0, -part.angle, 0]}
      material={materialFor(part, isMiddleDoor)}
      raycast={noRaycast}
    >
      <boxGeometry args={[cmToM(part.w), cmToM(part.h), cmToM(part.d)]} />
    </mesh>
  );
}

export function Openings3D() {
  const walls = usePlan((s) => s.plan.walls);
  const openings = usePlan((s) => s.plan.openings);
  const wallById = useMemo(() => new Map(walls.map((w) => [w.id, w])), [walls]);

  const groups = useMemo(
    () =>
      openings.flatMap((o) => {
        const wall = wallById.get(o.wallId);
        if (!wall) return [];
        return [{ id: o.id, parts: openingParts(wall, o), isMiddleDoor: o.kind === 'door' && !!o.middle }];
      }),
    [openings, wallById],
  );

  return (
    <group>
      {groups.map((g) => (
        <group key={g.id}>
          {g.parts.map((part, i) => (
            <Part key={i} part={part} isMiddleDoor={g.isMiddleDoor} />
          ))}
        </group>
      ))}
    </group>
  );
}
