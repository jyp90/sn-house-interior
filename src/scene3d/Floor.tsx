import { Grid, Html } from '@react-three/drei';
import { useMemo } from 'react';
import { planBounds } from '../geometry/bounds';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { cmToM } from '../model/units';
import { toWorld } from './units';

export function Floor() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const rooms = usePlan((s) => s.plan.rooms);
  const b = useMemo(() => planBounds({ walls }), [walls]);
  const margin = 200;
  const w = cmToM(b.maxX - b.minX + margin * 2);
  const d = cmToM(b.maxY - b.minY + margin * 2);
  const cx = cmToM((b.minX + b.maxX) / 2);
  const cz = cmToM((b.minY + b.maxY) / 2);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0, cz]} onClick={() => store.getState().select(null)}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#e8e2d6" />
      </mesh>
      <Grid position={[cx, 0.001, cz]} args={[w, d]} cellSize={0.1} sectionSize={1} cellColor="#d6cfc2" sectionColor="#b9b0a0" fadeDistance={60} />
      {rooms.map((r) => (
        <Html key={r.id} position={toWorld(r.label, 1)} center className="room-label">
          {r.name}
        </Html>
      ))}
    </group>
  );
}
