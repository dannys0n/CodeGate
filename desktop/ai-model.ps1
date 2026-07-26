param(
    [switch]$Enable,
    [switch]$Disable,
    [switch]$Remove,
    [string]$SettingsPath = ''
)

$ErrorActionPreference = 'Stop'
$model = 'hf.co/jica98/qwen3.5-4B-super-coder:Q4_0'
$registryPath = 'HKCU:\Software\CodeGate\AI'
. "$PSScriptRoot\docker-process.ps1"

function Set-AiPreference([bool]$Enabled) {
    if ($SettingsPath) {
        $settings = [pscustomobject]@{}
        if (Test-Path -LiteralPath $SettingsPath) {
            try { $settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json } catch {}
        }
        $settings | Add-Member -NotePropertyName aiEnabled -NotePropertyValue $Enabled -Force
        if ($Enabled) {
            $settings | Add-Member -NotePropertyName aiDockerEnabled -NotePropertyValue $true -Force
            $settings | Add-Member -NotePropertyName aiEndpoint -NotePropertyValue '' -Force
        }
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

if ((@($Enable, $Disable, $Remove) | Where-Object { $_ }).Count -ne 1) {
    throw 'Specify exactly one of -Enable, -Disable, or -Remove.'
}

$operationMutex = New-CodeGateOperationMutex 'AI-model'
try {
    $docker = Get-Command docker.exe -ErrorAction SilentlyContinue

    if ($Disable) {
        Set-AiPreference $false
        if ($docker) {
            Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('model', 'unload', $model) -TimeoutSeconds 30 -Quiet -AllowFailure | Out-Null
        }
        exit 0
    }

    if ($Remove) {
        Remove-Item -Path $registryPath -Recurse -Force -ErrorAction SilentlyContinue
        if (-not $docker) { exit 2 }
        $status = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('model', 'status') -TimeoutSeconds 30 -Quiet -AllowFailure
        if (-not $status.Succeeded) { exit 3 }
        $installed = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('model', 'show', $model) -TimeoutSeconds 30 -Quiet -AllowFailure
        if (-not $installed.Succeeded) { exit 0 }
        Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('model', 'unload', $model) -TimeoutSeconds 30 -Quiet -AllowFailure | Out-Null
        Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('model', 'rm', $model) -TimeoutSeconds 120 | Out-Null
        exit 0
    }

    if (-not $docker) { throw 'Docker Desktop is required to install the local AI helper.' }
    $ready = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('info', '--format', '{{.ServerVersion}}') -TimeoutSeconds 15 -Quiet -AllowFailure
    if (-not $ready.Succeeded) {
        Write-Output 'Starting Docker Desktop...'
        Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('desktop', 'start', '--timeout', '60') -TimeoutSeconds 75 | Out-Null
    }

    Write-Output 'Enabling Docker Model Runner with GPU acceleration...'
    $gpu = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('desktop', 'enable', 'model-runner', '--gpu=enable', '--tcp=12434') -TimeoutSeconds 180 -AllowFailure
    if (-not $gpu.Succeeded) {
        Write-Warning 'A compatible GPU is unavailable. CodeGate will use CPU inference.'
        Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('desktop', 'enable', 'model-runner', '--tcp=12434') -TimeoutSeconds 180 | Out-Null
    }

    $installed = Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('model', 'show', $model) -TimeoutSeconds 30 -Quiet -AllowFailure
    if (-not $installed.Succeeded) {
        Write-Output 'Downloading the CodeGate AI model. This can take several minutes...'
        Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('model', 'pull', $model) -TimeoutSeconds 1200 | Out-Null
    } else {
        Write-Output 'The CodeGate AI model is already downloaded.'
    }
    Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @(
        'model', 'configure', '--context-size', '8192', '--keep-alive', '1h', $model,
        '--', '--parallel', '1', '--no-cache-prompt', '--cache-ram', '0', '--reasoning-budget', '0'
    ) -TimeoutSeconds 120 | Out-Null
    Invoke-CodeGateDocker -DockerPath $docker.Source -Arguments @('model', 'run', '--detach', $model) -TimeoutSeconds 120 | Out-Null
    Set-AiPreference $true
} finally {
    Close-CodeGateOperationMutex $operationMutex
}
