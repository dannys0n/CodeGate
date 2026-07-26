param(
    [switch]$Install,
    [switch]$Disable,
    [switch]$Remove,
    [string]$Languages = '',
    [string]$SettingsPath = ''
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\docker-process.ps1"
$supported = @('cpp', 'python', 'java', 'csharp', 'rust', 'go', 'typescript')
$tags = @{
    cpp = 'codegate-intellisense-cpp:1'
    python = 'codegate-intellisense-python:1'
    java = 'codegate-intellisense-java:1'
    csharp = 'codegate-intellisense-csharp:1'
    rust = 'codegate-intellisense-rust:1'
    go = 'codegate-intellisense-go:1'
    typescript = 'codegate-intellisense-typescript:1'
}

function Invoke-DockerProbe([string[]]$Arguments) {
    $result = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments $Arguments -TimeoutSeconds 15 -Quiet -AllowFailure
    return $result.Succeeded
}

function Set-IntelliSensePreference([bool]$Enabled) {
    if (-not $SettingsPath) { return }
    $settings = [pscustomobject]@{}
    if (Test-Path -LiteralPath $SettingsPath) {
        try { $settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json } catch {}
    }
    $settings | Add-Member -NotePropertyName intellisenseEnabled -NotePropertyValue $Enabled -Force
    $directory = Split-Path -Parent $SettingsPath
    $null = New-Item -ItemType Directory -Path $directory -Force
    $temporary = "$SettingsPath.tmp"
    [IO.File]::WriteAllText($temporary, ($settings | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temporary -Destination $SettingsPath -Force
}

if ((@($Install, $Disable, $Remove) | Where-Object { $_ }).Count -ne 1) {
    throw 'Specify exactly one of -Install, -Disable, or -Remove.'
}

$operationMutex = New-CodeGateOperationMutex 'IntelliSense'
try {
    if ($Disable) {
        Set-IntelliSensePreference $false
        exit 0
    }

    $docker = Get-Command docker.exe -ErrorAction SilentlyContinue
    if (-not $docker) {
        if ($Remove) { exit 2 }
        throw 'Docker Desktop or Docker Engine is required to install IntelliSense.'
    }

    if ($Remove) {
        $containers = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @(
            'ps', '--all', '--quiet', '--filter', 'label=codegate.intellisense=true'
        ) -TimeoutSeconds 15 -Quiet
        $containerIds = @($containers.Stdout -split '\r?\n' | Where-Object { $_ })
        if ($containerIds.Count -gt 0) {
            Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments (@('rm', '--force') + $containerIds) -TimeoutSeconds 60 | Out-Null
        }
        foreach ($language in $supported) {
            if (Invoke-DockerProbe @('image', 'inspect', $tags[$language])) {
                Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('image', 'rm', '--force', $tags[$language]) -TimeoutSeconds 120 | Out-Null
            }
        }
        exit 0
    }

    $selected = @($Languages.Split(',') | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ -in $supported } | Select-Object -Unique)
    if (-not $selected.Count) {
        Set-IntelliSensePreference $false
        exit 0
    }

    if (-not (Invoke-DockerProbe @('info', '--format', '{{.ServerVersion}}'))) {
        Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('desktop', 'start', '--timeout', '60') -TimeoutSeconds 75 | Out-Null
    }

    $assetRoot = Split-Path -Parent $PSScriptRoot
    foreach ($language in $selected) {
        $tag = $tags[$language]
        if (Invoke-DockerProbe @('image', 'inspect', $tag)) { continue }
        $context = Join-Path $assetRoot "docker\intellisense\$language"
        if (-not (Test-Path -LiteralPath (Join-Path $context 'Dockerfile'))) { throw "Missing IntelliSense definition for $language." }
        Write-Output "Installing $language IntelliSense..."
        Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('build', '--tag', $tag, $context) -TimeoutSeconds 900 | Out-Null
    }
    Set-IntelliSensePreference $true
} finally {
    Close-CodeGateOperationMutex $operationMutex
}
