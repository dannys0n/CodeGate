@echo off
setlocal
cd /d "%~dp0"

rem Keep IDE/tooling environment variables from forcing Electron into Node mode.
set "ELECTRON_RUN_AS_NODE="

rem Development runs use a free ephemeral port so installed or stale CodeGate
rem instances cannot collide with this test process.
for /f %%P in ('powershell.exe -NoProfile -Command "$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop(); $port"') do set "CODEGATE_PORT=%%P"
if not defined CODEGATE_PORT (
    echo Unable to reserve a free local port.
    exit /b 1
)
echo Using local port %CODEGATE_PORT%

call npm.cmd run codegate:candidates
if errorlevel 1 exit /b %errorlevel%

call npm.cmd run build
if errorlevel 1 exit /b %errorlevel%

call npm.cmd run desktop
exit /b %errorlevel%
