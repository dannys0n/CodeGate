@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-and-install.ps1"
if errorlevel 1 (
    echo.
    echo CodeGate build or installation failed.
    pause
    exit /b 1
)
echo.
echo CodeGate build and installation completed successfully.
pause
