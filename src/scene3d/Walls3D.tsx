import { useMemo } from 'react';
import { wallPieces } from '../geometry/walls';
import { usePlan } from '../model/StoreContext';

export function Walls3D() {
  const walls = usePlan((s) => s.plan.walls);
  const openings = usePlan((s) => s.plan.openings);
  const pieces = useMemo(
    () => walls.flatMap((w) => wallPieces(w, openings.filter((o) => o.wallId === w.id))),
    [walls, openings],
  );
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} position={[p.obb.cx / 100, (p.y0 + p.y1) / 200, p.obb.cy / 100]} rotation={[0, -p.obb.angle, 0]}>
          <boxGeometry args={[(p.obb.hw * 2) / 100, (p.y1 - p.y0) / 100, (p.obb.hd * 2) / 100]} />
          <meshStandardMaterial color="#f4f1ec" />
        </mesh>
      ))}
    </group>
  );
}
