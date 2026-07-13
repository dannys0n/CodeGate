param(
    [string]$ExecutablePath,
    [ValidateSet(0, 1)][int]$Logon = 1,
    [ValidateSet(0, 1)][int]$Unlock = 1,
    [ValidateSet(0, 1)][int]$Resume = 1,
    [switch]$Disable
)

$ErrorActionPreference = 'Stop'
$taskName = 'CodeGate Start Events'
$service = New-Object -ComObject 'Schedule.Service'
$service.Connect()
$root = $service.GetFolder('\')

function Remove-CodeGateTask {
    try {
        $root.DeleteTask($taskName, 0)
    } catch {
        if ($_.Exception.HResult -ne -2147024894) { throw }
    }
}

if ($Disable -or ($Logon -eq 0 -and $Unlock -eq 0 -and $Resume -eq 0)) {
    Remove-CodeGateTask
    exit 0
}

if (-not $ExecutablePath -or -not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)) {
    throw "CodeGate executable was not found: $ExecutablePath"
}

$task = $service.NewTask(0)
$task.RegistrationInfo.Description = 'Launch CodeGate at selected Windows start events.'
$task.Settings.Enabled = $true
$task.Settings.StartWhenAvailable = $true
$task.Settings.DisallowStartIfOnBatteries = $false
$task.Settings.StopIfGoingOnBatteries = $false
$task.Settings.MultipleInstances = 2
$task.Settings.ExecutionTimeLimit = 'PT0S'

$userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$task.Principal.UserId = $userSid
$task.Principal.LogonType = 3
$task.Principal.RunLevel = 0

if ($Logon -eq 1) {
    $trigger = $task.Triggers.Create(9)
    $trigger.UserId = $userSid
    $trigger.Enabled = $true
}

if ($Unlock -eq 1) {
    $trigger = $task.Triggers.Create(11)
    $trigger.UserId = $userSid
    $trigger.StateChange = 8
    $trigger.Enabled = $true
}

if ($Resume -eq 1) {
    $trigger = $task.Triggers.Create(0)
    $trigger.Subscription = "<QueryList><Query Id='0' Path='System'><Select Path='System'>*[System[Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1]]</Select></Query></QueryList>"
    $trigger.Enabled = $true
}

$action = $task.Actions.Create(0)
$action.Path = $ExecutablePath
$action.WorkingDirectory = Split-Path -Parent $ExecutablePath

$null = $root.RegisterTaskDefinition($taskName, $task, 6, $null, $null, 3, $null)
