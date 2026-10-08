---
name: migrating-plan-schema
description: Use when adding, renaming, removing, or changing the type of a field in the Plan zod schema (src/model/schema.ts) in sn-house-interior, or when old saved JSON / localStorage plans fail to load with "지원하지 않는 파일 버전".
---

# Migrating the Plan schema

Saved plans (localStorage, IndexedDB recovery history, user JSON files, `private/our-home.local.json`) must keep loading. Every schema change bumps the version, even optional-only additions (v2→v3 precedent).

## Steps

1. Read spec §5, §14.4.
2. Edit `src/model/schema.ts`. Integer cm for lengths. Items live in layouts; never re-add `plan.items`.
3. `src/persistence/parse.ts`: `CURRENT_VERSION` += 1, add `MIGRATIONS[old]` returning `version: old + 1`, with a one-line Korean comment `// vN: …`.
   - Optional field: `(raw) => ({ ...raw, version: N })`.
   - Required/renamed field: fill a default or move data, keep unknown keys via `...rest`.
4. Tests in `src/persistence/parse.test.ts`: a raw object at the old version parses to the new shape; chain from v1 still succeeds; existing round-trip tests stay unchanged.
5. Fix every fixture/sample that builds a Plan literal: `src/model/samplePlan.ts`, `*.test.ts` fixtures, `src/persistence/homePreset.test.ts`. `grep -rn "version: " src e2e`.
6. Local preset: `private/make-our-home.mjs` regenerates `private/our-home.local.json` (not tracked; tell the user if it needs rerun).
7. Pure modules (`geometry/`, `validation/`, `export/pages.ts`, …) reading the field get colocated tests.
8. `npm run typecheck && npm test`; then **REQUIRED SUB-SKILL:** syncing-docs (MODULE-MAP `persistence/` line, spec round if it's a product decision).

## Common mistakes
- Changing the schema without bumping → old files load but silently drop/reject data.
- Migration that returns the same version → `migrate` returns `null` (loop guard).
- Editing an old migration step instead of adding a new one.
