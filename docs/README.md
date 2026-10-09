# sn-house-interior docs index

Start at `HANDOFF.md` 「지금 상태」/「다음 할 일」. Rules: `CLAUDE.md`. Module notes: `src/MODULE-MAP.md`.

## Specs and plans
| Doc | Status |
|---|---|
| `docs/superpowers/specs/2026-10-08-homefit-design.md` | Binding. §14 (Planner 5D round) overrides §1–13; §15 quote / home preset, §16 middle door, §17 Pages deploy, §18 auto-update button, §19 room areas / floor-wall finishes / wood-tone UI, §20 catalog expansion / item elevation, §21 distance measurement tool, §22 deferred-minor fixes (3D label overlay, T-junction snap, self-intersection, PDF label/legend, checklist id hash) (latest) |
| `docs/references/2026-10-08-planner5d-research-design.md` | User-provided research; source of requirement IDs F01–F12 |
| `docs/superpowers/plans/2026-10-08-homefit-01-foundation-placement.md` | Plan 1 done |
| `docs/superpowers/plans/2026-10-08-homefit-02-editor2d.md` | Plan 2 done |
| `docs/superpowers/plans/2026-10-08-homefit-03-layouts-export.md` | Plan 3 done |
| `docs/superpowers/plans/2026-10-08-homefit-04-electrical-checklist-pdf.md` | Plan 4 done |
| `docs/superpowers/specs/2026-10-08-pages-deploy-design.md` | Pages deploy design (spec §17); done 2026-10-09 — live at https://jyp90.github.io/sn-house-interior/ |
| `docs/superpowers/plans/2026-10-08-homefit-05a-pages-deploy.md` | Plan 5a (Pages deploy) done |
| `docs/superpowers/plans/2026-10-08-room-finish.md` | Room areas, finishes, wood-tone UI (spec §19); merged |
| `docs/superpowers/plans/2026-10-09-catalog-elevation.md` | Catalog expansion (9 builders, 23 generic products), item elevation, vertical-span collisions (spec §20); merged |
| Plan 5 remainder | Official Samsung dims/`sourceUrl` for `-sample` products (spec §14.5-5, §20.6) — waits for the model list |

## Feature map
| Feature | Code | Spec |
|---|---|---|
| Plan model, schema versions, migration | `src/model/schema.ts`, `src/persistence/parse.ts` | §5, §14.4 |
| Store, undo/redo, selection | `src/model/store.ts`, `src/model/StoreContext.tsx` | §4, §6 |
| Autosave, save status, JSON open/save | `src/persistence/storage.ts`, `src/persistence/file.ts`, `src/ui/saveLabel.ts` | §6 저장, §10, §14.1 F11 |
| Revision history (20 snapshots) | `src/persistence/revisions.ts`, `src/ui/HistoryPanel.tsx` | §14.1 F10 |
| Local-only home preset | `vite.config.ts` `virtual:home-preset`, `src/persistence/homePreset.ts`, `src/main.tsx` | §3, §15.1 |
| 2D structure editor (walls, openings, rooms, tools, snapping) | `src/editor2d/`, `src/geometry/structure.ts`, `src/ui/StructurePanel.tsx` | §6 구조 모드, §14.1 |
| Distance measurement tool (측정, screen-only) | `src/ui/uiStore.ts` `measure`, `src/editor2d/tools.ts` `measureToolPoint`, `src/editor2d/ToolPreview.tsx`, `src/ui/Toolbar.tsx` | §21 |
| Background image + scale calibration (same-size re-upload keeps scale/offset) | `src/editor2d/calibration.ts`, `src/editor2d/BackgroundImage.tsx`, `src/persistence/images.ts` | §6, §14.1 F01 |
| 3D view, drag placement, camera, projected DOM labels | `src/scene3d/`, `src/scene3d/labelBridge.ts`, `src/scene3d/LabelOverlay.tsx` | §6 배치 모드, §22 |
| Catalog and procedural product builders (16 builders, 29 products, name filter) | `src/catalog/products.ts`, `src/catalog/builders/`, `src/ui/catalogFilter.ts` | §7, §20.3, §20.4 |
| Item elevation (설치 높이: resolver, 2D dashed, 3D height, panel, PDF/checklist) | `src/catalog/elevation.ts`, `src/ui/properties/ItemProperties.tsx`, `src/editor2d/Items2D.tsx`, `src/scene3d/Items3D.tsx` | §20.1, §20.4 |
| Validation (OBB collision, vertical spans, wall distance, door swing, conflict reasons) | `src/geometry/`, `src/geometry/vertical.ts`, `src/validation/` | §6 충돌 규칙, §14.1 F08, §20.2 |
| Layouts A/B and compare overlay | `src/model/layout.ts`, `src/ui/LayoutBar.tsx` | §14.1 F09 |
| Electrical fixtures, dedicated-circuit warning | `src/electrical/fixtures.ts`, `src/editor2d/Fixtures2D.tsx`, `src/ui/ElectricPanel.tsx` | §6 전기 모드 |
| Checklist (on-site inspection items, auto items with content-hash ids) | `src/checklist/`, `src/checklist/hash.ts`, `src/ui/ChecklistView.tsx` | §8, §15.2, §22 |
| PNG export | `src/export/planSvg.ts`, `src/export/png.ts`, `src/ui/ExportButtons.tsx` | §14.1 F12 |
| Contractor PDF (+ quote request pages) | `src/export/pages.ts`, `src/export/pdf.ts`, `src/export/pdfFont.ts`, `src/export/exportPdf.ts`, `src/quote/request.ts`, `src/ui/ExportView.tsx` | §9, §15.3 |
| Code auto-update button (dev server) | `src/devserver/selfUpdate.ts`, `vite.config.ts` `homefit-self-update`, `src/ui/UpdateButton.tsx`, `src/ui/selfUpdateClient.ts` | §18 |
| Room areas, floor/wall finishes (2D patterns, 3D textures, wall faces) | `src/geometry/polygon.ts`, `src/materials/`, `src/editor2d/Rooms2D.tsx`, `src/scene3d/Floor.tsx`, `src/scene3d/Walls3D.tsx`, `src/ui/FinishPicker.tsx` | §19 |
| Wood-tone UI theme (design tokens) | `src/styles.css` | §19.4 |
| Modes, shortcuts | `src/ui/modes.ts`, `src/ui/shortcuts.ts`, `src/ui/uiStore.ts` | §6 |
| Pages deploy (base path, bundle guard, OFL notice, Actions) | `vite.config.ts` base, `scripts/check-dist.ts`, `public/licenses/`, `.github/workflows/pages.yml`, `playwright.preview.config.ts` | §17 |

## Task → read this
| Task | Read |
|---|---|
| Any change | `CLAUDE.md`, `HANDOFF.md` 「지금 상태」/「다음 할 일」 |
| New feature / product decision | spec §1–2, §14–§19; brainstorm with the user, append a dated spec round |
| Schema field | skill `migrating-plan-schema`; spec §5, §14.4; `src/model/schema.ts`, `src/persistence/parse.ts` |
| Add a catalog product | skill `adding-catalog-product`; spec §7, §13, §20.3; `src/catalog/products.ts`, `src/catalog/builders/index.ts` |
| Item height / mount rules | spec §20.1–§20.2; `src/catalog/elevation.ts`, `src/validation/validate.ts` |
| PDF page or copy | spec §9, §15.3; `src/export/pages.ts` then `src/export/pdf.ts`; svg2pdf pitfalls in `CLAUDE.md` |
| Floor/wall finish preset, room area | spec §19; `src/materials/presets.ts`, `src/geometry/polygon.ts`, `src/editor2d/tools.ts` (area tool) |
| Checklist items | spec §8, §15.2 (new `i-` ids, fresh wording) |
| Anything touching `private/` or the home preset | skill `checking-privacy`; spec §3, §15.1; privacy rule in `CLAUDE.md` |
| Deploy / change the Pages setup | spec §17 → `docs/superpowers/specs/2026-10-08-pages-deploy-design.md`; `.github/workflows/pages.yml`, `scripts/check-dist.ts`; never push pre-rewrite history |
| Commit / finish a round | skills `committing-safely`, `syncing-docs`, `exploratory-qa` |
| Resume a past round | `archive/*/HANDOFF.md` (local only) |
