# CodeGate operations and architecture

## Architecture

CodeGate is a mode around CoJudge, not a second judge:

1. Complete `problems/<slug>` packs continue to own statements, tests, metadata, and validators.
2. `npm run codegate:candidates` writes one JSON manifest record per problem. Each record nests all
   available languages and points to hashed Neenza starters, Kamyu/Doocs solutions, and Newfacade
   test-record byte ranges.
3. The active challenge alone is loaded into memory. The editor, submission API, runner classes,
   official tests, and validators are the existing CoJudge implementations.
4. Challenge selection loads indexed assets without submitting them to the judge. The judge runs
   only after the user explicitly submits code.
5. The server binds each user submission to its current session and challenge so stale results cannot
   release the gate. Give Up and recovery do not call Docker or the judge.

CodeGate is a self-discipline gate, not a Windows security boundary.

The optional AI helper is separate from algorithm judging. It uses Docker Model Runner or a custom
OpenAI-compatible endpoint for streamed algorithm hints, selected-code explanations, and short syntax drills.
The Catalogue and AI Syntax Drill tabs are hidden until Extra problem features is enabled; their
catalog data or generated drill content is loaded only after the corresponding tab is opened.
Drill submissions compile through the existing runners and an
AI review enables their Solution button only for the exact reviewed source.
Windows provisioning requests GPU-backed inference by default and safely falls back to CPU when
Docker reports that no compatible GPU is available.
When the Docker backend is enabled, the desktop process warms the model at launch and unloads it
during normal shutdown without disabling Docker Model Runner or removing the downloaded model.
A configured custom endpoint takes priority and unloads the Docker model while leaving its stored files intact.
The model is configured for one inference slot, an 8,192-token context, no prompt cache, and no
reasoning budget; every hint or selection explanation carries all of the bounded context it needs.

## Development and packaging

Install dependencies and cache the runner images while online:

```powershell
.\setup.bat
docker pull python:3.11-slim
docker pull gcc:13
docker pull alpine/java:22-jdk
```

The setup script restores the ignored upstream repositories at the commits pinned in
`codegate/source-repositories.json`, installs npm dependencies, and regenerates the candidate
manifest. Both the source repositories and generated manifest are ignored. Pass
`-IncludeOptionalSources` only when the multi-gigabyte LiveCodeBench dataset is
needed for importer development.

Run normal web development or the desktop production build:

```powershell
npm.cmd run dev -- --host 127.0.0.1

npm.cmd run codegate:candidates
npm.cmd run build
npm.cmd run desktop
```

Build the release, install it, or launch its unpacked executable:

```powershell
.\build-release.bat
Start-Process -Wait .\dist-desktop\CodeGate-Setup-0.1.0.exe
Start-Process .\dist-desktop\win-unpacked\CodeGate.exe
```

`build-release.bat` only produces release artifacts; it does not install or launch them.
`quick-test.bat` regenerates the index and starts the development server and Electron wrapper.

The application wakes the default WSL instance and, when the Docker daemon is unavailable, runs
`docker desktop start` on a best-effort basis. It does not locate or hard-code the Docker Desktop
executable. Docker Desktop remains responsible for its WSL backend and images. The desktop prefers port 5375 and automatically selects
a free loopback port if it is occupied. Set `CODEGATE_PORT` before launch only when a fixed port is
required; an explicitly configured port does not fall back when occupied.

## Compact source index and difficulty

`npm run codegate:candidates` joins the setup-managed source repositories without compiling them.
The generated `codegate/candidate-manifest.json` contains one entry per problem ID and nests every
available Java, Python, C++, C#, Rust, Go, and TypeScript baseline beneath it. Entries contain only
relative source locations, provenance, byte offsets, normalized signatures, and hashes. JSON is
used because the records are hierarchical; CSV would duplicate problem fields across languages.

Neenza supplies identity, statements, hints, and starter signatures. Kamyu is preferred for C++;
Doocs is preferred for Python and supplies the other supported languages. Existing complete CoJudge
packs retain their official tests and custom `Marker.java`; Newfacade vectors are used only when
creating a safe exact-output pack. Executable upstream test fields are never evaluated.

Difficulty is global rather than stored per problem:

- `Original (0%)` is the starter from the problem record.
- `Solution (100%)` is the normalized baseline solution.
- 25/50/75% are deterministic, nested reductions created in memory from the baseline. At 99%,
  exactly one eligible implementation line is replaced by a hint. Headers and structural lines
  remain, and partial results need not compile.

Switching language or difficulty keeps the problem identity. Only Different Problem selects a new
problem.

Challenge preparation does not submit the 100% solution or maintain a validation cache. The compact
manifest is an index, not a claim that every solution has passed. An explicit user submission still
runs all official tests through the ordinary CoJudge API, and only a passing user submission releases
the gate.

Useful development commands:

```powershell
npm.cmd run codegate:import:audit -- --config .\codegate\import-leetcode.json --offline
npm.cmd run codegate:candidates
npm.cmd run codegate:catalog
```

When a generated problem is selected, CodeGate reads only its indexed source/test records and
creates one temporary ordinary pack under the Electron user-data directory. Selecting another
problem replaces it. Source clones are ignored during development, but required subtrees are
included in the Electron package, so a release build needs them present before `desktop:build`.
Never hand-edit the candidate manifest.

Deferred categories include linked lists, trees, design/class-operation problems, interactive
problems, SQL, shell, concurrency, external APIs, unsupported libraries and signatures, incomplete
packs, identity conflicts, and records without a trusted test/validator combination.

## Windows sign-in startup

The installer startup checkbox is enabled by default. No reboot is required after registration.
After installation, open the editor's settings gear to change the sign-in, unlock, and
resume-from-sleep triggers. Those controls read the current-user `CodeGate Start Events` scheduled
task directly, replace it when a selection changes, and keep the installer's saved choices in sync.
Development-tree commands are:

```powershell
npm.cmd run startup:enable
npm.cmd run startup:status
npm.cmd run startup:disable
```

For an installed copy:

```powershell
$CodeGateExe = (Get-ChildItem "$env:LOCALAPPDATA\Programs" -Filter CodeGate.exe -File -Recurse | Select-Object -First 1).FullName
if (-not $CodeGateExe) { throw 'CodeGate.exe was not found.' }
Start-Process -FilePath $CodeGateExe -ArgumentList '--startup=enable' -Wait
Start-Process -FilePath $CodeGateExe -ArgumentList '--startup=disable' -Wait
```

These development commands manage the current user's logon-only Windows Run value. The installer
instead creates a current-user `CodeGate Start Events` scheduled task for the selected sign-in,
unlock, and resume triggers. CodeGate does not install a Windows service. The uninstaller removes
both registration methods.

## Validation and recovery

Relevant checks are:

```powershell
npm.cmd test -- --run
npm.cmd run check
npm.cmd run build
npm.cmd run importer:test
npm.cmd run codegate:candidates
npm.cmd run codegate:failure-smoke
npm.cmd run desktop:test
```

If startup shows diagnostics, wait for Docker Desktop, check `docker info`, and inspect the required
images. A port collision can be resolved by stopping the conflicting process or setting
`CODEGATE_PORT`. Give Up remains available from recovery without the judge.

## Uninstall and cleanup

Use Settings > Apps > Installed apps > CodeGate > Uninstall, or run `Uninstall CodeGate.exe` beside
the installed executable. The uninstaller removes application files, shortcuts, scheduled startup
triggers, legacy Run registration, Electron state, local storage, caches, session history, temporary
challenge packs, updater data, crash dumps, and Docker containers labeled as created by the CodeGate
desktop app.

Docker Desktop must be available while uninstalling to remove a remaining CodeGate container. If it
is unavailable, the uninstaller displays the exact label (`codegate.created=true`) that can be used
to identify the container after Docker starts again.

Docker images are shared and are not removed by default. The optional uninstall checkbox removes
the seven default Java, Python, C++, C#, Rust, Go, and TypeScript runner images and warns that doing
so may affect other projects.

The AI model has a separate uninstall checkbox that is selected by default. Removing the model
does not disable Docker Model Runner globally because other applications may use it.
