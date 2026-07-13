$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

# Compile and package.
npm.cmd run desktop:build
if ($LASTEXITCODE -ne 0) { throw 'CodeGate build failed.' }

# Install the package that was just created.
$installer = Get-ChildItem '.\dist-desktop\CodeGate-Setup-*.exe' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $installer) { throw 'CodeGate installer was not created.' }

Get-Process CodeGate -ErrorAction SilentlyContinue | Stop-Process -Force
$process = Start-Process $installer.FullName -ArgumentList '/S' -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "CodeGate installation failed with exit code $($process.ExitCode)." }

Write-Host 'CodeGate compiled, packaged, and installed.' -ForegroundColor Green
