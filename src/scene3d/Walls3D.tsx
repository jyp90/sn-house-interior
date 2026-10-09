import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { wallPieces, type WallPiece } from '../geometry/walls';
import { planFinish, roomWall } from '../materials/presets';
import { wallTexture } from '../materials/textures';
import { WALL_TOP_COLOR, wallFaceSegments, type FaceSegment } from '../materials/wallFaces';
import { usePlan, usePlanStore } from '../model/StoreContext';
import type { Room, WallFinish } from '../model/schema';
import { cmToM } from '../model/units';
import { useUi } from '../ui/uiStore';

// 같은 마감을 쓰는 조각끼리 재질 하나를 공유한다. 마감 종류·색 조합은 몇 개뿐이라 앱 수명 동안 캐시해 둔다
const materials = new Map<string, THREE.MeshStandardMaterial>();
const TOP = new THREE.MeshStandardMaterial({ color: WALL_TOP_COLOR, roughness: 0.9 });

function wallMaterial(finish: WallFinish): THREE.MeshStandardMaterial {
  const key = `${finish.material}:${finish.color}`;
  let m = materials.get(key);
  if (!m) {
    const tex = wallTexture(finish);
    m = new THREE.MeshStandardMaterial({ color: tex ? '#ffffff' : finish.color, roughness: 0.9 });
    if (tex) {
      // 캐시된 원본 텍스처는 공유되므로 복제해서 repeat를 정한다(이 복제본은 재질과 함께 캐시에 남는다)
      const t = tex.texture.clone();
      t.needsUpdate = true;
      t.repeat.set(1 / cmToM(tex.sizeCm.w), 1 / cmToM(tex.sizeCm.h));
      m.map = t;
    }
    materials.set(key, m);
  }
  return m;
}

// BoxGeometry의 UV는 면마다 0..1 이라, 면의 실제 크기(m)를 곱해 1 UV = 1 m 로 맞춘다(무늬 크기가 조각 길이와 무관해짐)
function wallGeometry(w: number, h: number, d: number): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  // 면 순서 [+x, -x, +y, -y, +z, -z], 면당 정점 4개
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  }
  uv.needsUpdate = true;
  return g;
}

// 측면 띠가 벽 상자 면에서 떨어지는 거리(m). 0.1cm면 겹침 깜빡임(z-fighting) 없이 보이지 않을 만큼 얇다
const STRIP_OFFSET_M = cmToM(0.1);

// 측면 한 구간을 덮는 얇은 판. u0 = 상자 면 UV와 이어지도록 맞춘 시작 위치(m)
function FaceStrip({ w, h, x, z, back, u0, material }: { w: number; h: number; x: number; z: number; back: boolean; u0: number; material: THREE.Material }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * w, uv.getY(i) * h);
    uv.needsUpdate = true;
    return g;
  }, [w, h, u0]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={[x, 0, z]} rotation={[0, back ? Math.PI : 0, 0]} material={material} />;
}

type Side = { segs: FaceSegment[]; finishOf: (r: Room) => WallFinish };

function WallMesh({ piece, front, back, base }: { piece: WallPiece; front: Side; back: Side; base: WallFinish }) {
  const { obb, y0, y1 } = piece;
  const w = cmToM(obb.hw * 2);
  const h = cmToM(y1 - y0);
  const d = cmToM(obb.hd * 2);
  const geometry = useMemo(() => wallGeometry(w, h, d), [w, h, d]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const baseMat = wallMaterial(base);
  const baseKey = `${base.material}:${base.color}`;
  // 회전 -angle 후 로컬 +x = 평면 u, 로컬 +z = 평면 +v = wallFaceSegments의 front 쪽.
  // 상자 측면은 기본 마감이고, 기본과 다른 방 마감 구간만 얇은 띠로 덮는다
  const strips = ([[front, false], [back, true]] as const).flatMap(([side, isBack]) =>
    side.segs.flatMap((seg, k) => {
      if (!seg.room) return [];
      const f = side.finishOf(seg.room);
      if (`${f.material}:${f.color}` === baseKey) return [];
      const sw = cmToM(seg.e - seg.s);
      // 상자 +z 면의 u는 -hw 쪽에서, -z 면의 u는 +hw 쪽에서 시작한다
      const u0 = isBack ? cmToM(obb.hw - seg.e) : cmToM(seg.s + obb.hw);
      return [
        <FaceStrip
          key={`${isBack ? 'b' : 'f'}${k}`}
          w={sw}
          h={h}
          x={cmToM((seg.s + seg.e) / 2)}
          z={(isBack ? -1 : 1) * (d / 2 + STRIP_OFFSET_M)}
          back={isBack}
          u0={u0}
          material={wallMaterial(f)}
        />,
      ];
    }),
  );
  return (
    <group position={[cmToM(obb.cx), cmToM((y0 + y1) / 2), cmToM(obb.cy)]} rotation={[0, -obb.angle, 0]}>
      <mesh geometry={geometry} material={[baseMat, baseMat, TOP, baseMat, baseMat, baseMat]} />
      {strips}
    </group>
  );
}

export function Walls3D() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const openings = usePlan((s) => s.plan.openings);
  const rooms = usePlan((s) => s.plan.rooms);
  const finish = usePlan((s) => s.plan.finish);
  const pieces = useMemo(
    () => walls.flatMap((w) => wallPieces(w, openings.filter((o) => o.wallId === w.id))),
    [walls, openings],
  );
  const faces = useMemo(() => pieces.map((p) => wallFaceSegments(p.obb, rooms)), [pieces, rooms]);
  const base = planFinish({ finish }).wall;
  const finishOf = (r: Room) => roomWall(r, { finish });
  return (
    <group
      onClick={() => {
        store.getState().select(null);
        useUi.getState().clearCandidates();
      }}
    >
      {pieces.map((p, i) => (
        <WallMesh
          key={i}
          piece={p}
          base={base}
          front={{ segs: faces[i].front, finishOf }}
          back={{ segs: faces[i].back, finishOf }}
        />
      ))}
    </group>
  );
}
