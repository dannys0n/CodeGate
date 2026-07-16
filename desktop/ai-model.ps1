param(
    [switch]$Enable,
    [switch]$Disable,
    [switch]$Remove,
    [string]$SettingsPath = ''
)

$ErrorActionPreference = 'Stop'
$model = 'hf.co/Qwen/Qwen3-4B-GGUF:Q4_K_M'
$registryPath = 'HKCU:\Software\CodeGate\AI'

function Set-AiPreference([bool]$Enabled) {
    if ($SettingsPath) {
        $settings = [pscustomobject]@{}
        if (Test-Path -LiteralPath $SettingsPath) {
            try { $settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json } catch {}
        }
        $settings | Add-Member -NotePropertyName aiEnabled -NotePropertyValue $Enabled -Force
        $directory = Split-Path -Parent $SettingsPath
        $null = New-Item -ItemType Directory -Path $directory -Force
        $temporary = "$SettingsPath.tmp"
        $json = $settings | ConvertTo-Json -Depth 8
        [IO.File]::WriteAllText($temporary, $json, (New-Object Text.UTF8Encoding($false)))
        Move-Item -LiteralPath $temporary -Destination $SettingsPath -Force
    }
    $null = New-Item -Path $registryPath -Force
    New-ItemProperty -Path $registryPath -Name Configured -Value 1 -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $registryPath -Name Enabled -Value ([int]$Enabled) -PropertyType DWord -Force | Out-Null
}

$docker = Get-Command docker.exe -ErrorAction SilentlyContinue

if ($Disable) {
    Set-AiPreference $false
    if ($docker) { & $docker.Source model unload $model 2>$null | Out-Null }
    exit 0
}

if ($Remove) {
    Remove-Item -Path $registryPath -Recurse -Force -ErrorAction SilentlyContinue
    if (-not $docker) { exit 2 }
    & $docker.Source model status | Out-Null
    if ($LASTEXITCODE -ne 0) { exit 3 }
    & $docker.Source model show $model 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { exit 0 }
    & $docker.Source model unload $model 2>$null | Out-Null
    & $docker.Source model rm $model
    if ($LASTEXITCODE -ne 0) { exit 4 }
    exit 0
}

if (-not $Enable) { throw 'Specify -Enable, -Disable, or -Remove.' }
Set-AiPreference $true
if (-not $docker) { throw 'Docker Desktop is required to install the local AI helper.' }

& $docker.Source info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
    & $docker.Source desktop start --timeout 60
    if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop could not be started.' }
}

Write-Output 'Enabling Docker Model Runner with GPU acceleration...'
& $docker.Source desktop enable model-runner --gpu=enable --tcp=12434
if ($LASTEXITCODE -ne 0) {
    Write-Warning 'A compatible GPU is unavailable. CodeGate will use CPU inference.'
    & $docker.Source desktop enable model-runner --tcp=12434
    if ($LASTEXITCODE -ne 0) { throw 'Docker Model Runner could not be enabled.' }
}

& $docker.Source model pull $model
if ($LASTEXITCODE -ne 0) { throw 'The Qwen3 4B model download failed.' }
& $docker.Source model configure --context-size 8192 $model -- --parallel 1 --no-cache-prompt --cache-ram 0
if ($LASTEXITCODE -ne 0) { throw 'The Qwen3 4B model could not be configured for CodeGate.' }
& $docker.Source model run --detach $model
if ($LASTEXITCODE -ne 0) { throw 'The Qwen3 4B model could not be loaded.' }
