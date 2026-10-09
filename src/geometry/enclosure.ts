import type { Vec2, Wall } from '../model/schema';
import { tJunctionCorners, wallFaceCorners } from '../editor2d/snapping';
import { axes, corners, type OBB } from './obb';
import { isSimplePolygon, isValidPolygon } from './polygon';
import { wallDir, wallLength, wallObb } from './walls';

// 닫힌 벽 영역 자동 인식(스펙 §35.2): 격자 flood fill → 외곽 고리 → 마감면 모서리로 스냅

const OBB_TOL = 0.5;

type Grid = { ox: number; oy: number; cols: number; rows: number; cell: number; blocked: Uint8Array };

function pointInObb(p: Vec2, o: OBB): boolean {
  const [u, v] = axes(o);
  const dx = p.x - o.cx;
  const dy = p.y - o.cy;
  const lx = dx * u.x + dy * u.y;
  const ly = dx * v.x + dy * v.y;
  return Math.abs(lx) <= o.hw + OBB_TOL && Math.abs(ly) <= o.hd + OBB_TOL;
}

// 벽 전체 바운딩 박스를 한 칸씩 넓힌 격자. 테두리 칸은 항상 벽 밖이다
function buildGrid(walls: Wall[], cell: number): Grid | null {
  const obbs = walls.map(wallObb);
  if (obbs.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of obbs) {
    for (const c of corners(o)) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
  }
  const ox = minX - cell;
  const oy = minY - cell;
  const cols = Math.ceil((maxX - minX) / cell) + 2;
  const rows = Math.ceil((maxY - minY) / cell) + 2;
  const blocked = new Uint8Array(cols * rows);
  for (const o of obbs) {
    // 이 벽이 덮을 수 있는 칸 범위만 검사
    const cs = corners(o);
    const i0 = Math.max(0, Math.floor((Math.min(...cs.map((c) => c.x)) - OBB_TOL - ox) / cell));
    const i1 = Math.min(cols - 1, Math.floor((Math.max(...cs.map((c) => c.x)) + OBB_TOL - ox) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(...cs.map((c) => c.y)) - OBB_TOL - oy) / cell));
    const j1 = Math.min(rows - 1, Math.floor((Math.max(...cs.map((c) => c.y)) + OBB_TOL - oy) / cell));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (blocked[j * cols + i]) continue;
        if (pointInObb({ x: ox + (i + 0.5) * cell, y: oy + (j + 0.5) * cell }, o)) blocked[j * cols + i] = 1;
      }
    }
  }
  return { ox, oy, cols, rows, cell, blocked };
}

// 씨앗 칸부터 4방향 채움. 테두리 칸에 닿으면(벽이 안 닫힘) null
function floodFill(g: Grid, seed: Vec2): Uint8Array | null {
  const si = Math.floor((seed.x - g.ox) / g.cell);
  const sj = Math.floor((seed.y - g.oy) / g.cell);
  if (si < 0 || sj < 0 || si >= g.cols || sj >= g.rows) return null;
  if (g.blocked[sj * g.cols + si]) return null;
  const filled = new Uint8Array(g.cols * g.rows);
  const stack: number[] = [sj * g.cols + si];
  filled[stack[0]] = 1;
  while (stack.length > 0) {
    const idx = stack.pop()!;
    const i = idx % g.cols;
    const j = (idx - i) / g.cols;
    if (i === 0 || j === 0 || i === g.cols - 1 || j === g.rows - 1) return null;
    for (const n of [idx - 1, idx + 1, idx - g.cols, idx + g.cols]) {
      if (filled[n] || g.blocked[n]) continue;
      filled[n] = 1;
      stack.push(n);
    }
  }
  return filled;
}

// 채운 칸의 바깥 변을 방향 있는 선분으로 모아(채운 칸이 항상 같은 쪽) 고리로 잇고, 변이 가장 많은 고리를 격자 좌표로 돌려준다
function outerLoop(g: Grid, filled: Uint8Array): Vec2[] {
  const W = g.cols + 1;
  const vkey = (x: number, y: number) => y * W + x;
  const edges = new Map<number, number[]>(); // 시작 꼭짓점 → 끝 꼭짓점들
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = vkey(x0, y0);
    const list = edges.get(k);
    if (list) list.push(vkey(x1, y1));
    else edges.set(k, [vkey(x1, y1)]);
  };
  for (let j = 0; j < g.rows; j++) {
    for (let i = 0; i < g.cols; i++) {
      if (!filled[j * g.cols + i]) continue;
      if (!filled[(j - 1) * g.cols + i]) add(i, j, i + 1, j);
      if (!filled[j * g.cols + i + 1]) add(i + 1, j, i + 1, j + 1);
      if (!filled[(j + 1) * g.cols + i]) add(i + 1, j + 1, i, j + 1);
      if (!filled[j * g.cols + i - 1]) add(i, j + 1, i, j);
    }
  }
  let best: number[] = [];
  for (const [start, outs] of edges) {
    while (outs.length > 0) {
      const loop: number[] = [start];
      let cur = outs.pop()!;
      while (cur !== start) {
        loop.push(cur);
        const next = edges.get(cur);
        if (!next || next.length === 0) break;
        cur = next.pop()!;
      }
      if (cur === start && loop.length > best.length) best = loop;
    }
  }
  return best.map((k) => ({ x: k % W, y: (k - (k % W)) / W }));
}

function cross(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

// 연속 중복 꼭짓점과 공선 꼭짓점 제거(변화가 없을 때까지)
function simplify(pts: Vec2[]): Vec2[] {
  let out = pts;
  let changed = true;
  while (changed && out.length >= 3) {
    changed = false;
    const next: Vec2[] = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length];
      const b = out[i];
      const c = out[(i + 1) % out.length];
      if ((a.x === b.x && a.y === b.y) || cross(a, b, c) === 0) {
        changed = true;
        continue;
      }
      next.push(b);
    }
    out = next;
  }
  return out;
}

type FaceLine = { axis: 'x' | 'y'; at: number; lo: number; hi: number };

// 축 정렬 벽의 양쪽 마감면: axis='x'면 x=at(세로 벽), 'y'면 y=at(가로 벽); lo..hi는 벽 길이 범위
function axisFaceLines(walls: Wall[]): FaceLine[] {
  const out: FaceLine[] = [];
  for (const w of walls) {
    if (wallLength(w) === 0) continue;
    const u = wallDir(w);
    const half = w.thickness / 2;
    if (u.y === 0) {
      const lo = Math.min(w.a.x, w.b.x) - half;
      const hi = Math.max(w.a.x, w.b.x) + half;
      out.push({ axis: 'y', at: w.a.y - half, lo, hi }, { axis: 'y', at: w.a.y + half, lo, hi });
    } else if (u.x === 0) {
      const lo = Math.min(w.a.y, w.b.y) - half;
      const hi = Math.max(w.a.y, w.b.y) + half;
      out.push({ axis: 'x', at: w.a.x - half, lo, hi }, { axis: 'x', at: w.a.x + half, lo, hi });
    }
  }
  return out;
}

function snapVertex(p: Vec2, cornerPts: Vec2[], faces: FaceLine[], tol: number): Vec2 {
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (const c of cornerPts) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d <= tol && d < bestD) {
      best = c;
      bestD = d;
    }
  }
  if (best) return { ...best };
  let x = p.x;
  let y = p.y;
  let dx = Infinity;
  let dy = Infinity;
  for (const f of faces) {
    if (f.axis === 'x') {
      if (p.y < f.lo - tol || p.y > f.hi + tol) continue;
      const d = Math.abs(f.at - p.x);
      if (d <= tol && d < dx) {
        dx = d;
        x = f.at;
      }
    } else {
      if (p.x < f.lo - tol || p.x > f.hi + tol) continue;
      const d = Math.abs(f.at - p.y);
      if (d <= tol && d < dy) {
        dy = d;
        y = f.at;
      }
    }
  }
  return { x, y };
}

export function enclosedPolygon(seed: Vec2, walls: Wall[], cellCm = 5): Vec2[] | null {
  const grid = buildGrid(walls, cellCm);
  if (!grid) return null;
  const filled = floodFill(grid, seed);
  if (!filled) return null;
  const loop = outerLoop(grid, filled).map((p) => ({ x: grid.ox + p.x * cellCm, y: grid.oy + p.y * cellCm }));
  const coarse = simplify(loop);
  if (coarse.length < 3) return null;
  const tol = 1.5 * cellCm;
  const cornerPts = [...wallFaceCorners(walls), ...tJunctionCorners(walls)];
  const faces = axisFaceLines(walls);
  const snapped = coarse.map((p) => snapVertex(p, cornerPts, faces, tol)).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  const pts = simplify(snapped);
  if (!isValidPolygon(pts) || !isSimplePolygon(pts)) return null;
  return pts;
}
