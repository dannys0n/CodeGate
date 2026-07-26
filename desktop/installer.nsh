!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "FileFunc.nsh"

!ifndef BUILD_UNINSTALLER
Var CodeGateExistingInstall
Var StartEventsDialog
Var StartAtLogonCheckbox
Var StartAtUnlockCheckbox
Var StartAtResumeCheckbox
Var InstallAiModelCheckbox
Var StartAtLogon
Var StartAtUnlock
Var StartAtResume
Var InstallAiModel
Var IntelliSenseDialog
Var IntelliSenseCppCheckbox
Var IntelliSensePythonCheckbox
Var IntelliSenseJavaCheckbox
Var IntelliSenseCSharpCheckbox
Var IntelliSenseRustCheckbox
Var IntelliSenseGoCheckbox
Var IntelliSenseTypeScriptCheckbox
Var IntelliSenseCpp
Var IntelliSensePython
Var IntelliSenseJava
Var IntelliSenseCSharp
Var IntelliSenseRust
Var IntelliSenseGo
Var IntelliSenseTypeScript
Var IntelliSenseLanguages

!macro customInit
  StrCpy $CodeGateExistingInstall 0
  StrCpy $0 ""
  ReadRegStr $0 HKCU "Software\${APP_GUID}" "InstallLocation"
  ${If} $0 == ""
    ReadRegStr $0 HKLM "Software\${APP_GUID}" "InstallLocation"
  ${EndIf}
  ${If} $0 != ""
    StrCpy $CodeGateExistingInstall 1
  ${EndIf}

  StrCpy $StartAtLogon ${BST_CHECKED}
  StrCpy $StartAtUnlock ${BST_CHECKED}
  StrCpy $StartAtResume ${BST_CHECKED}
  StrCpy $InstallAiModel ${BST_UNCHECKED}
  StrCpy $IntelliSenseCpp ${BST_CHECKED}
  StrCpy $IntelliSensePython ${BST_CHECKED}
  StrCpy $IntelliSenseJava ${BST_UNCHECKED}
  StrCpy $IntelliSenseCSharp ${BST_UNCHECKED}
  StrCpy $IntelliSenseRust ${BST_UNCHECKED}
  StrCpy $IntelliSenseGo ${BST_UNCHECKED}
  StrCpy $IntelliSenseTypeScript ${BST_UNCHECKED}

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

  ${NSD_CreateCheckbox} 0 98u 100% 12u "Enable the local AI helper"
  Pop $InstallAiModelCheckbox
  ${NSD_SetState} $InstallAiModelCheckbox $InstallAiModel

  ${NSD_CreateLabel} 16u 116u 94% 28u "Optional: CodeGate downloads and warms the AI model after launch so installation is never blocked by a multi-gigabyte download."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function StartEventsPageLeave
  ${NSD_GetState} $StartAtLogonCheckbox $StartAtLogon
  ${NSD_GetState} $StartAtUnlockCheckbox $StartAtUnlock
  ${NSD_GetState} $StartAtResumeCheckbox $StartAtResume
  ${NSD_GetState} $InstallAiModelCheckbox $InstallAiModel
FunctionEnd

Function IntelliSensePageCreate
  nsDialogs::Create 1018
  Pop $IntelliSenseDialog
  ${If} $IntelliSenseDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 26u "Choose which optional IntelliSense language servers to install now. Other languages can be installed automatically when selected in CodeGate."
  Pop $0
  ${NSD_CreateCheckbox} 0 34u 48% 12u "C++"
  Pop $IntelliSenseCppCheckbox
  ${NSD_SetState} $IntelliSenseCppCheckbox $IntelliSenseCpp
  ${NSD_CreateCheckbox} 50% 34u 48% 12u "Python"
  Pop $IntelliSensePythonCheckbox
  ${NSD_SetState} $IntelliSensePythonCheckbox $IntelliSensePython
  ${NSD_CreateCheckbox} 0 54u 48% 12u "Java"
  Pop $IntelliSenseJavaCheckbox
  ${NSD_SetState} $IntelliSenseJavaCheckbox $IntelliSenseJava
  ${NSD_CreateCheckbox} 50% 54u 48% 12u "C#"
  Pop $IntelliSenseCSharpCheckbox
  ${NSD_SetState} $IntelliSenseCSharpCheckbox $IntelliSenseCSharp
  ${NSD_CreateCheckbox} 0 74u 48% 12u "Rust"
  Pop $IntelliSenseRustCheckbox
  ${NSD_SetState} $IntelliSenseRustCheckbox $IntelliSenseRust
  ${NSD_CreateCheckbox} 50% 74u 48% 12u "Go"
  Pop $IntelliSenseGoCheckbox
  ${NSD_SetState} $IntelliSenseGoCheckbox $IntelliSenseGo
  ${NSD_CreateCheckbox} 0 94u 48% 12u "TypeScript"
  Pop $IntelliSenseTypeScriptCheckbox
  ${NSD_SetState} $IntelliSenseTypeScriptCheckbox $IntelliSenseTypeScript
  ${NSD_CreateLabel} 0 120u 100% 38u "Each selection downloads an isolated Docker image and can add several hundred MB. Servers start only for the currently selected language and stop when no longer used."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function IntelliSensePageLeave
  ${NSD_GetState} $IntelliSenseCppCheckbox $IntelliSenseCpp
  ${NSD_GetState} $IntelliSensePythonCheckbox $IntelliSensePython
  ${NSD_GetState} $IntelliSenseJavaCheckbox $IntelliSenseJava
  ${NSD_GetState} $IntelliSenseCSharpCheckbox $IntelliSenseCSharp
  ${NSD_GetState} $IntelliSenseRustCheckbox $IntelliSenseRust
  ${NSD_GetState} $IntelliSenseGoCheckbox $IntelliSenseGo
  ${NSD_GetState} $IntelliSenseTypeScriptCheckbox $IntelliSenseTypeScript
FunctionEnd

!macro customPageAfterChangeDir
  Page custom StartEventsPageCreate StartEventsPageLeave
  Page custom IntelliSensePageCreate IntelliSensePageLeave
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
      MessageBox MB_ICONEXCLAMATION|MB_OK "CodeGate was installed, but Windows start-event registration failed. You can retry it from CodeGate settings."
    ${EndIf}

    ${If} $InstallAiModel == ${BST_CHECKED}
      DetailPrint "Enabling the local AI helper..."
      nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\desktop\ai-model.ps1" -EnablePreference -SettingsPath "$APPDATA\CodeGate\settings.json"'
      Pop $0
      ${If} $0 != 0
        MessageBox MB_ICONEXCLAMATION|MB_OK "CodeGate was installed, but the optional AI preference could not be saved. You can enable it from CodeGate settings."
      ${EndIf}
    ${EndIf}

    StrCpy $IntelliSenseLanguages ""
    ${If} $IntelliSenseCpp == ${BST_CHECKED}
      StrCpy $IntelliSenseLanguages "cpp"
    ${EndIf}
    ${If} $IntelliSensePython == ${BST_CHECKED}
      ${If} $IntelliSenseLanguages == ""
        StrCpy $IntelliSenseLanguages "python"
      ${Else}
        StrCpy $IntelliSenseLanguages "$IntelliSenseLanguages,python"
      ${EndIf}
    ${EndIf}
    ${If} $IntelliSenseJava == ${BST_CHECKED}
      ${If} $IntelliSenseLanguages == ""
        StrCpy $IntelliSenseLanguages "java"
      ${Else}
        StrCpy $IntelliSenseLanguages "$IntelliSenseLanguages,java"
      ${EndIf}
    ${EndIf}
    ${If} $IntelliSenseCSharp == ${BST_CHECKED}
      ${If} $IntelliSenseLanguages == ""
        StrCpy $IntelliSenseLanguages "csharp"
      ${Else}
        StrCpy $IntelliSenseLanguages "$IntelliSenseLanguages,csharp"
      ${EndIf}
    ${EndIf}
    ${If} $IntelliSenseRust == ${BST_CHECKED}
      ${If} $IntelliSenseLanguages == ""
        StrCpy $IntelliSenseLanguages "rust"
      ${Else}
        StrCpy $IntelliSenseLanguages "$IntelliSenseLanguages,rust"
      ${EndIf}
    ${EndIf}
    ${If} $IntelliSenseGo == ${BST_CHECKED}
      ${If} $IntelliSenseLanguages == ""
        StrCpy $IntelliSenseLanguages "go"
      ${Else}
        StrCpy $IntelliSenseLanguages "$IntelliSenseLanguages,go"
      ${EndIf}
    ${EndIf}
    ${If} $IntelliSenseTypeScript == ${BST_CHECKED}
      ${If} $IntelliSenseLanguages == ""
        StrCpy $IntelliSenseLanguages "typescript"
      ${Else}
        StrCpy $IntelliSenseLanguages "$IntelliSenseLanguages,typescript"
      ${EndIf}
    ${EndIf}
    ${If} $IntelliSenseLanguages != ""
      DetailPrint "Installing selected IntelliSense language servers..."
      ${If} $CodeGateExistingInstall == 1
        ; Updating may preinstall selected images, but it must not change the
        ; user's existing in-app IntelliSense preference.
        nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\desktop\intellisense.ps1" -Install -Languages "$IntelliSenseLanguages"'
      ${Else}
        nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\desktop\intellisense.ps1" -Install -Languages "$IntelliSenseLanguages" -SettingsPath "$APPDATA\CodeGate\settings.json"'
      ${EndIf}
      Pop $0
      ${If} $0 != 0
        MessageBox MB_ICONEXCLAMATION|MB_OK "CodeGate was installed, but one or more optional IntelliSense language servers could not be prepared. CodeGate can retry when that language is selected."
      ${EndIf}
    ${EndIf}
!macroend
!endif

!ifdef BUILD_UNINSTALLER
Var ImageCleanupDialog
Var RemoveJudgeImagesCheckbox
Var RemoveJudgeImages
Var RemoveAiModelCheckbox
Var RemoveAiModel
Var RemoveIntelliSenseCheckbox
Var RemoveIntelliSense
Var CodeGateUninstallIsUpdate

!macro customUnInit
  StrCpy $RemoveJudgeImages ${BST_UNCHECKED}
  StrCpy $RemoveAiModel ${BST_CHECKED}
  StrCpy $RemoveIntelliSense ${BST_CHECKED}
  StrCpy $CodeGateUninstallIsUpdate 0

  ; Electron Builder invokes the old uninstaller with --updated while replacing
  ; an existing installation. Parse it without its optional StdUtils plugin so
  ; this custom include also compiles into the standalone uninstaller.
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  ${IfNot} ${Errors}
    StrCpy $CodeGateUninstallIsUpdate 1
  ${Else}
    ClearErrors
    ${GetOptions} $R0 "/updated" $R1
    ${IfNot} ${Errors}
      StrCpy $CodeGateUninstallIsUpdate 1
    ${EndIf}
  ${EndIf}
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

  ${NSD_CreateCheckbox} 0 66u 100% 12u "Remove the downloaded CodeGate AI model"
  Pop $RemoveAiModelCheckbox
  ${NSD_SetState} $RemoveAiModelCheckbox $RemoveAiModel

  ${NSD_CreateCheckbox} 0 90u 100% 12u "Remove all CodeGate IntelliSense language-server images"
  Pop $RemoveIntelliSenseCheckbox
  ${NSD_SetState} $RemoveIntelliSenseCheckbox $RemoveIntelliSense

  ${NSD_CreateLabel} 16u 110u 94% 30u "Recommended: these images are CodeGate-specific and can be downloaded again if CodeGate is reinstalled."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function un.ImageCleanupPageLeave
  ${NSD_GetState} $RemoveJudgeImagesCheckbox $RemoveJudgeImages
  ${NSD_GetState} $RemoveAiModelCheckbox $RemoveAiModel
  ${NSD_GetState} $RemoveIntelliSenseCheckbox $RemoveIntelliSense
FunctionEnd

!macro customUnWelcomePage
  !insertmacro MUI_UNPAGE_WELCOME
  UninstPage custom un.ImageCleanupPageCreate un.ImageCleanupPageLeave
!macroend
!endif

!macro customUnInstall
  ; Electron Builder runs the installed uninstaller as part of an in-place
  ; update. Preserve all user state and reusable Docker resources in that path.
  ${If} $CodeGateUninstallIsUpdate == 0
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
      nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\desktop\uninstall-judge-images.ps1"'
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

    ${If} $RemoveIntelliSense == ${BST_CHECKED}
      nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app.asar.unpacked\desktop\intellisense.ps1" -Remove'
      Pop $0
      ${If} $0 != 0
        MessageBox MB_ICONEXCLAMATION|MB_OK "CodeGate was uninstalled, but Docker could not remove one or more IntelliSense images. Start Docker Desktop and remove images named codegate-intellisense-* to finish cleanup."
      ${EndIf}
    ${EndIf}

    ; Remove Electron state, CodeGate session history, caches, and updater downloads.
    RMDir /r "$APPDATA\CodeGate"
    RMDir /r "$APPDATA\codegate"
    RMDir /r "$LOCALAPPDATA\CodeGate"
    RMDir /r "$LOCALAPPDATA\codegate"
    RMDir /r "$LOCALAPPDATA\codegate-updater"
    Delete "$LOCALAPPDATA\CrashDumps\CodeGate.exe.*.dmp"
  ${EndIf}
!macroend
