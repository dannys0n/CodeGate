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

  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app\desktop\start-events.ps1" -ExecutablePath "$INSTDIR\${APP_EXECUTABLE_FILENAME}" -Logon $StartAtLogon -Unlock $StartAtUnlock -Resume $StartAtResume' $0
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
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app\desktop\start-events.ps1" -Disable' $0
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CodeGate"
  DeleteRegKey HKCU "Software\CodeGate\StartEvents"
!macroend
