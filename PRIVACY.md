# Privacy

CodeGate is designed to run its primary workflow locally. The published application does not
include analytics, advertising, telemetry, or a CodeGate account service.

## Data stored on the computer

CodeGate stores application settings, layout preferences, solved-problem progress, and session
history in the current Windows user's application-data directories. It may also create:

- Windows sign-in, unlock, and resume registrations selected by the user;
- Docker containers and images for judging and IntelliSense;
- a Docker Model Runner model when the local AI helper is enabled; and
- application caches and Windows crash dumps.

Installing a newer CodeGate version preserves this user data. A normal uninstall removes CodeGate
settings, progress, startup registrations, containers, caches, and crash dumps. The uninstaller
offers separate choices for removing downloaded judge images, IntelliSense images, and the AI
model.

## Local judging and AI

Submitted source code and test results are processed by the local CodeGate server and local Docker
containers. The Docker-backed AI helper sends its prompts only to Docker Model Runner on the
computer.

When a custom OpenAI-compatible AI endpoint is configured, CodeGate sends that endpoint the
information needed for the requested feature. Depending on the feature, this can include the
programming language, problem text, generated drill instructions, current code, or a selected code
fragment. The endpoint address is stored locally. The operator of that endpoint controls its
logging, retention, and privacy practices; CodeGate cannot enforce them.

## Downloads and third-party software

Docker may contact configured registries to download compiler, language-server, and model assets.
Those services can receive ordinary network metadata such as the computer's public IP address.
Docker Desktop and Docker Model Runner are third-party products governed by Docker's own settings,
terms, and privacy policy.

## Optional Firebase development configuration

Official CodeGate release builds do not supply Firebase configuration. The repository retains
upstream CoJudge sharing routes that can be enabled in a custom development build by supplying the
`VITE_FIREBASE_*` environment variables. When enabled and a sharing action is used, those routes
authenticate anonymously and can store shared source code, language, editor state, output, logs,
and problem identifiers in the configured Firestore project.

Do not provide Firebase configuration unless you operate the project and have established suitable
access controls, retention rules, and a privacy policy for its users.

## Questions

For a suspected security issue, follow [SECURITY.md](SECURITY.md). For a general privacy question,
open a GitHub issue without attaching private source code, credentials, or logs.
