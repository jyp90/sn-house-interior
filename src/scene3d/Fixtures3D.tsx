import { useMemo } from 'react';
import * as THREE from 'three';
import { ceilingHeightCm } from '../catalog/elevation';
import { usePlan } from '../model/StoreContext';
import { cmToM } from '../model/units';
import { type FixturePart, fixtureParts } from './fixtureParts';

// 재질은 색·발광·투명도별로 공유·캐시한다(Openings3D와 같은 방식). 지오메트리는 JSX로 둬 R3F가 언마운트 시 해제하게 한다
const materials = new Map<string, THREE.MeshStandardMaterial>();
function materialFor(part: FixturePart): THREE.MeshStandardMaterial {
  const key = `${part.color}|${part.emissive ?? ''}|${part.opacity ?? 1}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: part.color,
      roughness: 0.7,
      ...(part.emissive ? { emissive: part.emissive, emissiveIntensity: 0.9 } : {}),
      ...(part.opacity !== undefined && part.opacity < 1 ? { transparent: true, opacity: part.opacity } : {}),
    });
    materials.set(key, m);
  }
  return m;
}

// 설비는 클릭을 가로채지 않는다(spec §27.3) — 3D 클릭은 아이템 선택·빈 곳 선택 해제만 다룬다
const noRaycast = () => null;

const HALF_PI = Math.PI / 2;

function Part({ part }: { part: FixturePart }) {
  const round = part.kind === 'disc' || part.kind === 'cylinder';
  // 벽 법선 축 원기둥: y축 원기둥을 x축으로 90° 눕히면 로컬 z(= 법선) 방향이 된다
  const rotation: [number, number, number] =
    part.kind === 'cylinder' && part.axis === 'normal' ? [HALF_PI, -part.angle, 0] : [0, -part.angle, 0];
  return (
    <mesh
      position={[cmToM(part.cx), cmToM(part.yCenter), cmToM(part.cy)]}
      rotation={rotation}
      rotation-order="YXZ"
      material={materialFor(part)}
      raycast={noRaycast}
    >
      {round ? (
        <cylinderGeometry args={[cmToM(part.rTop ?? part.w / 2), cmToM(part.w / 2), cmToM(part.h), 24]} />
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
