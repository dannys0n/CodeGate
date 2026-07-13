# CodeGate End-to-End Implementation Brief

> Working name: **CodeGate**  
> Base repository: `https://github.com/cojudge/cojudge`  
> Target platform: Windows  
> Purpose: a self-discipline coding gate, **not** a secure OS lock screen.

## Agent Operating Rules

- [ ] Read the repository `AGENTS.md`, README, problem-format docs, runner code, submit API, and problem page before editing.
- [ ] Inspect current behavior and run the existing test/build commands before proposing changes.
- [ ] Create `PLAN.md` with small milestones, validation commands, and status checkboxes.
- [ ] Treat this document as the product specification; record necessary deviations in `PLAN.md`.
- [ ] Implement milestone by milestone; fix failed validation before continuing.
- [ ] Preserve existing CoJudge features unless this specification explicitly changes them.
- [ ] Keep changes modular and minimize edits to upstream code.
- [ ] Do not add dependencies when existing platform APIs or current dependencies are sufficient.
- [ ] Do not build a second compiler, judge, editor, or problem format.
- [ ] Do not leave placeholder implementations, dead code, or unverified “future work” in required paths.
- [ ] Make reasonable implementation decisions without stopping for minor ambiguity; document them.
- [ ] Finish with a clean working tree, passing checks, updated documentation, and a concise implementation report.

## Product Definition

- [ ] Fork and extend CoJudge as the editor, problem browser, Docker runner, and test judge.
- [ ] Package it with a thin Electron desktop wrapper.
- [ ] Launch the gate at Windows user sign-in.
- [ ] Show a normal, fully editable Monaco source file containing a partially completed solution.
- [ ] Unlock only when the submission compiles/runs and **all official tests pass**.
- [ ] Accept any implementation that passes; never compare source text with a stored answer.
- [ ] Support Python 3 and C++ first.
- [ ] Operate offline after initial installation, dataset import, npm installation, and Docker image pulls.
- [ ] Keep a visible **Give Up** route that bypasses the current gate session.

## Non-Goals

- [ ] Do not replace Windows authentication or implement a Credential Provider.
- [ ] Do not claim to prevent Task Manager, rebooting, Safe Mode, or administrator bypass.
- [ ] Do not require an LLM or network connection at runtime.
- [ ] Do not create special fill-in-the-blank inputs or locked editor regions.
- [ ] Do not require every imported problem to become playable.
- [ ] Do not enable unvalidated tests, variants, or language combinations.

## Core Architecture

- [ ] Keep CoJudge’s existing SvelteKit UI, Monaco editor, runners, Docker isolation, and submit flow.
- [ ] Add a gate-mode route/query flag without breaking normal practice mode.
- [ ] Add an Electron main process responsible for:
  - starting/stopping the local CoJudge server;
  - checking server and Docker readiness;
  - opening fullscreen gate windows;
  - Windows sign-in registration;
  - accepted/give-up session release;
  - crash-safe recovery.
- [ ] Keep problem content file-based; generate a manifest rather than adding a database server.
- [ ] Store user settings/session history locally.
- [ ] Keep importer tooling separate from runtime application code.

## Problem-Pack Extension

Extend each compatible CoJudge problem without invalidating the existing required files.

```text
problems/<slug>/
├── statement.md
├── metadata.json
├── official-tests.json
├── Marker.java
├── solution.md                 # existing optional view
├── reference/
│   ├── python.py
│   └── cpp.cpp
└── variants/
    ├── python/
    │   ├── very-easy.py
    │   ├── easy.py
    │   ├── medium.py
    │   ├── hard.py
    │   └── original.py
    └── cpp/
        ├── very-easy.cpp
        ├── easy.cpp
        ├── medium.cpp
        ├── hard.cpp
        └── original.cpp
```

- [ ] Treat a variant as an ordinary complete source file loaded into Monaco.
- [ ] Keep all source editable; users may replace the supplied implementation entirely.
- [ ] Store variant metadata such as language, scaffold level, validation status, and source path.
- [ ] Keep LeetCode difficulty separate from scaffold difficulty.
- [ ] Generate a catalog/manifest containing only playable combinations:
  `problem + language + scaffold variant`.
- [ ] Provide reference solutions outside an active gate session; do not expose them before acceptance or give-up.

## Scaffold Difficulty

The dropdown controls how much implementation is supplied.

- [ ] `Very Easy`: nearly complete; one small implementation detail removed.
- [ ] `Easy`: one statement or small logical section removed.
- [ ] `Medium`: several meaningful lines or one major section removed.
- [ ] `Hard`: most implementation removed but useful structure/comments remain.
- [ ] `Original`: canonical LeetCode-style starter code.

Variant-generation requirements:

- [ ] Generate variants offline from a known passing reference solution.
- [ ] Prefer deterministic syntax-aware removal; use Python AST and an established C++ parser only when justified.
- [ ] Never generate variants at gate startup.
- [ ] Validate every generated variant and retain its original completion for build-time verification only.
- [ ] Allow manual overrides for poor generated scaffolds.
- [ ] Disable a variant if validation is uncertain.

## Gate UI

Add a compact toolbar to the existing problem page in gate mode.

- [ ] Language selector: Python 3 / C++.
- [ ] Scaffold difficulty dropdown.
- [ ] **Different Problem** refresh button.
- [ ] **Give Up** button with a clear confirmation.
- [ ] Display the original LeetCode difficulty separately.
- [ ] Preserve language and scaffold difficulty when refreshing.
- [ ] Avoid recently shown problems when alternatives exist.
- [ ] Changing language/difficulty loads the matching variant and prevents stale submissions from unlocking.
- [ ] Autosave editor state using `problem + language + variant` as the key.
- [ ] Hide navigation and reference-solution controls that bypass the gate flow.
- [ ] Keep compiler/runtime errors visible and readable.

## Session and Submission Rules

- [ ] Create a unique gate session ID and challenge ID.
- [ ] Bind each submission to the active session, problem, language, and variant.
- [ ] Ignore successful results from an old/refreshed challenge.
- [ ] Prevent or safely cancel duplicate concurrent submissions.
- [ ] Require `allAccepted`/equivalent full-suite success before release.
- [ ] Release exactly once on either accepted submission or confirmed give-up.
- [ ] Record outcomes: accepted, given up, infrastructure failure, or abandoned.
- [ ] Define **Give Up** as bypassing only the current gate session.
- [ ] Ensure Give Up works even when Docker, CoJudge, or the judge API is unavailable.

## Startup and Recovery

- [ ] Register the Electron application for per-user Windows sign-in startup.
- [ ] Start the local CoJudge server without opening an external browser.
- [ ] Check:
  - local server health;
  - Docker daemon availability;
  - required Python/C++ images;
  - at least one playable challenge.
- [ ] Activate the gate only after readiness checks pass.
- [ ] On infrastructure failure, show diagnostics and allow immediate Give Up.
- [ ] Never trap the user behind a loading screen.
- [ ] Handle server exit, renderer crash, Docker failure, and missing content safely.
- [ ] Cover all active displays where practical, while documenting that this is not a security boundary.
- [ ] Do not intercept or replace Windows credentials or system recovery paths.

## Problem Import Pipeline

Use pluggable local sources; pin source revisions in generated metadata.

Primary candidates:

- Problem text/metadata/starter code: `neenza/leetcode-problems`
- Python/C++ reference solutions: `kamyu104/LeetCode-Solutions`
- Additional generated tests: `newfacade/LeetCodeDataset`
- Existing validated packs: CoJudge’s bundled problems

Importer checklist:

- [ ] Match records by LeetCode frontend ID, then canonical slug; reject conflicts.
- [ ] Import all discoverable metadata into a browsable catalog.
- [ ] Mark a combination playable only when its judge assets are complete and validated.
- [ ] Preserve source attribution and source revision.
- [ ] Normalize only supported problem shapes first.
- [ ] Reuse CoJudge’s existing `Marker.java` model and custom `isCorrect` validation where available.
- [ ] Do not assume exact-output comparison is valid for every problem.
- [ ] Do not scrape LeetCode during normal runtime.
- [ ] Cache all imported data locally.
- [ ] Make imports repeatable and idempotent.
- [ ] Produce a machine-readable import report with accepted, skipped, and failed records.

Initial supported scope:

- [ ] Standard function problems.
- [ ] Scalars, strings, booleans, arrays, and matrices.
- [ ] Python 3 and C++.
- [ ] Exact, order-insensitive, floating-point, mutation, and custom validation where reliably defined.

Defer until the base pipeline is stable:

- [ ] Linked lists and trees.
- [ ] Design/class-operation problems.
- [ ] Multiple-valid-construction problems without a trusted validator.
- [ ] Interactive, SQL, shell, concurrency, external-API, and randomized problems.

## Validation and Quarantine

A playable `problem + language + variant` must pass all checks:

- [ ] Metadata, signature, runner, tests, validator, and source files agree.
- [ ] The reference solution compiles/runs and passes all official tests.
- [ ] The original completion of each scaffold variant passes all tests.
- [ ] At least one deliberately incorrect solution is rejected.
- [ ] Tests are isolated from mutation and shared state.
- [ ] Runtime, memory, output, and compilation limits are enforced.
- [ ] No test requires network access or unavailable libraries.
- [ ] Validation completes within configured limits.
- [ ] Failed combinations are quarantined with a reason and never selected by the gate.

## Milestones

### 1. Baseline and Plan

- [ ] Run existing unit tests, checks, build, and a Python/C++ Docker smoke test.
- [ ] Document the current relevant architecture in `PLAN.md`.
- [ ] Add no product behavior in this milestone.

### 2. Variant Model

- [ ] Add variant discovery, manifest generation, and loading.
- [ ] Add a small hand-authored fixture set for Python and C++.
- [ ] Preserve normal CoJudge starter-code behavior outside gate mode.
- [ ] Add unit tests for selection, fallback, and recent-problem exclusion.

### 3. Gate Web Mode

- [ ] Add toolbar controls and gate session state.
- [ ] Add refresh, scaffold selection, autosave, and Give Up events.
- [ ] Add stale-submission protection.
- [ ] Add Playwright coverage for the main UI flows.

### 4. Electron Wrapper

- [ ] Package/start the local server and gate window.
- [ ] Add readiness checks and reliable release messaging.
- [ ] Add Windows sign-in registration and uninstall/disable support.
- [ ] Add crash/infrastructure recovery and multi-display behavior.
- [ ] Ensure no external browser is opened in desktop mode.

### 5. Importer

- [ ] Build repeatable source adapters and normalized intermediate records.
- [ ] Generate problem packs, references, variants, manifest, and import report.
- [ ] Validate supported Python/C++ combinations automatically.
- [ ] Demonstrate import with a representative mixed-difficulty batch.
- [ ] Keep unsupported records browsable or reported, but not playable.

### 6. End-to-End Hardening

- [ ] Run the full quality suite.
- [ ] Test accepted, wrong answer, compile error, timeout, refresh race, Docker-down, server-down, and Give Up flows.
- [ ] Test a fresh offline launch after dependencies/images/data are cached.
- [ ] Confirm normal CoJudge mode still works.
- [ ] Update installation, usage, troubleshooting, importer, and architecture docs.

## Required Quality Commands

Discover and use the repository’s actual commands. At minimum, ensure equivalent coverage for:

```text
npm test
npm run check
npm run build
npm run test:e2e
```

- [ ] Add focused tests for new modules.
- [ ] Run correct and incorrect Python submissions.
- [ ] Run correct and incorrect C++ submissions.
- [ ] Run importer fixture tests without network access.
- [ ] Fix failures before marking a milestone complete.

## Definition of Done

- [ ] One documented installation flow works on Windows.
- [ ] The desktop application starts at sign-in or can be enabled to do so.
- [ ] It opens a fullscreen coding gate only after readiness checks.
- [ ] Python 3 and C++ challenges load from partially completed source variants.
- [ ] Difficulty, refresh, and Give Up controls behave as specified.
- [ ] Any valid implementation can pass; source text is never answer-matched.
- [ ] All official tests are required for acceptance.
- [ ] Stale or duplicate submissions cannot unlock another challenge.
- [ ] Give Up and infrastructure recovery cannot depend on the judge.
- [ ] The program works offline after initial setup.
- [ ] The importer produces validated playable problems plus a clear quarantine report.
- [ ] Existing CoJudge practice mode remains functional.
- [ ] Unit, type/check, build, E2E, Docker smoke, and offline smoke tests pass.
- [ ] Documentation includes setup, architecture, adding/importing problems, troubleshooting, security limitations, and uninstall/disable instructions.
- [ ] `PLAN.md` is fully checked off or clearly records any unavoidable blockers.

## Final Agent Report

When implementation is complete, report only:

- What changed.
- Key architecture decisions.
- Validation commands and results.
- Playable problem/language counts.
- Known limitations and quarantined categories.
- Exact run, enable-at-sign-in, disable, and uninstall commands.
