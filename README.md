# CodeGate

CodeGate is a self-discipline coding gate built as a modular mode of
[CoJudge](https://github.com/cojudge/cojudge). It presents an ordinary partially completed source
file in the existing Monaco editor and releases the desktop session only when the existing
CoJudge judge accepts every official test, or when the user confirms Give Up.

CodeGate is not a Windows security boundary. Its fullscreen multi-display wrapper does not
replace sign-in, Task Manager, system recovery, or OS access controls.

## Quick start (development)

Requirements: Windows 10/11, Node.js 18+ (validated with 24.18.0), npm, Docker Desktop, and the
cached images `python:3.11-slim`, `gcc:13`, and `alpine/java:22-jdk`.

```powershell
.\setup.bat
docker pull python:3.11-slim
docker pull gcc:13
docker pull alpine/java:22-jdk
npm.cmd run build
npm.cmd run desktop
```

`setup.bat` installs npm dependencies, clones the required ignored source repositories at the exact
commits in `codegate/source-repositories.json`, and regenerates the ignored candidate manifest. It does not
download the optional 3.5 GB LiveCodeBench dataset. To include optional sources, run
`.\setup.bat -IncludeOptionalSources`.

For normal CoJudge web development, use `npm.cmd run dev -- --host 127.0.0.1`. CodeGate mode is
entered at `/gate`; ordinary problem routes and existing game mode retain their upstream behavior.

## Repository scripts

| Script | Purpose |
|---|---|
| `setup.bat` | Restore pinned sources, install dependencies, and generate the catalog. |
| `quick-test.bat` | Regenerate, build, and launch a disposable development instance. |
| `build-and-install.bat` | Compile, package, and silently replace the installed Windows app. |

The `.ps1` files paired with BAT launchers are implementation files, not additional workflows.
Normal web development and preview use `npm.cmd run dev` and `npm.cmd run preview` directly.

## Production package

```powershell
npm.cmd run desktop:build
Start-Process -Wait .\dist-desktop\CodeGate-Setup-0.1.0.exe
```

The installer is per-user by default. It includes the local SvelteKit server and imported data;
Docker and the three runner images must already be installed/cached for judging.

See [CodeGate operations and architecture](docs/CODEGATE.md) for exact startup controls, import
workflow, troubleshooting, recovery, offline operation, and uninstall steps.
Problem-pack authoring remains documented in [Adding a Problem](docs/ADD_PROBLEMS.md).

## Offline LeetCode sources

The repository includes an offline adapter pipeline for locally cloned Neenza problem metadata,
Kamyu/Doocs solutions, and Newfacade test vectors. Raw upstream clones live under ignored
`sources/`; the generated candidate manifest is also ignored and recreated during setup/build.
Generated judge data remains an ordinary CoJudge problem pack. The compact candidate
manifest stores one record per problem, with all available languages nested beneath it. It points
to the original starter, baseline solution, and structured test records instead of copying them
into permanent problem packs. The selected problem alone is exposed as a temporary ordinary
CoJudge pack and replaced when a different problem is selected.

At runtime, `Original (0%)` loads the starter, `Solution (100%)` loads the baseline, 25/50/75%
are deterministic in-memory reductions, and 99% removes exactly one implementation line. Challenge selection does not submit or
validate any solution; only an explicit user submission invokes the judge.

New sessions default to 99% difficulty and dark mode. A saved theme preference still takes precedence.

```powershell
npm.cmd run codegate:import:audit -- --config .\codegate\import-leetcode.json --offline
npm.cmd run codegate:candidates
```

Use `codegate/import-leetcode.json` as the source-index configuration. The generated manifest is a
source index, so a listed solution is not a claim that it passes the problem's official tests.
