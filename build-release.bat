@echo off
setlocal
cd /d "%~dp0"

rem Keep IDE/tooling environment variables from forcing Electron into Node mode.
set "ELECTRON_RUN_AS_NODE="

echo Building the CodeGate Windows release...
call npm.cmd run desktop:build
if errorlevel 1 (
    echo.
    echo Release build failed. Run setup.bat first if this is a new checkout.
    exit /b 1
)

echo.
echo Release build completed successfully.
echo Installer:  dist-desktop\CodeGate-Setup-*.exe
echo Unpacked:   dist-desktop\win-unpacked\CodeGate.exe
