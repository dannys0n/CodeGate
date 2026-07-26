function ConvertTo-CodeGateProcessArgument {
    param([AllowEmptyString()][string]$Value)

    if ($Value.Length -eq 0) { return '""' }
    if ($Value -notmatch '[\s"]') { return $Value }
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return "`"$escaped`""
}

function Invoke-CodeGateDocker {
    param(
        [Parameter(Mandatory)][string]$DockerPath,
        [Parameter(Mandatory)][string[]]$Arguments,
        [ValidateRange(1, 7200)][int]$TimeoutSeconds = 60,
        [switch]$Quiet,
        [switch]$AllowFailure
    )

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $DockerPath
    $startInfo.Arguments = ($Arguments | ForEach-Object { ConvertTo-CodeGateProcessArgument ([string]$_) }) -join ' '
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = [bool]$Quiet
    $startInfo.RedirectStandardError = [bool]$Quiet

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw "Unable to start Docker command: docker $($Arguments -join ' ')" }

    $stdoutTask = if ($Quiet) { $process.StandardOutput.ReadToEndAsync() } else { $null }
    $stderrTask = if ($Quiet) { $process.StandardError.ReadToEndAsync() } else { $null }
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        & "$env:SystemRoot\System32\taskkill.exe" /PID $process.Id /T /F *> $null
        try { $process.WaitForExit(5000) | Out-Null } catch {}
        throw "Docker command timed out after $TimeoutSeconds seconds: docker $($Arguments -join ' ')"
    }
    $process.Refresh()

    $stdout = if ($stdoutTask) { $stdoutTask.GetAwaiter().GetResult() } else { '' }
    $stderr = if ($stderrTask) { $stderrTask.GetAwaiter().GetResult() } else { '' }
    $result = [pscustomobject]@{
        Succeeded = $process.ExitCode -eq 0
        ExitCode = $process.ExitCode
        Stdout = $stdout
        Stderr = $stderr
    }
    $process.Dispose()

    if (-not $result.Succeeded -and -not $AllowFailure) {
        $detail = $result.Stderr.Trim()
        if (-not $detail) { $detail = "docker $($Arguments -join ' ') exited with code $($result.ExitCode)" }
        throw $detail
    }
    return $result
}

function New-CodeGateOperationMutex {
    param([Parameter(Mandatory)][string]$Name)

    $mutex = New-Object System.Threading.Mutex($false, "Local\CodeGate.$Name")
    try {
        $acquired = $mutex.WaitOne(0)
    } catch [System.Threading.AbandonedMutexException] {
        $acquired = $true
    }
    if (-not $acquired) {
        $mutex.Dispose()
        throw "Another CodeGate $Name operation is already running."
    }
    return $mutex
}

function Close-CodeGateOperationMutex {
    param([System.Threading.Mutex]$Mutex)

    if (-not $Mutex) { return }
    try { $Mutex.ReleaseMutex() } catch {}
    $Mutex.Dispose()
}
