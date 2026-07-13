# CodeGate operations and architecture

## Architecture

CodeGate is a mode around CoJudge, not a second judge:

1. The offline importer augments complete existing `problems/<slug>` packs with pinned references,
   ordinary source difficulty variants, and `codegate.json`.
2. `scripts/codegate/validate.mjs` submits references, deliberately wrong sources, and every
   difficulty variant through `bin/cojudge`, the existing Docker runners, `official-tests.json`, and
   `Marker.java` custom validator.
3. Only successful combinations enter `codegate/playable-manifest.json`. Each entry binds the
   source and judge assets to SHA-256 digests; post-validation edits fail readiness until the
   validator is rerun.
4. `/gate` creates an in-memory session and challenge. The existing problem page, Monaco editor,
   submission API, runner classes, and sequential official-test batching remain in use.
5. The server authoritatively binds each submit to session, challenge, problem, language, difficulty,
   submission ID, and expected test offset. A refreshed/stale result cannot release the session.
6. Electron starts the packaged Node adapter server, validates server/catalog/Docker/image
   readiness, and then opens one fullscreen window per active display. The preload exposes only
   release and startup-status IPC. Accepted, given-up, infrastructure-failure, and abandoned
   outcomes are appended under Electron's per-user data directory (up to 500 entries).

Give Up and infrastructure recovery are main-process operations. They do not call Docker or the
judge, and a server/renderer failure replaces the gate with a local recovery page containing Give
Up. The desktop wrapper never opens an external browser.

## Development and production commands

Install/cache once while online:

```powershell
npm.cmd ci
docker pull python:3.11-slim
docker pull gcc:13
docker pull alpine/java:22-jdk
npx.cmd playwright install chromium
```

Normal CoJudge web development:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Desktop development (the wrapper runs the production Node build):

```powershell
npm.cmd run build
npm.cmd run desktop
```

Production installer and direct unpacked launch:

```powershell
npm.cmd run desktop:build
Start-Process -Wait .\dist-desktop\CodeGate-Setup-0.1.0.exe
Start-Process .\dist-desktop\win-unpacked\CodeGate.exe
```

To compile, package, and replace the per-user installation in one command:

```powershell
.\build-and-install.ps1
```

Alternatively, double-click `build-and-install.bat`; it invokes the same script with PowerShell's
execution-policy bypass for that process only.

The script runs `desktop:build`, stops only processes named `CodeGate`, and silently installs the
newest generated `CodeGate-Setup-*.exe`. It does not change the existing CoJudge CLI-oriented
`install.ps1`.

The installed application is also available through Start > CodeGate. Set `CODEGATE_PORT` before
launch to use a local port other than 5375. CodeGate refuses to treat another process on that port
as its server because health is bound to a per-launch instance token.

On Windows, desktop startup also runs `wsl.exe --exec /bin/true` in the background to wake the
default WSL instance before checking Docker. This is best-effort: Docker remains responsible for
its own WSL 2 backend, and CodeGate still supports Docker configurations that do not use WSL. If
WSL cannot start but Docker is healthy, the gate continues normally; if Docker is unavailable, the
recovery page includes both diagnostics when relevant. CodeGate does not install or enable WSL.

The local development installer is not Authenticode-signed (`Get-AuthenticodeSignature` reports
`NotSigned`), so Windows SmartScreen may warn. A distributed release should be signed with the
publisher's Windows code-signing certificate; do not bypass a warning for an artifact whose
provenance you cannot verify.

## Windows sign-in startup

Development-tree commands (these were tested as an enabled/status/disabled/status round trip):

```powershell
npm.cmd run startup:enable
npm.cmd run startup:status
npm.cmd run startup:disable
```

For an installed copy, first resolve the executable, including a custom per-user install location,
then issue the same command directly:

```powershell
$CodeGateExe = (Get-ChildItem "$env:LOCALAPPDATA\Programs" -Filter CodeGate.exe -File -Recurse | Select-Object -First 1).FullName
if (-not $CodeGateExe) { throw 'CodeGate.exe was not found under the per-user Programs directory.' }
Start-Process -FilePath $CodeGateExe -ArgumentList '--startup=enable' -Wait
Start-Process -FilePath $CodeGateExe -ArgumentList '--startup=status' -Wait
Start-Process -FilePath $CodeGateExe -ArgumentList '--startup=disable' -Wait
```

The registration is the `CodeGate` value under the current user's Windows Run key; it is not a
scheduled task or machine-wide service. It can also be disabled at Settings > Apps > Startup >
CodeGate. The NSIS uninstaller removes this value even if startup was not disabled first.

## Offline import, validation, and quarantine

Importing is an explicit offline build operation; runtime never scrapes LeetCode or generates
variants. A config pins adapter name, local path, source name, source revision, deterministic report
timestamp, and report location. The bundled fixture demonstrates Easy/Medium/Hard records:

```powershell
npm.cmd run importer:test -- --offline
npm.cmd run codegate:import -- --config .\fixtures\import\config.json --offline
npm.cmd run codegate:regenerate-difficulties
npm.cmd run codegate:validate -- --offline
npm.cmd run codegate:catalog
```

The `local-json` adapter normalizes `frontendId`, canonical `slug`, `shape`, language references,
incorrect solutions and validator kind. Matching uses frontend ID first
when repository metadata has it, then canonical slug; disagreement and duplicate identity mappings
are rejected. Source real paths and generated outputs must stay inside the repository.

Difficulty is the percentage of the validated reference implementation supplied. The selectable
levels are `Original (0%)`, `25%`, `50%`, `75%`, and `Solution (100%)`. Intermediate Python/C++
files are deterministic nested reductions of the reference: imports/includes, class and function
signatures, structural control-flow headers, braces, and loop-progress mutations are preserved.
Removed executable lines become small TODO comments or harmless placeholders. Changing difficulty
or language stays on the active problem; only Different Problem refreshes problem identity.

Import writes `codegate/import-report.json` with `accepted`, `skipped`, and `failed` records. An
accepted record is only pending validation. The existing playable manifest remains the activation
authority. Validation writes `codegate/validation-report.json`; a failed combination is omitted and
listed with its reason.

Initial supported scope is ordinary function problems in Python 3/C++ with CoJudge scalar, string,
boolean, array, and matrix types and a trusted existing `Marker.java`. Exact, order-insensitive,
floating-point, mutation, and multiple-valid answers are accepted only through that trusted custom
validator—not by importer assumptions. Dynamic test expressions and references that appear to
require a network are rejected in this initial offline scope.

Quarantined/deferred categories are linked lists, trees, design/class-operation problems,
interactive problems, SQL, shell, concurrency, external APIs, randomized tests, unsupported
libraries, incomplete packs, identity conflicts, and any language/difficulty whose reference,
incorrect control, partial variant, or official test validation fails.

To add a complete existing pack manually, add ordinary Python/C++ references and percentage source
variants under its problem directory, declare their relative paths in `codegate.json`, and run
`codegate:validate`. Never hand-edit the playable manifest. See `fixtures/import` for adapter input
and `problems/two-sum/codegate.json` for the direct pack format.

## Validation and recovery

Required checks:

```powershell
npm.cmd test -- --run
npm.cmd run check
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run importer:test -- --offline
npm.cmd run codegate:validate -- --offline
npm.cmd run codegate:failure-smoke
npm.cmd run desktop:test
npm.cmd run desktop:smoke
npm.cmd run desktop:build
```

If startup shows diagnostics:

- Confirm `wsl.exe --status` succeeds if Docker Desktop is configured to use its WSL 2 backend.
- Start Docker Desktop and wait for `docker info` to succeed.
- Confirm `docker image inspect python:3.11-slim gcc:13 alpine/java:22-jdk` succeeds; pull a missing
  image while online.
- Stop the other local process or set a free `CODEGATE_PORT` if the port-collision diagnostic is
  shown.
- Rerun `npm.cmd run codegate:validate -- --offline` if catalog assets changed or are missing.
- Use Give Up on the recovery page immediately if the server, Docker, renderer, or content cannot
  recover. This records infrastructure failure and exits without invoking the judge.

Compiler errors, runtime errors, wrong answers, and timeouts remain visible in the existing result
panel and do not unlock. Drafts are namespaced by problem/language/difficulty in Chromium local
storage. A fresh challenge invalidates any in-flight result from the previous challenge.

## Uninstall and data recovery

Before uninstall, optionally disable startup using the installed command above. Then open Settings
> Apps > Installed apps > CodeGate > Uninstall, or run the `Uninstall CodeGate.exe` found beside the
installed `CodeGate.exe`. Uninstall removes application files and the CodeGate sign-in Run value,
but intentionally preserves per-user history/drafts.

To remove preserved data after uninstall (irreversible), close CodeGate, verify the resolved path,
then remove only that directory:

```powershell
$CodeGateData = Join-Path $env:APPDATA 'CodeGate'
$CodeGateData = [System.IO.Path]::GetFullPath($CodeGateData)
if ($CodeGateData -ne [System.IO.Path]::GetFullPath((Join-Path $env:APPDATA 'CodeGate'))) { throw 'Unexpected data path' }
Remove-Item -LiteralPath $CodeGateData -Recurse -Force -ErrorAction SilentlyContinue
```

Docker images are shared with CoJudge and other projects; do not remove them merely to uninstall
CodeGate. If they are known to be unused, `docker image rm python:3.11-slim gcc:13
alpine/java:22-jdk` removes them. Deleting the repository removes development artifacts; it does not
remove an installed app.

## Security limitations

CodeGate is deliberately a self-discipline gate. Fullscreen is not kiosk mode. It does not block
Alt+Tab, Task Manager, command shells, accessibility tools, Safe Mode, other accounts, shutdown, or
Windows recovery. It does not intercept credentials, replace the lock screen, install a privileged
service, or protect its local files from the user. Do not use it for parental control, exam
proctoring, access control, or protection from a malicious local user.
