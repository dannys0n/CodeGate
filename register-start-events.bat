@echo off
setlocal

set "CODEGATE_START_EXE=%LOCALAPPDATA%\Programs\CodeGate\CodeGate.exe"
if not exist "%CODEGATE_START_EXE%" (
    echo CodeGate is not installed at:
    echo %CODEGATE_START_EXE%
    exit /b 1
)

"%CODEGATE_START_EXE%" --startup=disable >nul 2>&1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0desktop\start-events.ps1" -ExecutablePath "%CODEGATE_START_EXE%" -Logon 1 -Unlock 1 -Resume 1
if errorlevel 1 exit /b %errorlevel%

echo CodeGate will launch at sign-in, workstation unlock, and resume from sleep.
exit /b 0
