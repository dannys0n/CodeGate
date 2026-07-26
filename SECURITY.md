# Security Policy

## Supported versions

Security fixes are provided for the latest published CodeGate release. Before reporting a problem,
confirm that it is still present in that version.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through
[GitHub Security Advisories](https://github.com/dannys0n/CodeGate/security/advisories/new).

Include the affected CodeGate version, Windows version, reproduction steps, and the security impact.
Logs are helpful, but remove source code, access tokens, endpoint credentials, and other personal
information before attaching them.

Do not open a public issue for an unpatched vulnerability. If private reporting is unavailable,
open a minimal issue asking the maintainer to enable a private reporting channel without including
exploit details.

CodeGate coordinates several security-sensitive boundaries, including an Electron desktop process,
a loopback-only local server, Docker containers, Windows startup registrations, and optional AI
endpoints. Reports involving any of these components are in scope. Vulnerabilities in Docker,
Docker Desktop, a configured AI service, or an imported upstream dependency should also be reported
to that project's maintainer when appropriate.

## Security expectations

CodeGate is a self-discipline application, not an operating-system security boundary. Bypassing its
interface is not itself a security vulnerability. Reports are useful when they demonstrate an
unexpected privilege boundary, arbitrary code execution outside the intended runner, unauthorized
network or file access, credential exposure, or a way for untrusted content to escape its intended
isolation.
