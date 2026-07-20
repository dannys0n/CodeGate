param(
    [switch]$Install,
    [switch]$Disable,
    [switch]$Remove,
    [string]$Languages = '',
    [string]$SettingsPath = ''
)

$ErrorActionPreference = 'Stop'
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
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'SilentlyContinue'
        & $docker.Source @Arguments *> $null
        return $LASTEXITCODE -eq 0
    } finally {
        $ErrorActionPreference = $previousPreference
    }
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
    $containerIds = @(& $docker.Source ps --all --quiet --filter 'label=codegate.intellisense=true' 2>$null)
    if ($LASTEXITCODE -ne 0) { exit 3 }
    if ($containerIds.Count -gt 0) { & $docker.Source rm --force @containerIds | Out-Null }
    foreach ($language in $supported) {
        if (Invoke-DockerProbe @('image', 'inspect', $tags[$language])) {
            & $docker.Source image rm --force $tags[$language] | Out-Null
        }
    }
    exit 0
}

if (-not $Install) { throw 'Specify -Install, -Disable, or -Remove.' }
$selected = @($Languages.Split(',') | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ -in $supported } | Select-Object -Unique)
if (-not $selected.Count) {
    Set-IntelliSensePreference $false
    exit 0
}
Set-IntelliSensePreference $true

if (-not (Invoke-DockerProbe @('info', '--format', '{{.ServerVersion}}'))) {
    & $docker.Source desktop start --timeout 60
    if ($LASTEXITCODE -ne 0) { throw 'Docker could not be started.' }
}

$assetRoot = Split-Path -Parent $PSScriptRoot
foreach ($language in $selected) {
    $tag = $tags[$language]
    if (Invoke-DockerProbe @('image', 'inspect', $tag)) { continue }
    $context = Join-Path $assetRoot "docker\intellisense\$language"
    if (-not (Test-Path -LiteralPath (Join-Path $context 'Dockerfile'))) { throw "Missing IntelliSense definition for $language." }
    Write-Output "Installing $language IntelliSense..."
    & $docker.Source build --tag $tag $context
    if ($LASTEXITCODE -ne 0) { throw "$language IntelliSense installation failed." }
}
