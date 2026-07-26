$ErrorActionPreference = 'SilentlyContinue'
. "$PSScriptRoot\docker-process.ps1"

$docker = Get-Command docker.exe -ErrorAction SilentlyContinue
if (-not $docker) {
    exit 0
}

$judgeResult = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @(
    'ps', '--all', '--quiet', '--filter', 'label=codegate.created=true'
) -TimeoutSeconds 15 -Quiet -AllowFailure
if (-not $judgeResult.Succeeded) {
    # Docker may be installed but stopped. The uninstaller reports this so the
    # user can start Docker and retry cleanup rather than silently leaving data.
    exit 2
}
$intellisenseResult = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @(
    'ps', '--all', '--quiet', '--filter', 'label=codegate.intellisense=true'
) -TimeoutSeconds 15 -Quiet -AllowFailure
if (-not $intellisenseResult.Succeeded) { exit 2 }
$judgeIds = @($judgeResult.Stdout -split '\r?\n' | Where-Object { $_ })
$intellisenseIds = @($intellisenseResult.Stdout -split '\r?\n' | Where-Object { $_ })
$containerIds = @($judgeIds + $intellisenseIds | Select-Object -Unique)

if ($containerIds.Count -gt 0) {
    $removed = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments (@('rm', '--force') + $containerIds) -TimeoutSeconds 60 -Quiet -AllowFailure
    if (-not $removed.Succeeded) { exit 3 }
}

exit 0
