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
npm.cmd ci
docker pull python:3.11-slim
docker pull gcc:13
docker pull alpine/java:22-jdk
npm.cmd run codegate:validate -- --offline
npm.cmd run build
npm.cmd run desktop
```

For normal CoJudge web development, use `npm.cmd run dev -- --host 127.0.0.1`. CodeGate mode is
entered at `/gate`; ordinary problem routes and existing game mode retain their upstream behavior.

## Production package

```powershell
npm.cmd run desktop:build
Start-Process -Wait .\dist-desktop\CodeGate-Setup-0.1.0.exe
```

The installer is per-user by default. It includes the local SvelteKit server and imported data;
Docker and the three runner images must already be installed/cached for judging.

See [CodeGate operations and architecture](docs/CODEGATE.md) for exact startup controls, import
and quarantine workflow, troubleshooting, recovery, offline operation, and uninstall steps.
Problem-pack authoring remains documented in [Adding a Problem](docs/ADD_PROBLEMS.md).

## Offline LeetCode sources

The repository includes an offline adapter pipeline for locally cloned Neenza problem metadata,
Kamyu/Doocs solutions, and Newfacade test vectors. Raw upstream clones live under ignored
`sources/`; generated output remains an ordinary CoJudge problem pack. Imported records currently
emit only `Original (0%)` and `Solution (100%)`. Nothing becomes playable until the existing Docker
judge validates the reference, original starter, and incorrect control.

```powershell
npm.cmd run codegate:import:audit -- --config .\codegate\import-leetcode.json --offline
npm.cmd run codegate:import -- --config .\codegate\import-leetcode-smoke.json --offline
npm.cmd run codegate:validate -- --offline
```

Use `codegate/import-leetcode.json` for the complete candidate import. Because validation executes
real submissions, use `frontendIds` in a copied config to import and validate manageable batches.
