# src module map

One or two lines per module; grep, never read whole. Tests sit next to the module as `*.test.ts`.

## model/
- `schema.ts` — zod schemas for `Plan` (version 6) and every entity (walls, openings incl. door `middle`/`leaves`, rooms incl. optional `polygon`/`floor`/`wall` finish, items incl. optional `note`, layouts, fixtures, checklist state, plan-level `finish`); types derive from here.
- `store.ts` — `createPlanStore`: zustand vanilla store, plan + selection + undo/redo (`HISTORY_LIMIT`); every edit action is one undo step. Room area/finish actions: `addRoomArea`, `setRoomPolygon`, `setRoomFinish`, `setPlanFinish`, `dragRoomVertex` (uses `beginDrag`/`endDrag` like `dragEndpoint`). `updateCustomProduct(id, { name?, w?, d?, h? })` edits `plan.customProducts` only (ignores `CATALOG` ids, invalid name/out-of-range dims). `updateItem`/`normalizeItem` trim `note` and drop the key when blank (spec §26); note stays editable while locked. `setChecklistEntry` also prunes any stored `auto-` entry whose id is no longer produced by `checklist/items.ts`'s `checklistItems` (e.g. a stale 전용회로 warning), so dead auto rows don't linger after the plan changes (spec §31).
- `StoreContext.tsx` — `usePlanStore` / `usePlan` React bindings.
- `layout.ts` — `activeItems` / `withActiveItems` (only item access path), layout naming, `compareItems` for the A/B overlay, `itemNumbers` (item id → PDF/목록 배치도 번호; re-exported from `export/planSvg.ts`).
- `itemList.ts` — `groupItemsByRoom(plan, resolve)`: groups placed items by the room whose `polygon` contains the item center (`pointInPolygon`), `{ room: null }` last; used by `ui/ItemListPanel.tsx` (spec §28).
- `entities.ts` — `findEntity` across walls/openings/rooms/items/fixtures by id.
- `units.ts` — `cmToM` / `mToCm`; the only cm↔m conversion.
- `samplePlan.ts` — anonymous `SAMPLE_PLAN` bundled in the app (never our home).
- `useValidation.ts` — `planValidation(plan)` runs `validatePlan` once per plan object (`WeakMap<Plan, ...>` keyed by identity) so every consumer shares one result; `useValidation()` hook just reads it (spec §30.1).
- `ids.ts` — `newId`.

## geometry/ (pure)
- `vertical.ts` — vertical span overlap (touching ≠ overlap).
- `obb.ts` — 2D OBB + SAT overlap, `itemObb`.
- `walls.ts` — wall pieces split by openings, wall OBBs for collision. `openingObb(w, o)` clamps to `clampToWall` first and returns `null` (not a degenerate OBB) when the opening is fully outside the wall; callers (`Openings2D.tsx`, `export/planSvg.ts`) skip drawing the gap when `null`. `strayOpeningAnchor(w, o)` gives the nearer wall endpoint (`a`/`b`) so `Openings2D.tsx` can still render a selectable/draggable marker for a stray opening (spec §31).
- `clearance.ts` — product front clearance shapes; `doorLeaves` (per-leaf door swing: single / double / asym, spec §16) and `doorSwings` for the plan. `doorLeaves` clamps `o.offset`/`o.width` to the wall via `walls.ts`'s `clampToWall` before computing leaves, so an opening past the wall end stays inside it (spec §30.2).
- `distance.ts` — 4-direction nearest-wall rays for the selected item.
- `snap.ts` — item-to-wall snap (`WALL_SNAP_CM`).
- `structure.ts` — room-rect → walls, fit/refit openings, endpoint move, wall length; called by store actions. `openingNumbers` (id → `D1`/`W1`/`O1` per kind, `plan.openings` order) shared by `export/planSvg.ts` and `export/pages.ts` (spec §25).
- `pick.ts` — items under a point (candidate picker).
- `bounds.ts` — plan bounds/center for view fitting.
- `wallReference.ts` — "벽 기준 위치" text for PDF/built-in detail.
- `polygon.ts` — area/centroid/point-in-polygon/validity for room floor polygons; `isSimplePolygon` rejects crossing or touching non-adjacent edges (spec §22, used by `finishArea`, `addRoomArea`, `setRoomPolygon`, `dragRoomVertex`).

## validation/
- `validate.ts` — `validatePlan` → per-item status (`collides`, `clearanceBlocked`, `blocksDoor`) with `conflicts` reasons. Every obstacle (wall, item, door swing) is also filtered by vertical span (spec §20.2).
- `describe.ts` — `conflictLines`: Korean text for the warning detail.

## materials/
- `presets.ts` — floor/wall finish presets, DEFAULT_FINISH, roomFloor/roomWall fallbacks (spec §19.1); `finishLabel(finish)` → `재질 · 라벨` for a preset or `재질 · #rrggbb` otherwise, used by the PDF 방 마감표 (spec §25).
- `pattern.ts` — React-free `patternSpec(finish)` (wood: 120×15 planks, 4 staggered rows; tile: 60×60 with 0.3cm grout; plain: null) and `shade(hex, amount)` color helper, used by `editor2d/floorPattern.tsx`.
  `wallPatternSpec(finish)` — wallpaper: 2cm faint linen cross-hatch; paint: null.
- `textures.ts` — three CanvasTextures from pattern specs (4 px/cm, RepeatWrapping, sRGB), cached by `material:color`: `floorTexture`/`wallTexture` → `{ texture, sizeCm }` or null; meshes clone and set `repeat = 1/cmToM(size)`.
- `wallFaces.ts` — `wallFaceSegments(obb, rooms)` → `{ front, back }: FaceSegment[]` (`{ s, e, room }`, cm on local u, −hw..+hw): probe line `± v·(hd+1)` cut where it crosses room edges, each interval → room containing its midpoint (first in plan order wins, else null), adjacent equal rooms merged; front = +v = `axes()[1]`. `WALL_TOP_COLOR` `#3f3a33`.

## persistence/
- `parse.ts` — `parsePlan` (zod + `migrate` by `version`, `CURRENT_VERSION` 7; v2→v3, v3→v4, v4→v5, v5→v6, v6→v7 (`Fixture.group`) bump only).
- `storage.ts` — localStorage read/save, invalid-plan backup, `startAutosave` (debounced).
- `revisions.ts` — local revision snapshots (max 20, auto interval).
- `images.ts` — background image store (IndexedDB, memory fallback), downscale to `MAX_IMAGE_PX`.
- `file.ts` — JSON/Blob download helpers.
- `homePreset.ts` — applies `virtual:home-preset` (`home/plan.json` + `home/floorplan.jpg`, dev and build; null in tests / `HOMEFIT_SAMPLE=1`, spec §24) as the initial plan + background (`HOME_IMAGE_REF`).

## editor2d/ (SVG, coordinates = plan cm)
- `Editor2D.tsx` — the 2D editor root; layers `Walls2D`, `Openings2D` (per-leaf swings, glass leaf + 「중문」 label for middle doors), `Rooms2D`, `Items2D`, `Fixtures2D`, `Overlays2D`, `RoomVertexHandles` (top layer, above walls), `ToolPreview` (incl. `areaPoints` for the area tool, live measure line/label for the measure tool), `BackgroundImage`. Select-tool press on a room selects it (`roomPress.ts` WeakSet flag on the native event, no `stopPropagation`) and still starts the pan. Esc on the `measure` tool clears `ui.measure` without leaving the tool (checked before the generic Escape block).
- `Rooms2D.tsx` — draws `room.polygon` floors (`floorFill`/`FloorPatternDefs` from `floorPattern.tsx`) under the room name labels and the selected-room outline; `RoomVertexHandles` (mounted by `Editor2D` as a top layer so handles on walls stay grabbable) draws draggable `VertexHandle`s for the selected room (structure mode + select tool only; snaps via `snapToEndpointGroups` over `areaSnapGroups` computed once at drag start (face corners first), commits through `dragRoomVertex`).
- `floorPattern.tsx` — React layer over `materials/pattern.ts`: `floorPatternId(roomId)`, `FloorPatternDefs({ rooms, plan })` (one `<pattern>` per room with a polygon), `floorFill(room, plan)` → pattern url or flat color for `plain`.
- `tools.ts` — tool click handling (wall, opening, room, fixture, area, measure) and `finishWall`; `middle-door` tool places a `door` with `MIDDLE_DOOR_DEFAULTS` (120cm, asym, middle). `area` tool: `areaSnapGroups` → `faces` (`wallFaceCorners` + `tJunctionCorners`) take priority over `rest` (wall endpoints and `corners(wallObb(w))`, minus points buried inside another wall's OBB); `areaToolPoint`/`areaToolPointFrom` (also used by `ToolPreview`), `areaSnapPoints` = flat list (spec §22); `finishArea` closes via `setRoomPolygon`/`addRoomArea` using `areaTarget`, bannering on < 3 vertices, zero area or crossing edges (「영역 선이 서로 교차합니다.」). `measure` tool (spec §21): `measureSnapPoints`/`measureToolPoint` add placed-item corners (`corners(itemObb(...))` via `findProduct`/`activeItems`) to `areaSnapPoints` and reuse `wallToolPoint` for the 45° end-point snap; clicks go through `ui.measureClick` (a → b → new a).
- `snapping.ts` — angle and endpoint snap for wall drawing; `wallFaceCorners(walls)` intersects the two finish-face lines of each pair of walls sharing an endpoint (spec §19.2 inner-corner snap for the area tool); `tJunctionCorners(walls)` the inner corners where a wall end meets another wall mid-span; `snapToEndpointGroups`/`groupedToolPoint` try candidate groups in priority order (spec §22).
- `calibration.ts` — scale from two points, verification length mismatch (`SCALE_TOLERANCE` 2%); `backgroundForNewImage` keeps scale/offset/calibration when a same-pixel-size image replaces the background (used by `StructurePanel` 이미지 불러오기).
- `viewBox.ts` — fit, zoom, pan; `svgPoint.ts` client → plan coords; `svg.ts` path helpers; `itemColor.ts` item fill.
- `useBackgroundUrl.ts` — object URL for the stored background image.

## scene3d/ (R3F, 1 unit = 1 m)
- `fixtureParts.ts` (pure, tested) + `Fixtures3D.tsx` — electrical fixtures in 3D (spec §27.3): wall-attached outlet/switch = 8×8×1.5 plate (waterproof 10×10) centred 0.75cm out from `pos` along the wall normal facing `pos`, plus a 4×4×0.5 glyph-colour mark on its outer face; light = Ø24×2 disc centred at `min(height, ceiling) − 1 − 1`; unattached/orphaned = 6cm glyph-colour cube. Colour-cached materials, `raycast={() => null}`.
- `Viewport.tsx` — canvas root (always mounted, `active` prop); `Walls3D`, `Openings3D`, `Fixtures3D`, `Floor`, `Items3D`, `Overlays`; warm ambient light + `#efeae2` background (spec §19.3); `<LabelOverlay />` sits next to the canvas.
- `openingParts.ts` (pure, tested) + `Openings3D.tsx` — door frames/leaves/handles and window frames/glass/mullion (spec §23). `openingParts(wall, o)` computes part rects in plan cm from `o.offset`/`leafWidths` (`geometry/clearance.ts`, now exported) directly on the wall centre line — not from `doorLeaves`' hinge, which is offset by `thickness/2` onto the wall face. Opening offset/width/height are clamped to the wall via `geometry/walls.ts`'s exported `clampToWall` (same cut as `wallPieces`) before any part geometry is derived, so an opening past the wall end or taller than the wall is cut. One 2×2cm handle box per leaf (depth `wall.thickness+4`, through both faces); its inset from the visible leaf edge is `FRAME_CM+6` for a single full-width leaf (edge = opposite jamb) or `6` for a double/asym leaf (edge = the other leaf). `Openings3D` renders each part as a `boxGeometry` mesh with module-cached materials per kind (middle-door frame tinted `#8a8a8a`; mullion is always the plain frame color since it only occurs on windows); `raycast={() => null}` so clicks fall through to walls/items/empty-click deselect unchanged.
- `labelBridge.ts` + `LabelProjector.tsx` + `LabelOverlay.tsx` — 3D labels without drei `Html` (spec §22): `LabelProjector` (in Canvas, `useFrame`) projects world labels with `projectToScreen` and `publishLabels(kind)`; `LabelOverlay` (`useSyncExternalStore`) draws `.room-label`/`.dist-label` divs (`.label-3d`, absolute px); off-screen labels are culled and `.viewport` clips with `overflow: hidden`. Room labels from `Floor`, wall-distance labels from `Overlays`.
- `Floor.tsx` — neutral base plane (#e8e2d6; plan default floor applies only to rooms with a polygon) + Grid + `RoomFloor` per room with a polygon: ShapeGeometry from (x, -y) laid with rotation.x = -π/2 → world (x, 0, y), textured by `floorTexture`, DoubleSide, row phase matches the 2D SVG pattern; disposes geometry/material/cloned map on unmount.
- `Walls3D.tsx` — one group per `wallPieces` piece: box with `[base, base, TOP, base, base, base]` (plan default sides/ends/bottom, dark shared `TOP`) plus `FaceStrip` planes 0.1 cm off each side for `wallFaceSegments` intervals whose room's `roomWall` differs from the default (browser-verified: finish changes at the partition). Materials cached module-wide by `material:color` (wallpaper map cloned, repeat 1/m); box and strip UVs in metres, strips offset to continue the box face's u.
- `CameraRig.tsx` + `cameraFit.ts` — perspective/top views, fit, fixed PDF poses (`pdfViewPoses`).
- `DropBridge.tsx` — catalog drag → floor point; `pick3d.ts` intersections → item ids.
- `CaptureBridge.tsx` — 3D PNG captures for PNG/PDF export.
- `units.ts` — plan (x, y) → world (x, 0, y), sector args.

## catalog/
- `products.ts` — `CATALOG` product data (dimensions, clearance, power) and categories.
- `elevation.ts` — effective installation height (item → product → legacy mountHeight → mount rule), ceiling height = max wall height (230 default).
- `builders/` — procedural THREE.Group per builder id (`fridge`, `frontLoader`, `tv`, `sofa`, `bed`, `table`, `box`, `standAc`, `builtInAppliance`, `cabinetRun`, `ceilingAc`, `chair`, `wardrobe`, `toilet`, `basin`, `shower`, `cornerCabinet`); `index.ts` dispatches and disposes. `parts.ts` gained `cylinder`/`glass` primitives. `cornerCabinet.ts` — L-shaped corner cabinet/hood housing (`corner-cabinet` builder, spec §29): two `body` boxes (back/left arms), two `door` panels, `base` part adds one named `counter` group (upper has none).

## electrical/
- `fixtures.ts` — fixture kinds, labels, glyphs, default heights, wall snap, `missingDedicatedCircuit` (150 cm radius) and `missingDedicatedCircuitCached(plan)` (`WeakMap<Plan, string[]>`, resolves via `findProduct`) so `Items2D`/`ItemProperties`/`ElectricPanel` share one computation per plan (spec §30.1). `switchGroups` (switch/light with `group`, name order `ko`) and `switchLinks` (switch × light pairs per group) feed 2D `Fixtures2D` dashed `switch-link-<s>-<l>` lines (electric mode only), `ElectricPanel` 「스위치 그룹」 list, `planSvg` 전기 계획도 dashes, `auto-switch-<h>` checklist item (spec §27).

## checklist/
- `defaults.ts` — phases and default on-site inspection items (`i-` ids).
- `items.ts` — `autoChecklist` from the plan + merged `checklistItems` with saved state. Auto ids carry `shortHash` (`hash.ts`, FNV-1a → base36): `auto-circuit-<h>`/`auto-door-<itemId>-<h>` hash the full text; `auto-builtin-<itemId>-<h>` hashes only name + W×D×H + verified, so moving keeps the check/memo (spec §22); `auto-outlets` stays fixed; `auto-switch-<h>` (full-text hash) lists switch groups (spec §27).

## quote/
- `request.ts` — quote request data for the PDF (groups, questions, spec decisions, photo requests). No budget amounts.

## export/
- `pages.ts` — pure plan → PDF page data (wrapping, table pagination, quote pages, 방 마감표/창호 일람 after 치수 평면도 — spec §25). 배치도 notes append `${number}. ${product.name} — ${item.note}` per noted item, after the fixed notes (spec §26). 전기 설비 목록 has a 「그룹」 column (switch/light only, else `-`; spec §27). `pdfSafe(text)` strips `\p{Extended_Pictographic}`/variation selectors/ZWJ and collapses the resulting double spaces; called from `wrapText` so every table cell, cover row and drawing note is emoji-free before reaching Pretendard (spec §30.3).
- `pdf.ts` — jsPDF + svg2pdf.js renderer (lazy); `pdfFont.ts` Pretendard loading with retry error.
- `planSvg.ts` — standalone SVG of the plan for PNG/PDF (labels with halo, unverified marks, item numbers, per-leaf door swings, middle-door glass leaves + 「중문」, room area `12.3㎡` 14cm below the name label when `polygon` set — spec §25). 치수 평면도 only (`dimensionLines: true`): opening width labels prefixed with `openingNumbers` (`geometry/structure.ts`) e.g. `D1 ≈90` — not shown on 배치도/전기 계획도/PNG. Opening position label gap: 16cm on horizontal walls, 46cm on vertical walls (text width, also used for the 「중문」 label on vertical walls to clear the width label); fixture legend wraps into `floor((width + MARGIN) / LEGEND_STEP)` columns (spec §22).
- `exportPdf.ts` — orchestrates 3D captures + render; `png.ts` SVG/canvas → PNG blob with header lines.

## docs/ (per-tab reference doc links, spec §15.4 · §34)
- `links.ts` — pure `parseDocLinks` (array of `{ mode, label, url, note? }`, `https://` only, known modes only) + `docLinksFor(links, mode)`. `DocLinks.tsx` renders them as `target="_blank"` links under the 체크리스트/내보내기 headers; source is `virtual:doc-links` (`vite.config.ts`: `private/doc-links.local.json`, serve only, `null` in build/test). Which doc shows on which tab is data in that private file (§34: checklist tab lists all three).

## devserver/ (Node, dev server only)
- `selfUpdate.ts` — 「업데이트」 server logic: upstream check, dirty refusal, `fetch` + `merge --ff-only`, `npm install` on package changes, same-origin + header guard; wired as the `homefit-self-update` plugin in `vite.config.ts` (`/__homefit/update`, then `server.restart()`).

## ui/
- `uiStore.ts` — screen state (mode, view, tool, drafts, candidates, save status, banner). `area` tool: `areaTarget` (room id or null) + `startArea(roomId)` (bumps `areaSession`; `Editor2D` drops the draft on `[tool, areaSession]`); cleared to `null` by `setMode`/`setTool`/`setFixtureTool`/`cancelCalibration`. `measure` tool (spec §21): `measure: { a, b } | null` (screen-only, never persisted), `measureClick(p)` (a → b → new a), `clearMeasure()`; reset by `setMode`/`setTool`/`setFixtureTool`/`startArea`/`startCalibration`. `itemListOpen` (default true) + `setItemListOpen` for the 「배치된 가구」 collapse state (spec §28, screen-only). `viewOnly` (default false) + `setViewOnly` for mobile view-only (spec §33, screen-only); `App.tsx` subscribes to `matchMedia('(max-width: 820px)')` and sets it.
- `modes.ts` — mode list and per-mode rules; `shortcuts.ts` keyboard shortcuts (undo works while a button has focus; `viewOnly: true` in `KeyInput` blocks every edit shortcut except Ctrl+Z/Ctrl+Shift+Z, spec §33).
- Panels: `Toolbar`, `LayoutBar`, `StructurePanel` (tools incl. 「중문」; 「기본 마감」 section at the bottom uses `FinishPicker` for `planFinish`), `CatalogPanel` (mounts `ItemListPanel` between `LayoutBar` and 제품 찾기), `ItemListPanel` (collapsible 「배치된 가구 (N)」 list grouped by `model/itemList.ts`'s `groupItemsByRoom`; row click = `select`; 충돌/경고 badges from `useValidation`, 잠금 label; spec §28), `CustomBoxForm`, `ElectricPanel`, `HistoryPanel`, `ChecklistView`, `ExportView`, `ExportButtons`, `PropertiesPanel` (+ `properties/*Properties.tsx`; `OpeningProperties` has 중문 checkbox + 문짝 select for doors; `RoomProperties` has 바닥 영역 (`areaM2`, 「영역 그리기/다시 그리기」 → `startArea(room.id)`, structure mode only) + `FinishPicker` for room floor/wall), `CandidatePicker`, `Banner`, `UpdateButton` (dev only).
- `Toolbar` ends with the `글꼴 라이선스` link → `public/licenses/Pretendard-OFL.txt` via `import.meta.env.BASE_URL` (deploy design §9).
- `MobileInfoBar.tsx` — mobile view-only (spec §33): read-only band (`.mobile-info`) showing the selected entity's name/dims/status badges via `findEntity` + `useValidation`, or 「선택된 항목 없음」. Rendered by `App.tsx` above the canvas instead of `PropertiesPanel` when `uiStore.viewOnly`; `Toolbar` hides 스냅/측정/JSON 저장/PNG/이력/실행 취소/다시 실행/업데이트/저장 상태/글꼴 라이선스 in that state (keeps 모드·보기·시점 초기화·JSON 열기); `.left` panel is not rendered and `LayoutBar`+`ItemListPanel` move below the canvas (`.mobile-bottom`) instead. 2D/3D item/fixture/opening pointerdown handlers select but skip `beginDrag` when `viewOnly`; wall/room vertex-drag handles are not rendered.
- `FinishPicker.tsx` — generic preset-chip + material `<select>` + color `<input type="color">` picker for `FloorFinish`/`WallFinish` (colour previews locally, commits once on the native `change` event); used by `RoomProperties` (room floor/wall) and `StructurePanel` (plan defaults). Exports `FLOOR_MATERIALS`/`WALL_MATERIALS` option lists.
- `styles.css` (src root) — wood-tone design tokens on `:root` (spec §19.4); colors only via tokens, 2D selection accent stays blue (`--accent`). Motion tokens `--ease-out`/`--dur`, `:active` press feedback instead of hover lift, `prefers-reduced-motion` block, `.cl-bar-fill` via `scaleX` (spec §33).
- `fields.tsx` — number/text/checkbox inputs with units; `TextField` takes an optional `disabled`; `saveLabel.ts` "저장됨 HH:MM" text; `dnd.ts` catalog drag MIME; `selfUpdateClient.ts` update request, banner text, wait-for-restart poll.
- `catalogFilter.ts` — `filterCatalog`: name/model/category-label (`CATEGORY_LABEL`) substring filter for `CatalogPanel`'s 제품 찾기 input.
- `properties/ItemProperties.tsx` — 설치 높이 `NumberField` (`itemElevationCm`, commits `item.elevation`) with a 기본값 reset button shown only when the item has an explicit elevation. For a `plan.customProducts` item, shows 이름 `TextField` (always editable) + 폭 W/깊이 D/높이 H `NumberField`s (via `updateCustomProduct`, disabled if ANY item across all layouts sharing that product is locked, spec §26.2 리뷰 반영) instead of the static dims line, plus a 「이 제품을 쓰는 가구 N개…」 note when shared by more than one placement. Every item gets a 메모 `TextAreaField` (`item.note`, editable even when locked).

## scripts/ (Node, outside the app bundle)
- `check-dist.ts` — post-build Pages bundle guard: no images except `assets/floorplan-<hash>.jpg` (`ALLOWED_IMAGE`), no `private/` preset markers, all index.html refs under `/sn-house-interior/` (deploy design §7, spec §24). `npm run check:dist`.
- Base path `/sn-house-interior/` applies to build and preview only (`vite.config.ts`); `npm run e2e:preview` (`playwright.preview.config.ts`, `e2e-preview/`) checks fonts and the license link under that base on port 5181.
- Base `/sn-house-interior/` is repeated in `vite.config.ts`, `scripts/check-dist.ts` `BASE`, `playwright.preview.config.ts`, `e2e-preview/base-path.spec.ts`; change all four together.
- `.github/workflows/pages.yml` — on `main` push: typecheck → unit → build → `check:dist` → `deploy-pages`. No e2e in CI.
- `.github/workflows/privacy.yml` — on PRs and `main` push: `scan.sh --tracked`, `--log` (PR range / pushed range), build + `--dist`; terms from repo secret `PRIVACY_TERMS`.

## home/ (tracked home preset, spec §24)
- `plan.json` — our home plan (title 「우리 집」, no complex name); regenerated by `private/make-our-home.mjs`. `floorplan.jpg` — background image. Loaded by `vite.config.ts` `homePreset()`.
