# CodeGate implementation plan

`CODEGATE_IMPLEMENTATION_SPEC.md` is not present in this checkout. The supplied repository
instructions and current product behavior remain the working requirements.

## Relevant architecture

- Ordinary `problems/<slug>` CoJudge packs own metadata, tests, validators, statements, and judging.
- `codegate/candidate-manifest.json` has one compact record per problem ID, with all available
  language solutions nested under that record. It stores relative paths, provenance, and hashes.
- Neenza starters and Kamyu/Doocs baselines stay in source shards and are loaded only for the active
  challenge. Packaged builds include the required source subtrees.
- Difficulty is globally fixed at 0/25/50/75/99/100. The starter is 0, baseline is 100, 99 removes
  exactly one eligible implementation line, and other partials are deterministic in-memory
  reductions. Partials are not required to compile.
- Challenge preparation loads indexed assets without submitting the 100% solution. Only explicit
  user submissions invoke the existing judge and can release the gate.
- Generated problems store compact judge data in the single JSON catalog. Runtime exposes only the
  selected problem as a temporary ordinary CoJudge pack and replaces it on problem changes.

## Milestones

- [x] Group every problem's available judge languages into one slim metadata record.
- [x] Load and hash-check starter, solution, and judge assets on demand.
- [x] Generate fixed partial difficulties in memory without materialized variant files.
- [x] Add a 99% difficulty that removes exactly one implementation line.
- [x] Make 99% difficulty and dark mode the defaults while preserving saved user preferences.
- [x] Remove automatic baseline submission, runtime validation cache, and validation-only state.
- [x] Keep at least one Electron window alive while replacing the preparation screen so fast
  challenge loading cannot trigger an abandoned-session shutdown.
- [x] Recreate the first three sample inputs when materializing a generated runtime pack so the
  existing editor can render compact-manifest problems without a server error.
- [x] Delete old per-pack `codegate.json`, `reference/`, `variants/`, playable manifest, validation
  report, exhaustive validator, and difficulty-regeneration artifacts.
- [x] Complete focused tests and production build after the refactor.
- [x] Index every safely adaptable record without permanently creating per-problem pack files.
- [x] Add a temporary problem-pack overlay used by existing routes, runners, and validators.
- [x] Remove the obsolete full pack-import implementation.
- [x] Validate the expanded catalog and production build.

## Validation

- [x] `npm.cmd run codegate:candidates` — 47 problems, 299 problem/language baselines, 27 quarantined
  problem records.
- [x] Expanded JSON catalog — 1,956 problems, 10,269 problem/language baselines, 957 quarantined
  records, and no permanent generated packs.
- [x] `npm.cmd run importer:test -- --offline` — 4 adapter tests passed.
- [x] Focused Vitest run — 17 selection, session, transform, catalog, and runtime-preparation tests
  passed.
- [x] Automatic solution-validation removal — 14 focused tests passed and `npx.cmd tsc --noEmit`
  passed.
- [x] Window-handoff regression — 10 desktop tests passed and `quick-test.bat` remained running
  after the preparation-to-editor transition.
- [x] Generated runtime-pack regression — 4 focused tests passed; rebuilt gate returned `303` and
  its selected problem page returned `200`.
- [x] 99% difficulty — 13 focused transform, selection, and session tests passed; TypeScript check
  passed.
- [x] Default preference update — TypeScript check passed.
- [x] `npm.cmd run check` — 0 errors and 0 warnings.
- [x] `npm.cmd run build` — production SvelteKit build passed.
- [x] `git diff --check` and stale-artifact scan — passed; no per-pack `codegate.json`, `reference/`,
  or `variants/` structures remain.
- [x] Generated catalog size reduced from 56 MB of embedded validators to 6.3 MB of hierarchical
  JSON with byte-range test references.
- [x] Verified all 1,914 generated test-record byte ranges against their SHA-256 hashes.

No new dependency was added.
