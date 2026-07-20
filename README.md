<div align="center">

# CodeGate

### Earn your screen time by solving a coding challenge.

CodeGate is derived from the open-source [CoJudge](https://github.com/cojudge/cojudge) offline
judge and adapts it into a fullscreen Windows self-discipline app. Finish the selected problem,
pass its official tests, and continue with your day.

![CodeGate desktop preview](docs/assets/codegate-demo-placeholder.png)

_Demo GIF coming soon._

</div>

> [!IMPORTANT]
> CodeGate is a motivational tool, not a Windows security boundary. It does not replace account
> security, parental controls, or operating-system access policies. **Give Up** and recovery remain
> available even when Docker or the judge is unavailable.

## What it does

- Opens a coding challenge at Windows sign-in, unlock, or resume from sleep.
- Uses the familiar Monaco editor with dark mode enabled by default.
- Supports Java, Python, C++, C#, Rust, Go, and TypeScript through Docker runners.
- Optionally provides semantic IntelliSense completion for every supported language through isolated, on-demand language servers.
- Optionally uses a local AI model for streamed algorithm hints, selected-code explanations, and syntax drills.
- Keeps the problem catalogue and syntax drills behind a persisted, lazy-loaded extra-features option.
- Keeps the same problem while you switch language or difficulty.
- Unlocks only after an explicit submission passes every official test for the active challenge.
- Runs locally and reuses CoJudge's problem packs, submission API, runners, and validators.

## How it works

1. CodeGate selects a compatible problem, language, starter, reference solution, and test set from
   its local catalog.
2. It derives the chosen difficulty in memory and opens the result as an ordinary source file.
3. Your submission runs through the existing CoJudge judge and Docker runner.
4. A passing result closes the gate. You can also use **Give Up** at any time.

![CodeGate workflow preview](docs/assets/workflow-placeholder.svg)

Changing difficulty never changes the active problem. The current difficulty levels are:

| Level | Editor content |
|---:|---|
| Original (0%) | The original starter supplied with the problem |
| 25%, 50%, 75% | Deterministic reductions of the reference solution |
| 99% | The reference solution with exactly one eligible implementation line replaced by a hint |
| Solution (100%) | The complete reference solution |

New sessions start at **99%**. Partial levels are learning aids and are not guaranteed to compile;
only code explicitly submitted by the user is judged.

## Getting started

CodeGate is currently built from source. You will need:

- Windows 10 or 11
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 18 or newer and npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) using its WSL 2 backend

Clone the repository, then run the setup script from PowerShell or by double-clicking it:

```powershell
git clone https://github.com/dannys0n/CodeGate.git
cd CodeGate
.\setup.bat
```

Setup installs npm dependencies, restores the required upstream data sources at pinned commits,
and generates the local problem catalog and its compact binary asset bundle. Raw source repositories
and generated catalog files are ignored by Git. Release builds include the bundle rather than tens
of thousands of loose upstream files. The optional multi-gigabyte LiveCodeBench dataset is skipped by default; importer
developers can include it with:

```powershell
.\setup.bat -IncludeOptionalSources
```

Docker Desktop may download a language image the first time that language is judged. Keep Docker
running and allow a little extra time for the first submission.

IntelliSense is optional and uses a separate Docker image for each language. Enable its single
checkbox from the editor settings; CodeGate then installs and starts only the server for the
currently selected language, and stops it when the editor switches away or closes. The installer
can preinstall any combination, with C++ and Python selected by default. Turning IntelliSense off
keeps downloaded images so it can be re-enabled without another download.

The optional AI helper can use Docker Model Runner or a custom OpenAI-compatible endpoint. The
Docker backend requires Docker Desktop 4.41 or newer; on Windows, CodeGate enables GPU-backed
inference when Docker detects a compatible GPU and otherwise falls back to CPU inference. It is
disabled by default. Enable it during installation or from the editor settings to download the AI
model (about 2–3 GB), or enter a custom endpoint to use a model managed by another local server.
A custom endpoint takes priority and unloads CodeGate's Docker model without deleting its files.
Algorithm help appears as a streamed sidebar hint; highlighting code and
choosing **Explain selection with local AI** streams its explanation into the existing Console tab.
CodeGate warms the selected backend when AI is enabled and unloads its Docker model during normal application shutdown so it
does not continue reserving VRAM after the app closes.
Its runtime profile keeps the model loaded for up to one hour between requests, uses one inference slot,
an 8K context, and no cross-request prompt cache because
each CodeGate hint is an independent request.

On Windows, CodeGate checks the Docker daemon at launch and, when necessary, asks Docker Desktop to
start through the supported `docker desktop start` command. This is best-effort; older Docker
Desktop releases without that CLI command must still be started manually.

### Quick desktop test

Run:

```powershell
.\quick-test.bat
```

This regenerates the catalog, builds the web application, selects an available local port, and
opens the Electron desktop wrapper. Its build output stays in the repository's ignored build
directories.

### Web development

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Open `/gate` for CodeGate mode. Standard CoJudge problem routes and game mode remain available
outside it.

## Build the Windows installer

Run the release script:

```powershell
.\build-release.bat
```

It creates both the installer at `dist-desktop\CodeGate-Setup-0.1.0.exe` and the unpacked app at
`dist-desktop\win-unpacked\CodeGate.exe`. It does not install or launch either artifact. Run the
installer manually when you want to test its wizard and startup options. The release command reuses
an up-to-date generated catalog; run `npm.cmd run codegate:candidates` first only after changing or
updating imported problem sources.

![CodeGate installer preview](docs/assets/installer-placeholder.svg)

The installer lets the user choose sign-in, unlock, and resume-from-sleep startup events; all three
are selected by default. The same choices can be changed later from the editor's settings gear.
An optional installer checkbox enables GPU-backed Docker Model Runner when supported and downloads the AI model. The uninstaller
offers to remove that model and selects model removal by default.
The following installer page selects which IntelliSense images to prepare; C++ and Python are
selected by default, while unselected languages remain available through lazy installation. The
uninstaller has one default-selected option to remove every CodeGate IntelliSense image.
Uninstalling CodeGate removes its scheduled startup registration,
application files, and per-user state. Removing shared Docker images is an optional uninstall step
because those images may be used by other projects.

## Publish a GitHub release

Windows releases are built by GitHub Actions from version tags. Run the interactive publisher:

```powershell
.\push-release.bat
```

Choose a patch, minor, or major increment and optionally enter a one-line release note. The script
previews the files being released, asks for confirmation, runs the type checks and test suite,
updates both package version files, creates the release commit and matching annotated tag, then
atomically pushes `main` and that tag to `origin`. The workflow places your note before a changelog
built from commits since the previous version tag. The tag push triggers GitHub Actions. The script
does not require the GitHub CLI or build the installer locally.

The `Publish Windows Release` workflow restores the pinned problem sources, validates and builds the
application on Windows, and creates a GitHub Release containing the installer and its SHA-256 file.
The tag must exactly match the package version, so `v0.2.0` requires version `0.2.0`.

GitHub supplies the release token automatically. No repository secret is required for unsigned
builds. For signed installers, add the certificate and password as Actions secrets named
`WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`; never commit signing credentials to the repository.

## Project scripts

| Script | Purpose |
|---|---|
| `setup.bat` | Prepare a fresh checkout for development |
| `quick-test.bat` | Build and launch a disposable local desktop test |
| `build-release.bat` | Produce the Windows installer and unpacked release app |
| `push-release.bat` | Validate, version, commit, tag, and publish a GitHub release |

Run `setup.bat` once after cloning, `quick-test.bat` while developing, and `build-release.bat` when
you need local distributable artifacts. Use `push-release.bat` when the current changes are ready
to push and publish through GitHub Actions. Setup's implementation lives under `scripts/` to keep
the repository root entry points simple.

## Problem catalog

The offline adapter joins several existing datasets without copying every variant into a new
problem-pack format:

- [Neenza LeetCode Problems](https://github.com/neenza/leetcode-problems) for statements and
  starter signatures
- [Kamyu104 LeetCode Solutions](https://github.com/kamyu104/LeetCode-Solutions) and
  [Doocs LeetCode](https://github.com/doocs/leetcode) for reference solutions
- Existing CoJudge packs and [Newfacade LeetCodeDataset](https://huggingface.co/datasets/newfacade/LeetCodeDataset)
  for tests and validators
- [NVIDIA LiveCodeBench-CPP](https://huggingface.co/datasets/nvidia/LiveCodeBench-CPP) as an
  optional importer-development source

The compact JSON catalog stores one record per problem with its supported languages nested beneath
it and byte ranges into one generated asset bundle. Only the selected challenge is loaded and
exposed as a temporary ordinary CoJudge pack. A
catalog entry describes a match between source assets; it is not a promise that every upstream
reference solution has already passed the selected tests.

Unsupported or unsafe combinations are quarantined instead of appearing in the picker. Current
deferred categories include interactive, SQL, shell, concurrency, external-API, linked-list, tree,
and class-operation problems that cannot yet be adapted reliably.

## Validation

Before opening a pull request, run the checks relevant to your change:

```powershell
npm.cmd test -- --run
npm.cmd run check
npm.cmd run build
npm.cmd run importer:test
npm.cmd run desktop:test
```

Catalog and recovery checks are also available:

```powershell
npm.cmd run codegate:candidates
npm.cmd run codegate:failure-smoke
```

## Documentation

- [Operations, architecture, startup, recovery, and uninstall](docs/CODEGATE.md)
- [Adding a problem pack](docs/ADD_PROBLEMS.md)
- [Adding a language runner](docs/ADD_LANGUAGE.md)

## Status

CodeGate is an early-stage Windows project. The core desktop flow, catalog generation, difficulty
selection, Docker judging, Give Up path, startup registration, and installer are implemented. The
visuals above are placeholders for public screenshots and recordings.

## License and attribution

CodeGate-specific contributions are available under the [MIT License](LICENSE). CodeGate is
derived from the MIT-licensed [CoJudge](https://github.com/cojudge/cojudge) codebase; it is not
represented as an official GitHub fork because this repository has an independent Git history.
CoJudge supplies the foundation for the web application, editor, problem-pack format, submission
API, validators, and Docker runners.

Problem statements, tests, reference solutions, and other imported material remain under their
respective upstream terms:

| Source | Declared license or status |
|---|---|
| CoJudge | MIT |
| Kamyu104 LeetCode Solutions | MIT |
| Doocs LeetCode | CC BY-SA 4.0 |
| Newfacade LeetCodeDataset | Apache 2.0 |
| NVIDIA LiveCodeBench-CPP | CC BY 4.0 |
| Neenza LeetCode Problems | No explicit license at the pinned revision |

CodeGate is an independent project and is not affiliated with or endorsed by CoJudge, LeetCode,
NVIDIA, or any referenced dataset maintainer. Attribution does not itself grant redistribution
rights. In particular, Neenza's repository contains LeetCode-derived material but does not provide
an explicit license, so it must not be bundled into a public release unless appropriate permission
or a suitably licensed replacement is obtained. Local setup downloads source repositories
separately for development.

Before distributing an installer or generated catalog, preserve all upstream notices, identify
modified material, comply with applicable attribution and share-alike requirements, and review the
terms of every included source. This project does not claim ownership of third-party problem
statements, tests, or reference solutions.
