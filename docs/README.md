# sn-house-interior docs index

Start at `HANDOFF.md` 「지금 상태」/「다음 할 일」. Rules: `CLAUDE.md`. Module notes: `src/MODULE-MAP.md`.

## Specs and plans
| Doc | Status |
|---|---|
| `docs/superpowers/specs/2026-10-08-homefit-design.md` | Binding. §14 (Planner 5D round) overrides §1–13; §15 quote / home preset, §16 middle door, §17 Pages deploy, §18 auto-update button, §19 room areas / floor-wall finishes / wood-tone UI, §20 catalog expansion / item elevation, §21 distance measurement tool, §22 deferred-minor fixes, §23 3D door leaves / window glass, §24 tracked home preset, §25 PDF finish/opening schedules + room areas, §26 custom box editing / item notes, §27 switch groups / 3D electrical fixtures, §28 placed item list panel, §29 corner cabinets / range hood, §30 deferred minors 2, §31 opening 2D clamp / checklist orphan pruning, §32 interaction polish, §33 mobile view-only, §34 checklist-tab doc links, §35 grayscale background / closed-wall room-area recognition, §36 page title / tab URL hash, §37 white floor-plan paper / larger room labels with area, §38 no placement outside the house, §39 home preset v2 (Planner 5D dims, 창고, sash, 중문 frame, preset-update notice) (latest) |
| `docs/references/2026-10-08-planner5d-research-design.md` | User-provided research; source of requirement IDs F01–F12 |
| `docs/superpowers/plans/2026-10-08-homefit-01-foundation-placement.md` | Plan 1 done |
| `docs/superpowers/plans/2026-10-08-homefit-02-editor2d.md` | Plan 2 done |
| `docs/superpowers/plans/2026-10-08-homefit-03-layouts-export.md` | Plan 3 done |
| `docs/superpowers/plans/2026-10-08-homefit-04-electrical-checklist-pdf.md` | Plan 4 done |
| `docs/superpowers/specs/2026-10-08-pages-deploy-design.md` | Pages deploy design (spec §17); done 2026-10-09 — live at https://jyp90.github.io/sn-house-interior/ |
| `docs/superpowers/plans/2026-10-08-homefit-05a-pages-deploy.md` | Plan 5a (Pages deploy) done |
| `docs/superpowers/plans/2026-10-08-room-finish.md` | Room areas, finishes, wood-tone UI (spec §19); merged |
| `docs/superpowers/plans/2026-10-09-auto-room-area.md` | Grayscale background, closed-wall room-area recognition (spec §35); merged |
| `docs/superpowers/plans/2026-10-09-catalog-elevation.md` | Catalog expansion (9 builders, 23 generic products), item elevation, vertical-span collisions (spec §20); merged |
| Plan 5 remainder | Official Samsung dims/`sourceUrl` for `-sample` products (spec §14.5-5, §20.6) — waits for the model list |

## Feature map
| Feature | Code | Spec |
|---|---|---|
| Interaction polish (press feedback, reduced motion, transform-only bars, input autocomplete) | `src/styles.css`, `src/docs/DocLinks.css`, `src/ui/fields.tsx`, `index.html` | §32 |
| Per-tab reference doc links (checklist: 상담 체크리스트 + 1차·2차, export: 1차·2차; dev-only, `private/doc-links.local.json`) | `src/docs/DocLinks.tsx`, `src/docs/links.ts`, `vite.config.ts` `virtual:doc-links` | §15.4, §34 |
| Plan model, schema versions (v8), migration | `src/model/schema.ts`, `src/persistence/parse.ts` | §5, §14.4, §26, §27, §29 |
| Store, undo/redo, selection | `src/model/store.ts`, `src/model/StoreContext.tsx` | §4, §6 |
| Autosave, save status, JSON open/save | `src/persistence/storage.ts`, `src/persistence/file.ts`, `src/ui/saveLabel.ts` | §6 저장, §10, §14.1 F11 |
| Revision history (20 snapshots) | `src/persistence/revisions.ts`, `src/ui/HistoryPanel.tsx` | §14.1 F10 |
| Home preset (tracked `home/plan.json` + `home/floorplan.jpg`, dev + build, spec §24) | `vite.config.ts` `virtual:home-preset`, `src/persistence/homePreset.ts`, `src/main.tsx`, `scripts/check-dist.ts` | §15.1, §24 |
| 2D structure editor (walls, openings, rooms, tools, snapping) | `src/editor2d/`, `src/geometry/structure.ts`, `src/ui/StructurePanel.tsx` | §6 구조 모드, §14.1 |
| Distance measurement tool (측정, screen-only) | `src/ui/uiStore.ts` `measure`, `src/editor2d/tools.ts` `measureToolPoint`, `src/editor2d/ToolPreview.tsx`, `src/ui/Toolbar.tsx` | §21 |
| Background image + scale calibration (same-size re-upload keeps scale/offset) | `src/editor2d/calibration.ts`, `src/editor2d/BackgroundImage.tsx`, `src/persistence/images.ts` | §6, §14.1 F01 |
| 3D view, drag placement, camera, projected DOM labels, door/window parts | `src/scene3d/`, `src/scene3d/labelBridge.ts`, `src/scene3d/LabelOverlay.tsx`, `src/scene3d/openingParts.ts`, `src/scene3d/Openings3D.tsx` | §6 배치 모드, §22, §23 |
| Catalog and procedural product builders (17 builders, 32 products, name/category filter) | `src/catalog/products.ts`, `src/catalog/builders/`, `src/ui/catalogFilter.ts` | §7, §20.3, §20.4, §29 |
| Item elevation (설치 높이: resolver, 2D dashed, 3D height, panel, PDF/checklist) | `src/catalog/elevation.ts`, `src/ui/properties/ItemProperties.tsx`, `src/editor2d/Items2D.tsx`, `src/scene3d/Items3D.tsx` | §20.1, §20.4 |
| Validation (OBB collision, vertical spans, wall distance, door swing, conflict reasons) | `src/geometry/`, `src/geometry/vertical.ts`, `src/validation/` | §6 충돌 규칙, §14.1 F08, §20.2 |
| Layouts A/B and compare overlay, placed item list | `src/model/layout.ts`, `src/model/itemList.ts`, `src/ui/LayoutBar.tsx`, `src/ui/ItemListPanel.tsx` | §14.1 F09, §28 |
| Electrical fixtures, dedicated-circuit warning, switch groups, 3D fixtures | `src/electrical/fixtures.ts`, `src/editor2d/Fixtures2D.tsx`, `src/ui/ElectricPanel.tsx`, `src/scene3d/fixtureParts.ts`, `src/scene3d/Fixtures3D.tsx` | §6 전기 모드, §27 |
| Checklist (on-site inspection items, auto items with content-hash ids) | `src/checklist/`, `src/checklist/hash.ts`, `src/ui/ChecklistView.tsx` | §8, §15.2, §22 |
| PNG export | `src/export/planSvg.ts`, `src/export/png.ts`, `src/ui/ExportButtons.tsx` | §14.1 F12 |
| Contractor PDF (+ quote request pages, 방 마감표, 창호 일람) | `src/export/pages.ts`, `src/export/pdf.ts`, `src/export/pdfFont.ts`, `src/export/exportPdf.ts`, `src/quote/request.ts`, `src/ui/ExportView.tsx` | §9, §15.3, §25 |
| Code auto-update button (dev server) | `src/devserver/selfUpdate.ts`, `vite.config.ts` `homefit-self-update`, `src/ui/UpdateButton.tsx`, `src/ui/selfUpdateClient.ts` | §18 |
| Room areas, floor/wall finishes (2D patterns, 3D textures, wall faces) | `src/geometry/polygon.ts`, `src/materials/`, `src/editor2d/Rooms2D.tsx`, `src/scene3d/Floor.tsx`, `src/scene3d/Walls3D.tsx`, `src/ui/FinishPicker.tsx` | §19 |
| Wood-tone UI theme (design tokens) | `src/styles.css` | §19.4 |
| Closed-wall room-area recognition, grayscale background | `src/geometry/enclosure.ts`, `src/model/store.ts` (`autoRoomPolygon(s)`), `src/ui/properties/RoomProperties.tsx`, `src/ui/StructurePanel.tsx`, `src/editor2d/BackgroundImage.tsx` | §35 |
| White floor-plan paper, 20px room labels with `(N㎡)` | `src/editor2d/BackgroundImage.tsx`, `src/editor2d/Rooms2D.tsx`, `src/styles.css`, `home/plan.json` (`opacity` 0) | §37 |
| No placement outside the house (labels, area points, fixtures; fixture drag clamp) | `src/geometry/houseArea.ts`, `src/editor2d/tools.ts` (`HOUSE_BOUND_TOOLS`), `src/editor2d/Fixtures2D.tsx` | §38 |
| Home preset v2 (9 rooms, 18cm walls), preset-update notice | `home/plan.json`, `private/make-our-home.mjs` (v2, local only), `src/persistence/homePreset.ts` (`presetFingerprint`, `markPresetSeen`), `src/main.tsx` | §39 |
| Modes, shortcuts, mobile view-only | `src/ui/modes.ts`, `src/ui/shortcuts.ts`, `src/ui/uiStore.ts`, `src/ui/MobileInfoBar.tsx`, `src/App.tsx` | §6, §33 |
| Page title, tab ↔ URL hash (`#place` …) | `index.html`, `src/ui/modeHash.ts`, `src/main.tsx` | §36 |
| Custom box editing, item notes (`updateCustomProduct`, `Item.note`) | `src/model/store.ts`, `src/ui/properties/ItemProperties.tsx`, `src/export/pages.ts` | §26 |
| Validation cache per plan, door-swing wall clamp, PDF emoji strip, first-frame viewport fill | `src/model/useValidation.ts`, `src/geometry/clearance.ts`, `src/export/pages.ts` `pdfSafe`, `src/styles.css` | §30 |
| Opening 2D/PDF clamp to wall, checklist orphan pruning | `src/geometry/walls.ts` `openingObb`/`clampToWall`, `src/geometry/clearance.ts`, `src/editor2d/Openings2D.tsx`, `src/export/planSvg.ts`, `src/model/store.ts` `setChecklistEntry` | §31 |
| Pages deploy (base path, bundle guard, OFL notice, Actions) | `vite.config.ts` base, `scripts/check-dist.ts`, `public/licenses/`, `.github/workflows/pages.yml`, `playwright.preview.config.ts` | §17 |

## Task → read this
| Task | Read |
|---|---|
| Any change | `CLAUDE.md`, `HANDOFF.md` 「지금 상태」/「다음 할 일」 |
| New feature / product decision | spec §1–2, §14–§34; brainstorm with the user, append a dated spec round |
| Schema field | skill `migrating-plan-schema`; spec §5, §14.4; `src/model/schema.ts`, `src/persistence/parse.ts` |
| Add a catalog product | skill `adding-catalog-product`; spec §7, §13, §20.3, §29; `src/catalog/products.ts`, `src/catalog/builders/index.ts` |
| Item height / mount rules | spec §20.1–§20.2; `src/catalog/elevation.ts`, `src/validation/validate.ts` |
| PDF page or copy | spec §9, §15.3; `src/export/pages.ts` then `src/export/pdf.ts`; svg2pdf pitfalls in `CLAUDE.md` |
| Floor/wall finish preset, room area | spec §19, §35; `src/materials/presets.ts`, `src/geometry/polygon.ts`, `src/geometry/enclosure.ts`, `src/editor2d/tools.ts` (area tool) |
| Checklist items | spec §8, §15.2 (new `i-` ids, fresh wording) |
| Anything touching `private/` or the home preset | skill `checking-privacy`; spec §3, §15.1, §24; privacy rule in `CLAUDE.md` |
| Deploy / change the Pages setup | spec §17 → `docs/superpowers/specs/2026-10-08-pages-deploy-design.md`; `.github/workflows/pages.yml`, `scripts/check-dist.ts`; never push pre-rewrite history |
| Commit / finish a round | skills `committing-safely`, `syncing-docs`, `exploratory-qa` |
| Resume a past round | `archive/*/HANDOFF.md` (local only) |
