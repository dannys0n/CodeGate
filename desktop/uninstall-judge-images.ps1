$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\docker-process.ps1"

$docker = Get-Command docker.exe -ErrorAction SilentlyContinue
if (-not $docker) { exit 2 }

$images = @(
    'python:3.11-slim',
    'gcc:13',
    'alpine/java:22-jdk',
    'mcr.microsoft.com/dotnet/sdk:8.0-alpine',
    'rust:1.78-slim',
    'golang:1.22-alpine',
    'node:22-alpine'
)

$failed = $false
foreach ($image in $images) {
    $exists = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('image', 'inspect', $image) -TimeoutSeconds 15 -Quiet -AllowFailure
    if (-not $exists.Succeeded) { continue }
    $removed = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('image', 'rm', $image) -TimeoutSeconds 120 -Quiet -AllowFailure
    if (-not $removed.Succeeded) { $failed = $true }
}

if ($failed) { exit 3 }
exit 0
