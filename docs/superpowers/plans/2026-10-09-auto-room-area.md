# Plan: 배경 흑백화·닫힌 벽 영역 자동 인식 (spec §35)

Branch `feat/auto-room-area`, worktree `~/Projects/homefit-auto-room-area`. Read spec §35 first (`docs/superpowers/specs/2026-10-08-homefit-design.md`), then §19.2–19.3 for the existing area/finish flow. TDD: failing test → implement → green. `npm run typecheck && npm test` must stay green after each task.

## Task 1 — `src/geometry/enclosure.ts` + test (spec §35.2)
- `enclosedPolygon(seed, walls, cellCm = 5): Vec2[] | null` exactly as §35.2 (grid flood fill, leak → null, outer loop, collinear removal, snap to `wallFaceCorners`/`tJunctionCorners` from `editor2d/snapping.ts` then axis-aligned face lines, validate with `geometry/polygon.ts`).
- Note: `editor2d/snapping.ts` is React-free; importing it from `geometry/` is acceptable, but if it pulls React deps move the two corner helpers into `geometry/` and re-export from `snapping.ts`.
- Tests: `SAMPLE_PLAN` (`src/model/samplePlan.ts`) r1 seed (175,200) → `[(10,10),(344,10),(344,390),(10,390)]` (order may rotate/reverse; compare as a set + length 4), r2 seed; L-shape (3 walls + partial partition) → 6 vertices; door on partition still a boundary; remove w3 → null; seed inside w5 → null.

## Task 2 — store actions + tests (spec §35.2)
- `autoRoomPolygon(id)`, `autoRoomPolygons()` in `src/model/store.ts` (one commit each; existing polygons untouched; label kept if inside). Tests in `src/model/store.test.ts`: success, failure leaves plan identical and no history entry, undo restores, bulk skips rooms with polygon.

## Task 3 — UI + background grayscale (spec §35.1, §35.2 UI)
- `BackgroundImage.tsx`: `style={{ filter: 'grayscale(1)' }}` on `<image>`.
- `RoomProperties.tsx`: 「영역 자동 인식」/「영역 다시 인식」 button (structure mode), failure banner text from spec.
- `StructurePanel.tsx`: 「영역 없는 방 자동 인식」 button above 「기본 마감」, disabled when every room has a polygon, result banner (`kind: 'info'` success / `'error'` when any failed; check `Banner` kinds in `uiStore.ts`).
- e2e case appended to `e2e/roomFinish.spec.ts` per §35.4. Check `lsof -i :5180` free before `npm run e2e`.

## Task 4 — home preset polygons (spec §35.2 last bullet)
- Script (scratch, not committed) that loads `home/plan.json`, runs `enclosedPolygon` per room with `room.label`, writes polygons back (keep key order, 2-space JSON, trailing newline as file has now). All 8 rooms must succeed; 거실(확장) must span x≈10..504, y≈396..680 (inner faces). Add a test that reads `home/plan.json` via `fs` and asserts every room has a polygon and the plan parses (`persistence/parse.ts`).

## Task 5 — docs
- `src/MODULE-MAP.md`: lines for `geometry/enclosure.ts`, store actions, UI buttons, BackgroundImage grayscale.
