# src module map

One or two lines per module; grep, never read whole. Tests sit next to the module as `*.test.ts`.

## model/
- `schema.ts` — zod schemas for `Plan` (version 4) and every entity (walls, openings incl. door `middle`/`leaves`, rooms incl. optional `polygon`/`floor`/`wall` finish, items, layouts, fixtures, checklist state, plan-level `finish`); types derive from here.
- `store.ts` — `createPlanStore`: zustand vanilla store, plan + selection + undo/redo (`HISTORY_LIMIT`); every edit action is one undo step. Room area/finish actions: `addRoomArea`, `setRoomPolygon`, `setRoomFinish`, `setPlanFinish`, `dragRoomVertex` (uses `beginDrag`/`endDrag` like `dragEndpoint`).
- `StoreContext.tsx` — `usePlanStore` / `usePlan` React bindings.
- `layout.ts` — `activeItems` / `withActiveItems` (only item access path), layout naming, `compareItems` for the A/B overlay.
- `entities.ts` — `findEntity` across walls/openings/rooms/items/fixtures by id.
- `units.ts` — `cmToM` / `mToCm`; the only cm↔m conversion.
- `samplePlan.ts` — anonymous `SAMPLE_PLAN` bundled in the app (never our home).
- `useValidation.ts` — memoised `validatePlan` over the current plan.
- `ids.ts` — `newId`.

## geometry/ (pure)
- `obb.ts` — 2D OBB + SAT overlap, `itemObb`.
- `walls.ts` — wall pieces split by openings, wall OBBs for collision.
- `clearance.ts` — product front clearance shapes; `doorLeaves` (per-leaf door swing: single / double / asym, spec §16) and `doorSwings` for the plan.
- `distance.ts` — 4-direction nearest-wall rays for the selected item.
- `snap.ts` — item-to-wall snap (`WALL_SNAP_CM`).
- `structure.ts` — room-rect → walls, fit/refit openings, endpoint move, wall length; called by store actions.
- `pick.ts` — items under a point (candidate picker).
- `bounds.ts` — plan bounds/center for view fitting.
- `wallReference.ts` — "벽 기준 위치" text for PDF/built-in detail.
- `polygon.ts` — area/centroid/point-in-polygon/validity for room floor polygons.

## validation/
- `validate.ts` — `validatePlan` → per-item status (`collides`, `clearanceBlocked`, `blocksDoor`) with `conflicts` reasons.
- `describe.ts` — `conflictLines`: Korean text for the warning detail.

## materials/
- `presets.ts` — floor/wall finish presets, DEFAULT_FINISH, roomFloor/roomWall fallbacks (spec §18.1).
- `pattern.ts` — React-free `patternSpec(finish)` (wood: 120×15 planks, 4 staggered rows; tile: 60×60 with 0.3cm grout; plain: null) and `shade(hex, amount)` color helper, used by `editor2d/floorPattern.tsx`.

## persistence/
- `parse.ts` — `parsePlan` (zod + `migrate` by `version`, `CURRENT_VERSION` 4; v2→v3, v3→v4 bump only).
- `storage.ts` — localStorage read/save, invalid-plan backup, `startAutosave` (debounced).
- `revisions.ts` — local revision snapshots (max 20, auto interval).
- `images.ts` — background image store (IndexedDB, memory fallback), downscale to `MAX_IMAGE_PX`.
- `file.ts` — JSON/Blob download helpers.
- `homePreset.ts` — applies `virtual:home-preset` (dev-only, `private/`) as the initial plan + background (`HOME_IMAGE_REF`).

## editor2d/ (SVG, coordinates = plan cm)
- `Editor2D.tsx` — the 2D editor root; layers `Walls2D`, `Openings2D` (per-leaf swings, glass leaf + 「중문」 label for middle doors), `Rooms2D`, `Items2D`, `Fixtures2D`, `Overlays2D`, `ToolPreview` (incl. `areaPoints` for the area tool), `BackgroundImage`.
- `Rooms2D.tsx` — draws `room.polygon` floors (`floorFill`/`FloorPatternDefs` from `floorPattern.tsx`) under the room name labels, selected-room outline, and draggable `VertexHandle`s per polygon point (structure mode + select tool only; snaps via `snapToEndpoint`/`areaSnapPoints`, commits through `dragRoomVertex`).
- `floorPattern.tsx` — React layer over `materials/pattern.ts`: `floorPatternId(roomId)`, `FloorPatternDefs({ rooms, plan })` (one `<pattern>` per room with a polygon), `floorFill(room, plan)` → pattern url or flat color for `plain`.
- `tools.ts` — tool click handling (wall, opening, room, fixture, area) and `finishWall`; `middle-door` tool places a `door` with `MIDDLE_DOOR_DEFAULTS` (120cm, asym, middle). `area` tool: `areaSnapPoints`/`areaToolPoint` snap to wall endpoints, `corners(wallObb(w))`, and `wallFaceCorners`; `finishArea` closes via `setRoomPolygon`/`addRoomArea` using `areaTarget`, bannering on < 3 vertices.
- `snapping.ts` — angle and endpoint snap for wall drawing; `wallFaceCorners(walls)` intersects the two finish-face lines of each pair of walls sharing an endpoint (spec §18.1 inner-corner snap for the area tool).
- `calibration.ts` — scale from two points, verification length mismatch (`SCALE_TOLERANCE` 2%).
- `viewBox.ts` — fit, zoom, pan; `svgPoint.ts` client → plan coords; `svg.ts` path helpers; `itemColor.ts` item fill.
- `useBackgroundUrl.ts` — object URL for the stored background image.

## scene3d/ (R3F, 1 unit = 1 m)
- `Viewport.tsx` — canvas root (always mounted, `active` prop); `Walls3D`, `Floor`, `Items3D`, `Overlays`.
- `CameraRig.tsx` + `cameraFit.ts` — perspective/top views, fit, fixed PDF poses (`pdfViewPoses`).
- `DropBridge.tsx` — catalog drag → floor point; `pick3d.ts` intersections → item ids.
- `CaptureBridge.tsx` — 3D PNG captures for PNG/PDF export.
- `units.ts` — plan (x, y) → world (x, 0, y), sector args.

## catalog/
- `products.ts` — `CATALOG` product data (dimensions, clearance, power) and categories.
- `builders/` — procedural THREE.Group per builder id (`fridge`, `frontLoader`, `tv`, `sofa`, `bed`, `table`, `box`); `index.ts` dispatches and disposes. Missing builders: spec §7 (plan 5).

## electrical/
- `fixtures.ts` — fixture kinds, labels, glyphs, default heights, wall snap, `missingDedicatedCircuit` (150 cm radius).

## checklist/
- `defaults.ts` — phases and default on-site inspection items (`i-` ids).
- `items.ts` — `autoChecklist` from the plan + merged `checklistItems` with saved state.

## quote/
- `request.ts` — quote request data for the PDF (groups, questions, spec decisions, photo requests). No budget amounts.

## export/
- `pages.ts` — pure plan → PDF page data (wrapping, table pagination, quote pages).
- `pdf.ts` — jsPDF + svg2pdf.js renderer (lazy); `pdfFont.ts` Pretendard loading with retry error.
- `planSvg.ts` — standalone SVG of the plan for PNG/PDF (labels with halo, unverified marks, item numbers, per-leaf door swings, middle-door glass leaves + 「중문」).
- `exportPdf.ts` — orchestrates 3D captures + render; `png.ts` SVG/canvas → PNG blob with header lines.

## devserver/ (Node, dev server only)
- `selfUpdate.ts` — 「업데이트」 server logic: upstream check, dirty refusal, `fetch` + `merge --ff-only`, `npm install` on package changes, same-origin + header guard; wired as the `homefit-self-update` plugin in `vite.config.ts` (`/__homefit/update`, then `server.restart()`).

## ui/
- `uiStore.ts` — screen state (mode, view, tool, drafts, candidates, save status, banner). `area` tool: `areaTarget` (room id or null) + `startArea(roomId)`; cleared to `null` by `setMode`/`setTool`/`setFixtureTool`/`cancelCalibration`.
- `modes.ts` — mode list and per-mode rules; `shortcuts.ts` keyboard shortcuts (undo works while a button has focus).
- Panels: `Toolbar`, `LayoutBar`, `StructurePanel` (tools incl. 「중문」), `CatalogPanel`, `CustomBoxForm`, `ElectricPanel`, `HistoryPanel`, `ChecklistView`, `ExportView`, `ExportButtons`, `PropertiesPanel` (+ `properties/*Properties.tsx`; `OpeningProperties` has 중문 checkbox + 문짝 select for doors), `CandidatePicker`, `Banner`, `UpdateButton` (dev only).
- `Toolbar` ends with the `글꼴 라이선스` link → `public/licenses/Pretendard-OFL.txt` via `import.meta.env.BASE_URL` (deploy design §9).
- `fields.tsx` — number/text/checkbox inputs with units; `saveLabel.ts` "저장됨 HH:MM" text; `dnd.ts` catalog drag MIME; `selfUpdateClient.ts` update request, banner text, wait-for-restart poll.

## scripts/ (Node, outside the app bundle)
- `check-dist.ts` — post-build Pages bundle guard: no images, no home-preset markers, all index.html refs under `/sn-house-interior/` (deploy design §7). `npm run check:dist`.
- Base path `/sn-house-interior/` applies to build and preview only (`vite.config.ts`); `npm run e2e:preview` (`playwright.preview.config.ts`, `e2e-preview/`) checks fonts and the license link under that base on port 5181.
- Base `/sn-house-interior/` is repeated in `vite.config.ts`, `scripts/check-dist.ts` `BASE`, `playwright.preview.config.ts`, `e2e-preview/base-path.spec.ts`; change all four together.
- `.github/workflows/pages.yml` — on `main` push: typecheck → unit → build → `check:dist` → `deploy-pages`. No e2e in CI.
