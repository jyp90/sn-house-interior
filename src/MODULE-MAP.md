# src module map

One or two lines per module; grep, never read whole. Tests sit next to the module as `*.test.ts`.

## model/
- `schema.ts` — zod schemas for `Plan` (version 3) and every entity (walls, openings incl. door `middle`/`leaves`, rooms, items, layouts, fixtures, checklist state); types derive from here.
- `store.ts` — `createPlanStore`: zustand vanilla store, plan + selection + undo/redo (`HISTORY_LIMIT`); every edit action is one undo step.
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

## validation/
- `validate.ts` — `validatePlan` → per-item status (`collides`, `clearanceBlocked`, `blocksDoor`) with `conflicts` reasons.
- `describe.ts` — `conflictLines`: Korean text for the warning detail.

## persistence/
- `parse.ts` — `parsePlan` (zod + `migrate` by `version`, `CURRENT_VERSION` 3; v2→v3 bumps only).
- `storage.ts` — localStorage read/save, invalid-plan backup, `startAutosave` (debounced).
- `revisions.ts` — local revision snapshots (max 20, auto interval).
- `images.ts` — background image store (IndexedDB, memory fallback), downscale to `MAX_IMAGE_PX`.
- `file.ts` — JSON/Blob download helpers.
- `homePreset.ts` — applies `virtual:home-preset` (dev-only, `private/`) as the initial plan + background (`HOME_IMAGE_REF`).

## editor2d/ (SVG, coordinates = plan cm)
- `Editor2D.tsx` — the 2D editor root; layers `Walls2D`, `Openings2D` (per-leaf swings, glass leaf + 「중문」 label for middle doors), `Rooms2D`, `Items2D`, `Fixtures2D`, `Overlays2D`, `ToolPreview`, `BackgroundImage`.
- `tools.ts` — tool click handling (wall, opening, room, fixture) and `finishWall`; `middle-door` tool places a `door` with `MIDDLE_DOOR_DEFAULTS` (120cm, asym, middle).
- `snapping.ts` — angle and endpoint snap for wall drawing.
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

## ui/
- `uiStore.ts` — screen state (mode, view, tool, drafts, candidates, save status, banner).
- `modes.ts` — mode list and per-mode rules; `shortcuts.ts` keyboard shortcuts (undo works while a button has focus).
- Panels: `Toolbar`, `LayoutBar`, `StructurePanel` (tools incl. 「중문」), `CatalogPanel`, `CustomBoxForm`, `ElectricPanel`, `HistoryPanel`, `ChecklistView`, `ExportView`, `ExportButtons`, `PropertiesPanel` (+ `properties/*Properties.tsx`; `OpeningProperties` has 중문 checkbox + 문짝 select for doors), `CandidatePicker`, `Banner`.
- `Toolbar` ends with the `글꼴 라이선스` link → `public/licenses/Pretendard-OFL.txt` via `import.meta.env.BASE_URL` (deploy design §9).
- `fields.tsx` — number/text/checkbox inputs with units; `saveLabel.ts` "저장됨 HH:MM" text; `dnd.ts` catalog drag MIME.

## scripts/ (Node, outside the app bundle)
- `check-dist.ts` — post-build Pages bundle guard: no images, no home-preset markers, all index.html refs under `/sn-house-interior/` (deploy design §7). `npm run check:dist`.
- Base path `/sn-house-interior/` applies to build and preview only (`vite.config.ts`); `npm run e2e:preview` (`playwright.preview.config.ts`, `e2e-preview/`) checks fonts and the license link under that base on port 5181.
