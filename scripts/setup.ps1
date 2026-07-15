param(
    [switch]$IncludeOptionalSources,
    [switch]$SkipDependencies,
    [switch]$SkipCatalog
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$sourcesRoot = Join-Path $repositoryRoot 'sources'
$lockPath = Join-Path $repositoryRoot 'codegate\source-repositories.json'

function Invoke-Git([string[]]$GitArguments) {
    & git @GitArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($GitArguments -join ' ')"
    }
}

function Normalize-Remote([string]$Remote) {
    return $Remote.Trim().TrimEnd('/').ToLowerInvariant() -replace '\.git$', ''
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is required. Install Git for Windows and run setup.bat again.'
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Node.js and npm are required. Install Node.js and run setup.bat again.'
}

$lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
if ($lock.schemaVersion -ne 1 -or -not $lock.repositories) {
    throw 'Unsupported CodeGate source repository lock file.'
}

New-Item -ItemType Directory -Path $sourcesRoot -Force | Out-Null

foreach ($source in $lock.repositories) {
    if (-not $source.required -and -not $IncludeOptionalSources) {
        Write-Host "Skipping optional source: $($source.name)" -ForegroundColor DarkGray
        continue
    }

    $target = Join-Path $sourcesRoot $source.path
    Write-Host "Preparing $($source.name)..." -ForegroundColor Cyan

    if (-not (Test-Path -LiteralPath $target)) {
        Invoke-Git @('clone', '--filter=blob:none', '--no-checkout', $source.url, $target)
    } elseif (-not (Test-Path -LiteralPath (Join-Path $target '.git'))) {
        throw "$target exists but is not a Git repository. Move or remove it, then rerun setup."
    }

    $remote = (& git -C $target remote get-url origin).Trim()
    if ($LASTEXITCODE -ne 0 -or (Normalize-Remote $remote) -ne (Normalize-Remote $source.url)) {
        throw "$target has an unexpected origin remote: $remote"
    }

    # A --no-checkout clone has no index yet, so `git diff --cached` reports
    # the entire repository as deleted. Only enforce the dirty-tree guard once
    # a checkout exists; the pinned commit below creates the initial index.
    $hasCheckout = Test-Path -LiteralPath (Join-Path $target '.git\index')
    if ($hasCheckout) {
        & git -C $target diff --quiet
        $workingTreeChanged = $LASTEXITCODE -ne 0
        & git -C $target diff --cached --quiet
        if ($workingTreeChanged -or $LASTEXITCODE -ne 0) {
            throw "$target contains tracked changes. Preserve or discard them before running setup."
        }
    }

    $currentCommit = (& git -C $target rev-parse HEAD 2>$null).Trim()
    if (-not $hasCheckout -or $currentCommit -ne $source.commit) {
        & git -C $target cat-file -e "$($source.commit)^{commit}" 2>$null
        if ($LASTEXITCODE -ne 0) {
            Invoke-Git @('-C', $target, 'fetch', '--filter=blob:none', '--depth=1', 'origin', $source.commit)
        }
        Invoke-Git @('-C', $target, 'checkout', '--detach', $source.commit)
    }
}

Push-Location $repositoryRoot
try {
    if (-not $SkipDependencies) {
        Write-Host 'Installing npm dependencies...' -ForegroundColor Cyan
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    }
    if (-not $SkipCatalog) {
        Write-Host 'Generating the CodeGate candidate manifest...' -ForegroundColor Cyan
        & npm.cmd run codegate:candidates
        if ($LASTEXITCODE -ne 0) { throw 'Candidate manifest generation failed.' }
    }
} finally {
    Pop-Location
}

Write-Host 'CodeGate repository setup is complete.' -ForegroundColor Green
