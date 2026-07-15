!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER
Var StartEventsDialog
Var StartAtLogonCheckbox
Var StartAtUnlockCheckbox
Var StartAtResumeCheckbox
Var StartAtLogon
Var StartAtUnlock
Var StartAtResume

!macro customInit
  StrCpy $StartAtLogon ${BST_CHECKED}
  StrCpy $StartAtUnlock ${BST_CHECKED}
  StrCpy $StartAtResume ${BST_CHECKED}

  ClearErrors
  ReadRegDWORD $0 HKCU "Software\CodeGate\StartEvents" "Configured"
  ${IfNot} ${Errors}
    ReadRegDWORD $StartAtLogon HKCU "Software\CodeGate\StartEvents" "Logon"
    ReadRegDWORD $StartAtUnlock HKCU "Software\CodeGate\StartEvents" "Unlock"
    ReadRegDWORD $StartAtResume HKCU "Software\CodeGate\StartEvents" "Resume"
  ${EndIf}
!macroend

Function StartEventsPageCreate
  nsDialogs::Create 1018
  Pop $StartEventsDialog
  ${If} $StartEventsDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Choose when Windows should automatically open CodeGate. These options can be removed by uninstalling CodeGate."
  Pop $0

  ${NSD_CreateCheckbox} 0 34u 100% 12u "Open CodeGate when I sign in to Windows"
  Pop $StartAtLogonCheckbox
  ${NSD_SetState} $StartAtLogonCheckbox $StartAtLogon

  ${NSD_CreateCheckbox} 0 54u 100% 12u "Open CodeGate when I unlock Windows"
  Pop $StartAtUnlockCheckbox
  ${NSD_SetState} $StartAtUnlockCheckbox $StartAtUnlock

  ${NSD_CreateCheckbox} 0 74u 100% 12u "Open CodeGate when the computer resumes from sleep"
  Pop $StartAtResumeCheckbox
  ${NSD_SetState} $StartAtResumeCheckbox $StartAtResume

  nsDialogs::Show
FunctionEnd

Function StartEventsPageLeave
  ${NSD_GetState} $StartAtLogonCheckbox $StartAtLogon
  ${NSD_GetState} $StartAtUnlockCheckbox $StartAtUnlock
  ${NSD_GetState} $StartAtResumeCheckbox $StartAtResume
FunctionEnd

!macro customPageAfterChangeDir
  Page custom StartEventsPageCreate StartEventsPageLeave
!macroend

!macro customInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CodeGate"

  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\desktop\start-events.ps1" -ExecutablePath "$INSTDIR\${APP_EXECUTABLE_FILENAME}" -Logon $StartAtLogon -Unlock $StartAtUnlock -Resume $StartAtResume' $0
  ${If} $0 == 0
    WriteRegDWORD HKCU "Software\CodeGate\StartEvents" "Configured" 1
    WriteRegDWORD HKCU "Software\CodeGate\StartEvents" "Logon" $StartAtLogon
    WriteRegDWORD HKCU "Software\CodeGate\StartEvents" "Unlock" $StartAtUnlock
    WriteRegDWORD HKCU "Software\CodeGate\StartEvents" "Resume" $StartAtResume
  ${Else}
    MessageBox MB_ICONEXCLAMATION|MB_OK "CodeGate was installed, but Windows start-event registration failed. You can retry it using the manual registration script."
  ${EndIf}
!macroend
!endif

!macro customUnInstall
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\desktop\start-events.ps1" -Disable' $0
  ; Fall back to the native scheduler command if PowerShell task cleanup failed.
  ${If} $0 != 0
    nsExec::ExecToLog '"$SYSDIR\schtasks.exe" /Delete /TN "CodeGate Start Events" /F'
    Pop $1
  ${EndIf}

  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CodeGate"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "CodeGate"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run32" "CodeGate"
  DeleteRegKey HKCU "Software\CodeGate"

  ; Remove only containers created by the installed CodeGate desktop app.
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\desktop\uninstall-containers.ps1"' $0
  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION|MB_OK "CodeGate was uninstalled, but Docker was unavailable or could not remove its remaining containers. Start Docker Desktop and remove containers labeled codegate.created=true to finish cleanup."
  ${EndIf}

  ; Remove Electron state, CodeGate session history, caches, and updater downloads.
  RMDir /r "$APPDATA\CodeGate"
  RMDir /r "$APPDATA\codegate"
  RMDir /r "$LOCALAPPDATA\CodeGate"
  RMDir /r "$LOCALAPPDATA\codegate"
  RMDir /r "$LOCALAPPDATA\codegate-updater"
  Delete "$LOCALAPPDATA\CrashDumps\CodeGate.exe.*.dmp"
!macroend

!macro customUnInstallSection
  Section /o "Remove all cached judge images for every language (WARNING: may affect other Docker projects)" RemoveJudgeImages
    nsExec::ExecToLog 'docker.exe image rm "python:3.11-slim" "gcc:13" "alpine/java:22-jdk" "mcr.microsoft.com/dotnet/sdk:8.0-alpine" "rust:1.78-slim" "golang:1.22-alpine" "node:22-alpine"'
    Pop $0
  SectionEnd
!macroend
