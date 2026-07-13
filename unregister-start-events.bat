@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0desktop\start-events.ps1" -Disable >nul 2>&1

set "CODEGATE_START_EXE=%LOCALAPPDATA%\Programs\CodeGate\CodeGate.exe"
if exist "%CODEGATE_START_EXE%" "%CODEGATE_START_EXE%" --startup=disable >nul 2>&1

echo CodeGate automatic start events are disabled.
exit /b 0
