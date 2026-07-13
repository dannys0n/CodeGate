!macro customUnInstall
  ; Login startup is per-user and must not survive removal of the executable.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "CodeGate"
!macroend
