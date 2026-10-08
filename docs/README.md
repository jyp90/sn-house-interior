# sn-house-interior docs index

Start at `HANDOFF.md` 「지금 상태」/「다음 할 일」. Rules: `CLAUDE.md`. Module notes: `src/MODULE-MAP.md`.

## Specs and plans
| Doc | Status |
|---|---|
| `docs/superpowers/specs/2026-10-08-homefit-design.md` | Binding. §14 (Planner 5D round) overrides §1–13; §15 (quote / home preset round) is the latest |
| `docs/references/2026-10-08-planner5d-research-design.md` | User-provided research; source of requirement IDs F01–F12 |
| `docs/superpowers/plans/2026-10-08-homefit-01-foundation-placement.md` | Plan 1 done |
| `docs/superpowers/plans/2026-10-08-homefit-02-editor2d.md` | Plan 2 done |
| `docs/superpowers/plans/2026-10-08-homefit-03-layouts-export.md` | Plan 3 done |
| `docs/superpowers/plans/2026-10-08-homefit-04-electrical-checklist-pdf.md` | Plan 4 done |
| Plan 5 (catalog, builders, deploy) | Not written — spec §14.5-5, §13 |

## Feature map
| Feature | Code | Spec |
|---|---|---|
| Plan model, schema versions, migration | `src/model/schema.ts`, `src/persistence/parse.ts` | §5, §14.4 |
| Store, undo/redo, selection | `src/model/store.ts`, `src/model/StoreContext.tsx` | §4, §6 |
| Autosave, save status, JSON open/save | `src/persistence/storage.ts`, `src/persistence/file.ts`, `src/ui/saveLabel.ts` | §6 저장, §10, §14.1 F11 |
| Revision history (20 snapshots) | `src/persistence/revisions.ts`, `src/ui/HistoryPanel.tsx` | §14.1 F10 |
| Local-only home preset | `vite.config.ts` `virtual:home-preset`, `src/persistence/homePreset.ts`, `src/main.tsx` | §3, §15.1 |
| 2D structure editor (walls, openings, rooms, tools, snapping) | `src/editor2d/`, `src/geometry/structure.ts`, `src/ui/StructurePanel.tsx` | §6 구조 모드, §14.1 |
| Background image + scale calibration | `src/editor2d/calibration.ts`, `src/editor2d/BackgroundImage.tsx`, `src/persistence/images.ts` | §6, §14.1 F01 |
| 3D view, drag placement, camera | `src/scene3d/` | §6 배치 모드 |
| Catalog and procedural product builders | `src/catalog/products.ts`, `src/catalog/builders/` | §7 |
| Validation (OBB collision, wall distance, door swing, conflict reasons) | `src/geometry/`, `src/validation/` | §6 충돌 규칙, §14.1 F08 |
| Layouts A/B and compare overlay | `src/model/layout.ts`, `src/ui/LayoutBar.tsx` | §14.1 F09 |
| Electrical fixtures, dedicated-circuit warning | `src/electrical/fixtures.ts`, `src/editor2d/Fixtures2D.tsx`, `src/ui/ElectricPanel.tsx` | §6 전기 모드 |
| Checklist (on-site inspection items, auto items) | `src/checklist/`, `src/ui/ChecklistView.tsx` | §8, §15.2 |
| PNG export | `src/export/planSvg.ts`, `src/export/png.ts`, `src/ui/ExportButtons.tsx` | §14.1 F12 |
| Contractor PDF (+ quote request pages) | `src/export/pages.ts`, `src/export/pdf.ts`, `src/export/pdfFont.ts`, `src/export/exportPdf.ts`, `src/quote/request.ts`, `src/ui/ExportView.tsx` | §9, §15.3 |
| Modes, shortcuts | `src/ui/modes.ts`, `src/ui/shortcuts.ts`, `src/ui/uiStore.ts` | §6 |

## Task → read this
| Task | Read |
|---|---|
| Any change | `CLAUDE.md`, `HANDOFF.md` 「지금 상태」/「다음 할 일」 |
| New feature / product decision | spec §1–2, §14, §15; brainstorm with the user, append a dated spec round |
| Schema field | spec §5, §14.4; `src/model/schema.ts`, `src/persistence/parse.ts` |
| Add a catalog product | spec §7, §13; `src/catalog/products.ts`, `src/catalog/builders/index.ts` |
| PDF page or copy | spec §9, §15.3; `src/export/pages.ts` then `src/export/pdf.ts`; svg2pdf pitfalls in `CLAUDE.md` |
| Checklist items | spec §8, §15.2 (new `i-` ids, fresh wording) |
| Anything touching `private/` or the home preset | spec §3, §15.1; privacy rule in `CLAUDE.md` |
| Deploy to Pages | spec §2, §14.5-5; user approval and history rewrite first |
| Resume a past round | `archive/*/HANDOFF.md` (local only) |
