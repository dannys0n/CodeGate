# CodeGate Implementation Plan

This plan implements `CODEGATE_IMPLEMENTATION_SPEC.md` against CoJudge upstream commit
`e05a062533a5dbb43d89cb261aadd6381e35a7e5` (2026-07-12). The specification is the
product source of truth. Checkboxes are updated only after the listed validation has run.

## Baseline and relevant architecture

- The starting CodeGate repository contained only repository instructions, the product
  specification, a license, and a minimal README. CoJudge was therefore imported from the
  specified upstream repository before product changes. Its history is not grafted into the
  CodeGate Git repository.
- CoJudge is a SvelteKit 2 / Svelte 5 application using the Node adapter. The problem list is
  loaded from `problems/*/metadata.json`; course ordering comes from
  `courses/blind75/courseinfo.json`.
- Each problem pack contains `metadata.json`, `statement.md`, `official-tests.json`, and
  `Marker.java`, with optional `solution.md`. Metadata owns language starter code, signatures,
  sample cases, and LeetCode difficulty.
- The problem page is `src/routes/problems/[slug]/+page.svelte`, backed by
  `+page.server.ts`. It uses the shared Monaco `CodeEditor`, local-storage stores, and the
  shared `ExecutionPanel`. Existing `?gameMode=1` behavior starts from ordinary starter code,
  tracks time/runs/submissions, and records a score; it is not an unlock gate.
- `/api/run` and `/api/submit` create in-memory asynchronous jobs. Both select an existing
  `ProgramRunner` subclass. Python and C++ user code runs in Docker; `Marker.java` runs in the
  existing Java Docker path to compute expected output and invoke custom `isCorrect` logic.
  Submit batches `official-tests.json`; the UI continues batches until it observes full-suite
  success. CodeGate will add binding and release checks around this flow, not replace it.
- Docker images and resource/timeout behavior are centralized in the existing runners,
  utilities, `ContainerPool`, and image endpoints. These remain the only compiler/judge path.
- Existing browser persistence uses local storage (`solutions`, open files, layout, settings,
  and game results). CodeGate state will be namespaced and isolated from normal practice state.
- Existing E2E coverage is a minimal Playwright homepage smoke test. Existing unit coverage is
  Vitest-based. `scripts/verify-submissions.js` validates representative Java solutions; focused
  Python/C++ fixture verification must be added without creating another judge.

## Baseline results (before product behavior)

- [x] Read root `AGENTS.md`, `CODEGATE_IMPLEMENTATION_SPEC.md`, upstream `AGENTS.md`, upstream
  `README.md`, `docs/ADD_PROBLEMS.md`, and `docs/ADD_LANGUAGE.md`.
- [x] Inspect problem discovery, problem page, game mode, local stores, submit/run APIs,
  marker execution, Python/C++ runners, CLI submission verifier, and Playwright configuration.
- [x] Bootstrap the specified CoJudge source at upstream commit
  `e05a062533a5dbb43d89cb261aadd6381e35a7e5`.
- [x] Confirm host Docker daemon availability: Docker Engine `29.6.1` responds outside the
  restricted execution sandbox.
- [x] Install Node.js LTS `24.18.0`; npm is `11.16.0` (Node exceeds upstream's v18+ minimum).
- [x] `npm.cmd ci` — 313 locked packages installed. npm reported 16 upstream audit findings
  (1 low, 8 moderate, 5 high, 2 critical); no unsafe automatic lockfile upgrade was applied.
- [x] `npm.cmd test -- --run` — baseline found two stale `string_array` expectations; corrected
  to the runner's actual `String[]` conversion and rerun: 11/11 passed.
- [x] `npm.cmd run check` — baseline found 16 errors/3 warnings in upstream; type-safe fixes were
  applied and the final rerun passed with 0 errors/0 warnings.
- [x] `npm.cmd run build` — passed (upstream chunk-size and unused-selector warnings recorded;
  selectors were subsequently corrected).
- [x] `npm.cmd run test:e2e` — after caching the pinned Playwright Chromium: 1/1 passed.
- [x] Correct Python submission accepted 32/32; deliberately incorrect Python rejected at test 1.
- [x] Correct C++ submission accepted 32/32; deliberately incorrect C++ rejected at test 1.

## Decisions and controlled deviations

- CoJudge's source was absent locally, so importing the pinned upstream tree is a necessary
  bootstrap step. Source attribution and the pin will remain documented.
- Electron is the only substantial new runtime dependency justified by the specification.
  `electron-builder` is included as a development-only dependency because Electron itself does
  not create a Windows installer; it produces the per-user NSIS installer required by the
  documented production installation and uninstall flow. No application-runtime library was
  added for CodeGate catalog, session, importer, or startup behavior.
- C++ scaffold generation will initially be deterministic token/line-aware transformation plus
  validation, avoiding a parser dependency unless reliable scaffolds cannot otherwise be made.
  Validation, not generation strategy, controls activation.
- Imported unsupported problem shapes remain reported/browsable but are excluded from the
  playable manifest. Linked structures, design problems, interactive/SQL/shell/concurrency,
  external API, and randomized cases remain quarantined until their validators are proven.

## Milestone 1 — Baseline and plan

- [x] Import and pin the specified CoJudge upstream source.
- [x] Document current architecture and actual repository paths.
- [x] Define milestone-sized work, validation commands, and checklists.
- [x] Complete final clean reruns of all executable baseline checks.
- [x] Review baseline/import diff for accidental overwrites or undocumented systems. The local
  instructions/specification/license were preserved; no parallel judge, editor, compiler, or
  database was introduced. `git diff --check` passed.

Validation:

```powershell
npm.cmd ci
npm.cmd test -- --run
npm.cmd run check
npm.cmd run build
npm.cmd run test:e2e
node .\bin\cojudge submit two-sum <correct-python-fixture>
node .\bin\cojudge submit two-sum <incorrect-python-fixture>
node .\bin\cojudge submit two-sum <correct-cpp-fixture>
node .\bin\cojudge submit two-sum <incorrect-cpp-fixture>
```

## Milestone 2 — Variant model and playable catalog

- [x] Define typed CodeGate catalog/variant metadata and strict schema validation.
- [x] Discover only validated `problem + language + scaffold` combinations.
- [x] Add deterministic selection, language/scaffold fallback, and recent-problem exclusion.
- [x] Add hand-authored Python and C++ variants/references for a representative bundled problem.
- [x] Add a build-time validator that runs reference and original completions against all
  official tests and rejects a deliberately incorrect solution.
- [x] Generate a machine-readable playable manifest and quarantine report (10 candidates,
  10 playable, 0 quarantined in the initial fixture pack).
- [x] Serve/load variants only when `?codegate=1`; preserve normal starter code otherwise.
- [x] Review diff for a parallel judge/compiler/editor/database and remove any duplication.
  Validation invokes the existing `cojudge submit` CLI and Docker runners; runtime loading is
  confined to validated manifest paths. `git diff --check` passed and no required TODOs remain.

Validation:

```powershell
npm.cmd run codegate:catalog
npm.cmd run codegate:validate -- --offline
npm.cmd test -- --run
npm.cmd run check
npm.cmd run build
```

## Milestone 3 — Gate web mode

- [x] Add unique session/challenge state with explicit active/released lifecycle.
- [x] Add the compact Python/C++, scaffold, Different Problem, and Give Up toolbar.
- [x] Preserve language/scaffold on refresh and avoid recent problems where possible.
- [x] Load ordinary editable source variants and autosave by problem/language/variant.
- [x] Hide navigation/reference-solution/share bypasses only in CodeGate mode.
- [x] Bind submissions to session, challenge, problem, language, and variant.
- [x] Prevent duplicate concurrent submits and ignore stale job/challenge results.
- [x] Release exactly once only after `allAccepted` for the complete official suite.
- [x] Make confirmed web Give Up independent of Docker and judge APIs; desktop IPC fallback
  for a stopped CoJudge server is completed in Milestone 4.
- [x] Persist accepted, given-up, infrastructure-failure, and abandoned outcomes in desktop
  session history through the narrow release IPC, capped to the most recent 500 entries.
- [x] Add Playwright coverage for selection, persistence, refresh races, stale results,
  duplicate submission, compile/runtime feedback, acceptance, and Give Up.
- [x] Confirm existing practice mode retains its behavior in Playwright and retain the existing
  game-mode code path outside `?codegate=1`.
- [x] Review UI/API diff for regressions, trust-boundary mistakes, and excess coupling.
  Server-side bindings, sequential chunk progress, and exactly-once release are authoritative;
  the browser cannot unlock by changing IDs or `startTcNo`. `git diff --check` passed.

Validation:

```powershell
npm.cmd test -- --run
npm.cmd run check
npm.cmd run build
npm.cmd run test:e2e
```

## Milestone 4 — Electron desktop wrapper and Windows startup

- [x] Add a thin Electron main/preload process with narrow validated IPC.
- [x] Start/stop the packaged local SvelteKit server without opening an external browser.
- [x] Check server health, Docker daemon/images, and playable catalog before activation. A
  per-launch token prevents another process occupying the configured port from passing health.
- [x] Open fullscreen gate windows across active displays after readiness succeeds.
- [x] Add accepted/Give Up release messages with exactly-once session closure.
- [x] Show actionable diagnostics and immediate Give Up on server, Docker, image, content,
  renderer, or child-process failure; never leave a trapping loading state.
- [x] Persist settings/session history in the per-user application-data directory.
- [x] Implement per-user Windows sign-in registration plus enable, disable, status, and
  uninstall cleanup commands.
- [x] Package a documented Windows production build and preserve normal web development mode.
  The final NSIS artifact is `dist-desktop/CodeGate-Setup-0.1.0.exe` (121,861,409 bytes).
- [x] Review desktop diff for command injection, navigation/IPC exposure, leaked processes,
  and any false security-boundary claims. Child commands use fixed executables/argument arrays,
  renderer navigation and popup creation are denied, preload exposes only release/status calls,
  server children are stopped on quit, and the wrapper makes no Windows-security claim.

Milestone results: 26/26 unit tests, 5/5 desktop-focused tests, Svelte check with 0 errors and
0 warnings, production build, 4/4 Playwright tests, development and packaged desktop smoke,
and the Windows NSIS build all passed. Per-user startup completed an enabled/enabled then
disabled/disabled round trip and was restored to disabled. Missing-manifest readiness exited 1;
an unavailable Docker command produced actionable diagnostics; wrong-instance port handling is
unit-tested. The only build warning is the inherited large Monaco bundle (plus electron-builder's
advisory that unpacked application resources are not integrity protection).

Validation:

```powershell
npm.cmd run check
npm.cmd test -- --run
npm.cmd run build
npm.cmd run desktop:test
npm.cmd run desktop:build
npm.cmd run desktop:smoke
```

Manual/automated failure cases: Docker down, server exits, renderer crashes, missing manifest,
missing image, Give Up during readiness, accepted release, multi-display fallback, and startup
enable/disable/status round trip.

## Milestone 5 — Offline importer and validation/quarantine pipeline

- [x] Define pluggable local-source adapters and normalized intermediate records.
- [x] Match by frontend ID then canonical slug; reject conflicts.
- [x] Pin source names/revisions and preserve attribution in generated `codegate.json` metadata
  and the import report.
- [x] Import supported existing CoJudge packs/references without runtime scraping. Unmatched
  source-only metadata remains explicitly reported rather than creating an incomplete pack.
- [x] Generate deterministic ordinary-source scaffold variants offline; generation uses the
  existing starter/reference source and accepts record-level hint overrides.
- [x] Reuse existing `Marker.java`, official-test, runner, and custom-validator conventions.
- [x] Validate references and retained completions for Python/C++ against all official tests.
- [x] Reject deliberately incorrect implementations and ensure every partial scaffold is a
  runnable failing submission; existing runner jobs isolate tests from shared user state.
- [x] Enforce existing CoJudge compilation/runtime/memory/output limits and reject dynamic test
  expressions, network-looking references, escaping paths, and unavailable local assets.
- [x] Produce byte-idempotent import/config/scaffold outputs plus machine-readable import,
  validation, playable, and quarantine results. Manifest source/judge digests fail closed after
  any post-validation content change.
- [x] Demonstrate a representative mixed-difficulty fixture batch, including unsupported and
  conflicting records that remain non-playable.
- [x] Review importer diff for unsafe paths/evaluation, nondeterminism, and runtime coupling.
  Adapters are an offline build-time registry, real paths must stay inside the repository,
  generated writes stay inside matched problem packs, timestamps are config-pinned, no source
  is evaluated, and runtime reads only the digest-bound playable manifest.

Milestone results: the local fixture adapter accepted 3 packs (Easy, Medium, Hard), skipped 3
unsupported/unmatched records, and rejected 2 conflicting records. The Docker validation matrix
ran 40 scaffold submissions plus per-language references and deliberately wrong solutions:
40/40 combinations are playable across 4 problems, Python/C++, and 5 scaffold levels, with 0
validation quarantines. Importer tests passed 2/2, the complete unit suite passed 29/29, catalog
reported 40 candidates/40 playable/0 unvalidated, Svelte check passed with 0 diagnostics,
production build passed, Playwright passed 4/4, and desktop readiness smoke passed.

Validation:

```powershell
npm.cmd run importer:test -- --offline
npm.cmd run codegate:import -- --config .\fixtures\import\config.json --offline
npm.cmd run codegate:validate -- --offline
npm.cmd test -- --run
npm.cmd run check
npm.cmd run build
```

## Milestone 6 — End-to-end hardening and documentation

- [x] Test accepted, wrong answer, compile error, runtime error, timeout, duplicate submit,
  refresh race, stale result, Docker down, server down, missing content, and Give Up flows.
- [x] Run correct and incorrect Python and C++ official submissions.
- [x] Verify a fresh offline launch after npm dependencies, Docker images, and data are cached.
- [x] Verify normal CoJudge practice and existing game modes.
- [x] Document Windows install, development/production launch, architecture, problem authoring,
  importing, validation/quarantine, troubleshooting, offline operation, startup enable/disable,
  recovery/uninstall, and self-discipline security limitations.
- [x] Count playable problems and combinations from the generated validated manifest.
- [x] Run a final requirement-by-requirement Definition of Done audit.
- [x] Review the complete diff for regressions, duplicated systems, security mistakes,
  unnecessary dependencies/complexity, placeholders, and required TODOs.

Final evidence:

- `npm.cmd ci --offline` restored 567 packages entirely from cache; the fresh install and
  `npm audit --audit-level=low` report 0 vulnerabilities. Compatible security updates moved to
  SvelteKit 2.69.2, Svelte 5.56.4, Vite 7.3.6, Vitest 3.2.7, Dockerode 5.0.1, and safe transitive
  cookie/DOMPurify overrides; the complete suite passed afterward.
- Unit: 31/31; desktop-focused: 7/7; importer-focused: 2/2; Svelte check: 0 errors/0 warnings;
  Playwright: 4/4; production web build: passed (only the Monaco chunk-size advisory remains).
- Import: 3 accepted, 3 skipped, 2 identity conflicts; byte-idempotent rerun passed. Docker
  validation: 40 candidates, 40 playable, 0 validation quarantines, 0 unvalidated candidates.
- Python and C++ correct fixtures each passed 32/32; both wrong fixtures failed test 1. Dedicated
  smoke cases confirmed syntax error, runtime error, timeout, and wrong answer rejection.
- Desktop readiness passed for source and packaged builds. Wrong-instance port, absent Docker
  command, server-exit recovery diagnostics/Give Up markup, and digest tampering have unit coverage;
  final packaged missing-content readiness exited 1. Startup completed enabled/enabled then
  disabled/disabled and was restored to disabled.
- `desktop:build` produced the final per-user NSIS installer; its unpacked executable smoke exited
  0. The custom uninstaller removes the per-user startup value. `git diff --check` passed, no test
  containers/listeners remain, and generated installer output is ignored rather than source-tracked.
- Known packaging limitation: the local development installer is not Authenticode-signed and may
  trigger SmartScreen. Signing requires an external publisher certificate and is documented as a
  release step; it does not affect the validated local build or runtime behavior.

Post-completion desktop launch correction (2026-07-12):

- [x] Remove the Electron ESM startup deadlock by registering `app.whenReady()` continuations
  without blocking main-module evaluation; the readiness smoke now covers Electron readiness.
- [x] Avoid forwarding the packaged server's output into the GUI process's absent console, which
  previously raised an uncaught `EPIPE` before the challenge renderer opened.
- [x] Re-run `node --check desktop/main.mjs`, desktop tests (7/7), readiness smoke (server and
  Docker healthy), the production build, and NSIS packaging. Reinstall the corrected per-user
  package and verify one visible challenge window, a listener on port 5375, and health reporting
  40 playable variants. Sign-in startup remains disabled.

## Post-completion UI polish (2026-07-13)

- [x] Separate same-problem language/scaffold switching from random problem refresh while
  retaining new challenge IDs and stale-submission invalidation.
- [x] Keep tooltips, editor overflow widgets, and the editor-settings popup visible at narrow pane
  and viewport boundaries.
- [x] Add focused session and Playwright regression coverage for problem identity and popup bounds.
- [x] Run unit, type, build, E2E, desktop smoke, and installed desktop verification; review the
  diff for regressions and keep normal CoJudge behavior unchanged.

Polish validation: Svelte check passed with 0 errors/0 warnings; unit tests passed 33/33;
Playwright passed 5/5 including normal-mode, same-problem selector, popup-boundary, stale-result,
and full-suite release coverage; the Playwright production build passed with only the existing
Monaco chunk-size advisory; desktop smoke reported server and Docker healthy. The rebuilt NSIS
package was installed and opened one responding challenge window on port 5375. An installed-runtime
test session kept `two-sum` while switching Python to C++, then changed to
`minimum-window-substring` only through the refresh action; health reported 40 playable variants.

## Post-completion WSL cold-start support (2026-07-13)

- [x] On Windows, wake the default WSL instance quietly and best-effort as desktop startup begins.
- [x] Keep Docker as the runtime authority: do not require WSL on other Docker backends, start a
  second engine, or couple Give Up and recovery to the wake-up attempt.
- [x] Add focused Windows/non-Windows/failure tests and document the behavior without adding a
  dependency.
- [x] Run desktop tests, unit tests, type checks, production build, and desktop readiness smoke;
  review the diff for regressions and unnecessary runtime coupling.

WSL validation: `wsl.exe --exec /bin/true` exited successfully on the target host; desktop tests
passed 10/10, the full unit suite passed 36/36, Svelte check passed with 0 errors/0 warnings, and
the production build passed with only the existing Monaco chunk-size advisory. Desktop smoke on
port 5376 reported server, WSL, and Docker healthy with no diagnostics. The first smoke invocation
was invalid because the IDE exported `ELECTRON_RUN_AS_NODE`; removing that Electron override made
the documented smoke pass. The NSIS package rebuilt successfully, was installed per-user, and a
clean installed-app restart opened one responsive challenge window with health reporting 40
playable variants; the installed readiness module contains the verified WSL command. No dependency
was added.

## Post-completion scaffold source persistence correction (2026-07-13)

- [x] Keep the active problem and active draft identity unchanged while a scaffold/language switch
  request is pending, then load the selected validated source after navigation.
- [x] Add browser coverage proving the previous scaffold's editor contents are not copied into the
  newly selected scaffold draft.
- [x] Run focused type/browser validation, package the desktop update, and verify the installed app;
  review the small diff for normal-mode regressions and stale-challenge mistakes.

Focused validation: Svelte check passed with 0 errors/0 warnings and Playwright passed 5/5,
including the regression that writes a recognizable old scaffold draft and verifies the selected
hard scaffold loads its validated source for the same problem. The already-started unit run also
passed 36/36; future small UI corrections use focused validation unless their risk warrants more.
The NSIS package rebuilt and installed successfully; the restarted installed app opened one
responsive challenge window and its health endpoint reported 40 playable variants.

## Post-completion scaffold refresh simplification (2026-07-13)

The earlier same-problem scaffold behavior is superseded by the user's requested simpler flow:
changing scaffold difficulty refreshes to another problem with that scaffold, so the statement,
LeetCode difficulty tag, and scaffold source reload together. Language switching remains on the
current problem. This is a deliberate deviation from the original same-problem scaffold wording.

- [x] Route scaffold changes through the existing refresh operation without adding selection or
  persistence systems.
- [x] Update the focused browser regression and install the resulting desktop package.

Focused validation passed 1/1. The NSIS package rebuilt and installed; after the installer's
transient first-launch recovery window was closed, a clean restart opened one responsive challenge
window and health reported 40 playable variants.

## Percentage difficulty model (2026-07-13)

This supersedes both earlier scaffold interaction corrections. Per the user's revised product
direction, difficulty changes stay on the active problem and only replace its source variant.
Difficulty is the percentage of reference implementation supplied: `Original (0%)`, `25%`, `50%`,
`75%`, and `Solution (100%)`. Imports/includes, class and function signatures, and structural
headers are preserved at intermediate levels; small TODO comments may replace removed body lines.
`Original (100%)` remains the canonical language starter. No dependency is required.

- [x] Replace named scaffold levels with the five percentage difficulty levels across generation,
  catalogs, sessions, bindings, persistence keys, UI, and documentation.
- [x] Generate nested deterministic Python/C++ reductions from the passing reference and migrate
  all active problem packs; allow only `Solution (100%)` to be an already-passing variant.
- [x] Keep language and difficulty changes on the same problem, while Different Problem remains
  the only toolbar action that refreshes problem identity.
- [ ] Validate generator invariants, all migrated combinations, the focused UI flow, packaging,
  and the installed application; update playable counts and quarantine results.

Validation so far: focused generator/model/session/catalog tests passed 14/14; Svelte check passed
with 0 errors/0 warnings; the corrected `Original (0%)` through `Solution (100%)` set passed the
existing Docker judge with 40/40 playable and 0 quarantined. Final focused browser validation,
packaging, and installed-app verification remain blocked because the host approval system reported
the Codex usage limit exhausted until 2026-07-19 20:44. The installed app therefore still runs the
previous difficulty UI and must not be treated as updated yet.

Dropdown polish (2026-07-13): the percentage difficulty selector now uses the same CSS rendering
as the programming-language selector. Per user request, this source-only polish was not compiled,
packaged, installed, or given a broad validation run yet.

Build/install automation (2026-07-13): `build-and-install.ps1` is intentionally small: it runs the
existing desktop compile/package command, stops only CodeGate, and silently installs the newest
generated package. It adds no dependency and leaves the pre-existing CoJudge CLI `install.ps1`
unchanged. The script was executed successfully: the production build, NSIS package, and silent
per-user installation all completed with exit code 0; functional testing was left to the user.
`build-and-install.bat` is a double-clickable wrapper that applies PowerShell execution-policy
bypass only to the child process and forwards failures without changing the user's policy.

Difficulty hint polish (2026-07-13): generated 25/50/75 percent variants use the problem's
metadata/import hints in place of generic TODO comments. Hints rotate across removed lines, headers
remain unchanged, and a signature-based hint is used only when a pack supplies none. Focused
generation and required activation validation passed; all 40 combinations remain playable with no
quarantine. Per user preference, routine small changes now proceed directly through
`build-and-install.bat` without broad verification unless risk or catalog activation requires it.

Validation:

```powershell
npm.cmd test -- --run
npm.cmd run check
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run codegate:validate -- --offline
npm.cmd run importer:test -- --offline
npm.cmd run desktop:test
npm.cmd run desktop:build
npm.cmd run desktop:smoke -- --offline
git diff --check
git status --short
```

Completion requires every applicable Definition of Done item to have direct evidence. Any
environmental limitation that cannot be resolved will remain unchecked with exact evidence and
will prevent a completion claim.
