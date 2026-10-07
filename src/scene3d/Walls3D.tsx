import { useMemo } from 'react';
import { wallPieces } from '../geometry/walls';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { cmToM } from '../model/units';
import { useUi } from '../ui/uiStore';

export function Walls3D() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const openings = usePlan((s) => s.plan.openings);
  const pieces = useMemo(
    () => walls.flatMap((w) => wallPieces(w, openings.filter((o) => o.wallId === w.id))),
    [walls, openings],
  );
  return (
    <group
      onClick={() => {
        store.getState().select(null);
        useUi.getState().clearCandidates();
      }}
    >
      {pieces.map((p, i) => (
        <mesh key={i} position={[cmToM(p.obb.cx), cmToM((p.y0 + p.y1) / 2), cmToM(p.obb.cy)]} rotation={[0, -p.obb.angle, 0]}>
          <boxGeometry args={[cmToM(p.obb.hw * 2), cmToM(p.y1 - p.y0), cmToM(p.obb.hd * 2)]} />
          <meshStandardMaterial color="#f4f1ec" />
        </mesh>
      ))}
    </group>
  );
}
