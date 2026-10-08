import { Grid, Html } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { planBounds } from '../geometry/bounds';
import { planFinish, roomFloor } from '../materials/presets';
import { floorTexture } from '../materials/textures';
import { usePlan, usePlanStore } from '../model/StoreContext';
import type { FloorFinish, Room, Vec2 } from '../model/schema';
import { cmToM } from '../model/units';
import { useUi } from '../ui/uiStore';
import { toWorld } from './units';

function RoomFloor({ polygon, finish }: { polygon: Vec2[]; finish: FloorFinish }) {
  const store = usePlanStore();
  const geometry = useMemo(() => {
    // 평면 (x, y) → 로컬 (x, -y) 로 만들고 rotation.x = -π/2 로 눕히면 월드 (x, 0, y), 앞면이 위(+y)를 본다
    const shape = new THREE.Shape(polygon.map((p) => new THREE.Vector2(cmToM(p.x), -cmToM(p.y))));
    return new THREE.ShapeGeometry(shape);
  }, [polygon]);
  const material = useMemo(() => {
    const tex = floorTexture(finish);
    const m = new THREE.MeshStandardMaterial({ color: tex ? '#ffffff' : finish.color, roughness: 0.85 });
    if (tex) {
      // ShapeGeometry의 UV는 로컬 좌표(m) 그대로이므로 1 반복 = 무늬 크기(m)
      const t = tex.texture.clone();
      t.needsUpdate = true;
      t.repeat.set(1 / cmToM(tex.sizeCm.w), 1 / cmToM(tex.sizeCm.h));
      m.map = t;
    }
    return m;
  }, [finish.material, finish.color]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material],
  );
  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation-x={-Math.PI / 2}
      position={[0, 0.002, 0]}
      onClick={() => {
        store.getState().select(null);
        useUi.getState().clearCandidates();
      }}
    />
  );
}

export function Floor() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const rooms = usePlan((s) => s.plan.rooms);
  const finish = usePlan((s) => s.plan.finish);
  const baseColor = planFinish({ finish }).floor.color;
  const b = useMemo(() => planBounds({ walls }), [walls]);
  const margin = 200;
  const w = cmToM(b.maxX - b.minX + margin * 2);
  const d = cmToM(b.maxY - b.minY + margin * 2);
  const cx = cmToM((b.minX + b.maxX) / 2);
  const cz = cmToM((b.minY + b.maxY) / 2);
  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[cx, 0, cz]}
        onClick={() => {
          store.getState().select(null);
          useUi.getState().clearCandidates();
        }}
      >
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={baseColor} />
      </mesh>
      <Grid position={[cx, 0.001, cz]} args={[w, d]} cellSize={0.1} sectionSize={1} cellColor="#d6cfc2" sectionColor="#b9b0a0" fadeDistance={60} />
      {rooms
        .filter((r): r is Room & { polygon: Vec2[] } => !!r.polygon)
        .map((r) => (
          <RoomFloor key={r.id} polygon={r.polygon} finish={roomFloor(r, { finish })} />
        ))}
      {rooms.map((r) => (
        <Html key={r.id} position={toWorld(r.label, 1)} center className="room-label">
          {r.name}
        </Html>
      ))}
    </group>
  );
}
