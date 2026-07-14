$ErrorActionPreference = 'SilentlyContinue'

$docker = Get-Command docker.exe -ErrorAction SilentlyContinue
if (-not $docker) {
    exit 0
}

$containerIds = @(& $docker.Source ps --all --quiet --filter 'label=codegate.created=true' 2>$null)
if ($LASTEXITCODE -ne 0) {
    # Docker may be installed but stopped. The uninstaller reports this so the
    # user can start Docker and retry cleanup rather than silently leaving data.
    exit 2
}

if ($containerIds.Count -gt 0) {
    & $docker.Source rm --force @containerIds | Out-Null
    if ($LASTEXITCODE -ne 0) { exit 3 }
}

exit 0
