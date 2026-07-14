# CodeGate implementation plan

`CODEGATE_IMPLEMENTATION_SPEC.md` is not present in this checkout. The supplied repository
instructions and current product behavior remain the working requirements.

## Relevant architecture

- Ordinary `problems/<slug>` CoJudge packs own metadata, tests, validators, statements, and judging.
- `codegate/candidate-manifest.json` has one compact record per problem ID, with all available
  language solutions nested under that record. It stores relative paths, provenance, and hashes.
- Neenza starters and Kamyu/Doocs baselines stay in source shards and are loaded only for the active
  challenge. Packaged builds include the required source subtrees.
- Difficulty is globally fixed at 0/25/50/75/100. The starter is 0, baseline is 100, and partials
  are deterministic in-memory reductions. Partials are not required to compile.
- First use validates only the 100% baseline with the existing submission API, Docker runner,
  official tests, and validator. Results are cached by hashes; failures are quarantined locally.

## Milestones

- [x] Group every problem's available judge languages into one slim metadata record.
- [x] Load and hash-check starter, solution, and judge assets on demand.
- [x] Generate fixed partial difficulties in memory without materialized variant files.
- [x] Validate and cache only the baseline at first runtime use.
- [x] Delete old per-pack `codegate.json`, `reference/`, `variants/`, playable manifest, validation
  report, exhaustive validator, and difficulty-regeneration artifacts.
- [x] Complete focused tests and production build after the refactor.

## Validation

- [x] `npm.cmd run codegate:candidates` — 47 problems, 299 problem/language baselines, 27 quarantined
  problem records.
- [x] `npm.cmd run codegate:import -- --config .\codegate\import-leetcode-smoke.json --offline` — 10
  accepted, 0 skipped, 0 failed; no reference or variant files written.
- [x] `npm.cmd run importer:test -- --offline` — 4 adapter tests passed.
- [x] Focused Vitest run — 16 selection, session, transform, catalog, and runtime-validation tests
  passed.
- [x] `npm.cmd run check` — 0 errors and 0 warnings.
- [x] `npm.cmd run build` — production SvelteKit build passed.
- [x] `git diff --check` and stale-artifact scan — passed; no per-pack `codegate.json`, `reference/`,
  or `variants/` structures remain.

No new dependency was added.
