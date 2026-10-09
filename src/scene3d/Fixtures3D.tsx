import { useMemo } from 'react';
import * as THREE from 'three';
import { ceilingHeightCm } from '../catalog/elevation';
import { usePlan } from '../model/StoreContext';
import { cmToM } from '../model/units';
import { type FixturePart, fixtureParts } from './fixtureParts';

// 재질은 색별로 공유·캐시한다(Openings3D와 같은 방식). 지오메트리는 JSX로 둬 R3F가 언마운트 시 해제하게 한다
const materials = new Map<string, THREE.MeshStandardMaterial>();
function materialFor(color: string): THREE.MeshStandardMaterial {
  let m = materials.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    materials.set(color, m);
  }
  return m;
}

// 설비는 클릭을 가로채지 않는다(spec §27.3) — 3D 클릭은 아이템 선택·빈 곳 선택 해제만 다룬다
const noRaycast = () => null;

function Part({ part }: { part: FixturePart }) {
  return (
    <mesh
      position={[cmToM(part.cx), cmToM(part.yCenter), cmToM(part.cy)]}
      rotation={[0, -part.angle, 0]}
      material={materialFor(part.color)}
      raycast={noRaycast}
    >
      {part.kind === 'disc' ? (
        <cylinderGeometry args={[cmToM(part.w / 2), cmToM(part.w / 2), cmToM(part.h), 24]} />
      ) : (
        <boxGeometry args={[cmToM(part.w), cmToM(part.h), cmToM(part.d)]} />
      )}
    </mesh>
  );
}

export function Fixtures3D() {
  const walls = usePlan((s) => s.plan.walls);
  const fixtures = usePlan((s) => s.plan.fixtures);
  const groups = useMemo(() => {
    const ceiling = ceilingHeightCm({ walls });
    return fixtures.map((f) => ({ id: f.id, parts: fixtureParts(f, walls, ceiling) }));
  }, [fixtures, walls]);

  return (
    <group>
      {groups.map((g) => (
        <group key={g.id}>
          {g.parts.map((part, i) => (
            <Part key={i} part={part} />
          ))}
        </group>
      ))}
    </group>
  );
}
