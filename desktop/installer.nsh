!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER
Var StartEventsDialog
Var StartAtLogonCheckbox
Var StartAtUnlockCheckbox
Var StartAtResumeCheckbox
Var InstallAiModelCheckbox
Var StartAtLogon
Var StartAtUnlock
Var StartAtResume
Var InstallAiModel

!macro customInit
  StrCpy $StartAtLogon ${BST_CHECKED}
  StrCpy $StartAtUnlock ${BST_CHECKED}
  StrCpy $StartAtResume ${BST_CHECKED}
  StrCpy $InstallAiModel ${BST_UNCHECKED}

  ClearErrors
  ReadRegDWORD $0 HKCU "Software\CodeGate\StartEvents" "Configured"
  ${IfNot} ${Errors}
    ReadRegDWORD $StartAtLogon HKCU "Software\CodeGate\StartEvents" "Logon"
    ReadRegDWORD $StartAtUnlock HKCU "Software\CodeGate\StartEvents" "Unlock"
    ReadRegDWORD $StartAtResume HKCU "Software\CodeGate\StartEvents" "Resume"
  ${EndIf}

  ClearErrors
  ReadRegDWORD $0 HKCU "Software\CodeGate\AI" "Configured"
  ${IfNot} ${Errors}
    ReadRegDWORD $InstallAiModel HKCU "Software\CodeGate\AI" "Enabled"
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

  ${NSD_CreateCheckbox} 0 98u 100% 12u "Download and enable the AI model"
  Pop $InstallAiModelCheckbox
  ${NSD_SetState} $InstallAiModelCheckbox $InstallAiModel

  ${NSD_CreateLabel} 16u 116u 94% 28u "Optional: downloads about 2-3 GB, enables Docker Model Runner, and may make installation take several minutes."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function StartEventsPageLeave
  ${NSD_GetState} $StartAtLogonCheckbox $StartAtLogon
  ${NSD_GetState} $StartAtUnlockCheckbox $StartAtUnlock
  ${NSD_GetState} $StartAtResumeCheckbox $StartAtResume
  ${NSD_GetState} $InstallAiModelCheckbox $InstallAiModel
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

  ${If} $InstallAiModel == ${BST_CHECKED}
    DetailPrint "Enabling Docker Model Runner and downloading the AI model..."
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\desktop\ai-model.ps1" -Enable -SettingsPath "$APPDATA\CodeGate\settings.json"'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_ICONEXCLAMATION|MB_OK "CodeGate was installed, but the optional local AI model could not be prepared. You can retry from CodeGate settings."
    ${EndIf}
  ${Else}
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\desktop\ai-model.ps1" -Disable -SettingsPath "$APPDATA\CodeGate\settings.json"'
    Pop $0
  ${EndIf}
!macroend
!endif

!ifdef BUILD_UNINSTALLER
Var ImageCleanupDialog
Var RemoveJudgeImagesCheckbox
Var RemoveJudgeImages
Var RemoveAiModelCheckbox
Var RemoveAiModel

!macro customUnInit
  StrCpy $RemoveJudgeImages ${BST_UNCHECKED}
  StrCpy $RemoveAiModel ${BST_CHECKED}
!macroend

Function un.ImageCleanupPageCreate
  nsDialogs::Create 1018
  Pop $ImageCleanupDialog
  ${If} $ImageCleanupDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "CodeGate will always remove its Windows startup registrations, application data, and remaining CodeGate containers."
  Pop $0

  ${NSD_CreateCheckbox} 0 38u 100% 12u "Also remove all cached CodeGate judge Docker images"
  Pop $RemoveJudgeImagesCheckbox
  ${NSD_SetState} $RemoveJudgeImagesCheckbox $RemoveJudgeImages

  ${NSD_CreateLabel} 16u 58u 94% 34u "Warning: these language images are shared Docker resources and may also be used by other development projects. Leave this unchecked to keep them."
  Pop $0

  ${NSD_CreateCheckbox} 0 100u 100% 12u "Remove the downloaded CodeGate AI model"
  Pop $RemoveAiModelCheckbox
  ${NSD_SetState} $RemoveAiModelCheckbox $RemoveAiModel

  nsDialogs::Show
FunctionEnd

Function un.ImageCleanupPageLeave
  ${NSD_GetState} $RemoveJudgeImagesCheckbox $RemoveJudgeImages
  ${NSD_GetState} $RemoveAiModelCheckbox $RemoveAiModel
FunctionEnd

!macro customUnWelcomePage
  !insertmacro MUI_UNPAGE_WELCOME
  UninstPage custom un.ImageCleanupPageCreate un.ImageCleanupPageLeave
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

  ${If} $RemoveJudgeImages == ${BST_CHECKED}
    nsExec::ExecToLog 'docker.exe image rm "python:3.11-slim" "gcc:13" "alpine/java:22-jdk" "mcr.microsoft.com/dotnet/sdk:8.0-alpine" "rust:1.78-slim" "golang:1.22-alpine" "node:22-alpine"'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_ICONEXCLAMATION|MB_OK "CodeGate was uninstalled, but one or more shared Docker judge images could not be removed. They may still be in use by another container or Docker Desktop may be unavailable."
    ${EndIf}
  ${EndIf}

  ${If} $RemoveAiModel == ${BST_CHECKED}
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\desktop\ai-model.ps1" -Remove'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_ICONEXCLAMATION|MB_OK "CodeGate was uninstalled, but Docker Model Runner could not remove the AI model. Start Docker Desktop and remove the CodeGate AI model to finish cleanup."
    ${EndIf}
  ${EndIf}

  ; Remove Electron state, CodeGate session history, caches, and updater downloads.
  RMDir /r "$APPDATA\CodeGate"
  RMDir /r "$APPDATA\codegate"
  RMDir /r "$LOCALAPPDATA\CodeGate"
  RMDir /r "$LOCALAPPDATA\codegate"
  RMDir /r "$LOCALAPPDATA\codegate-updater"
  Delete "$LOCALAPPDATA\CrashDumps\CodeGate.exe.*.dmp"
!macroend
