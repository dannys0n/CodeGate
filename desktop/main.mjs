import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { appendSessionHistory } from './lib/history.mjs';
import { checkDocker, localRequest, waitForServer } from './lib/readiness.mjs';
import { recoveryHtml, serverExitDiagnostics } from './lib/recovery.mjs';
import { isStartupEnabled } from './lib/startup.mjs';

const port = Number(process.env.CODEGATE_PORT || 5375);
const baseUrl = `http://127.0.0.1:${port}`;
const appRoot = app.getAppPath();
const preload = path.join(appRoot, 'desktop', 'preload.cjs');
const instanceToken = randomUUID();
const smokeTest = process.argv.includes('--smoke-test');
let serverProcess;
let windows = [];
let activeDesktopSession = null;
let released = false;
let quitting = false;
let recovering = false;
let uiReady = false;

function startupMode() {
  const argument = process.argv.find((value) => value.startsWith('--startup='));
  return argument?.split('=')[1];
}

function loginItemOptions() {
  return { path: process.execPath, args: app.isPackaged ? [] : [appRoot] };
}

async function handleStartupCommand(mode) {
  if (!['enable', 'disable', 'status'].includes(mode)) return false;
  const options = loginItemOptions();
  if (mode !== 'status') app.setLoginItemSettings({ ...options, name: 'CodeGate', openAtLogin: mode === 'enable', enabled: mode === 'enable' });
  const settings = app.getLoginItemSettings(options);
  const enabled = isStartupEnabled(settings, options);
  process.stdout.write(`CodeGate sign-in startup is ${enabled ? 'enabled' : 'disabled'}.\n`);
  app.exit(0);
  return true;
}

function startServer() {
  const serverEntry = path.join(appRoot, 'build', 'index.js');
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: appRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      HOST: '127.0.0.1',
      PORT: String(port),
      CODEGATE_DESKTOP: '1',
      CODEGATE_INSTANCE_TOKEN: instanceToken,
      BROWSER: 'none'
    }
  });
  serverProcess.stdout?.on('data', (chunk) => process.stdout.write(`[server] ${chunk}`));
  serverProcess.stderr?.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
  serverProcess.once('exit', (code) => {
    if (uiReady && !quitting && !released) showRecovery(serverExitDiagnostics(code));
  });
}

function windowOptions(display, recovery = false) {
  return {
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    fullscreen: !recovery,
    kiosk: false,
    autoHideMenuBar: true,
    backgroundColor: '#111827',
    webPreferences: { preload, contextIsolation: true, sandbox: true, nodeIntegration: false }
  };
}

function secureWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(baseUrl) && !target.startsWith('data:text/html')) event.preventDefault();
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    if (!released && !quitting) showRecovery([`Renderer stopped: ${details.reason}`]);
  });
}

async function resolveGateUrl() {
  const response = await localRequest(`${baseUrl}/gate?language=python&scaffold=medium`);
  if (response.status !== 303 || !response.headers.location) throw new Error(`Gate route returned ${response.status}`);
  const url = new URL(response.headers.location, baseUrl);
  activeDesktopSession = { sessionId: url.searchParams.get('sessionId'), challengeId: url.searchParams.get('challengeId'), startedAt: new Date().toISOString() };
  return url.href;
}

async function openGateWindows(gateUrl) {
  windows.forEach((win) => win.destroy());
  windows = screen.getAllDisplays().map((display) => {
    const win = new BrowserWindow(windowOptions(display));
    secureWindow(win);
    void win.loadURL(gateUrl);
    return win;
  });
}

function showRecovery(diagnostics) {
  if (recovering || released || quitting) return;
  recovering = true;
  const displays = screen.getAllDisplays();
  windows.forEach((win) => { if (!win.isDestroyed()) win.destroy(); });
  windows = displays.map((display) => {
    const win = new BrowserWindow(windowOptions(display, true));
    secureWindow(win);
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(recoveryHtml(diagnostics))}`);
    return win;
  });
}

async function release(outcome) {
  if (released) return { released: false, reason: 'already-released' };
  if (!['accepted', 'given-up', 'infrastructure-failure', 'abandoned'].includes(outcome)) throw new Error('Invalid release outcome');
  released = true;
  await appendSessionHistory(app.getPath('userData'), { ...activeDesktopSession, outcome, releasedAt: new Date().toISOString() });
  windows.forEach((win) => { if (!win.isDestroyed()) win.close(); });
  app.quit();
  return { released: true };
}

ipcMain.handle('codegate:release', (_event, outcome) => release(outcome));
ipcMain.handle('codegate:startup-status', () => {
  const options = loginItemOptions();
  return isStartupEnabled(app.getLoginItemSettings(options), options);
});

app.on('before-quit', () => { quitting = true; if (serverProcess && !serverProcess.killed) serverProcess.kill(); });
app.on('window-all-closed', () => { if (!released && !quitting) void release('abandoned'); });

const requestedStartupMode = startupMode();

if (requestedStartupMode) {
  await handleStartupCommand(requestedStartupMode);
} else if (smokeTest) {
  startServer();
  const server = await waitForServer(baseUrl, 60, 250, instanceToken);
  const docker = await checkDocker();
  const diagnostics = [...(server.ok ? [] : [server.error]), ...(docker.ok ? [] : docker.diagnostics)];
  process.stdout.write(`${JSON.stringify({ server: server.ok, docker: docker.ok, diagnostics })}\n`);
  quitting = true;
  serverProcess?.kill();
  await new Promise((resolve) => serverProcess?.once('exit', resolve) ?? resolve());
  process.exit(diagnostics.length === 0 ? 0 : 1);
} else {
  await app.whenReady();
  uiReady = true;
  startServer();
  const server = await waitForServer(baseUrl, 60, 250, instanceToken);
  const docker = await checkDocker();
  const diagnostics = [...(server.ok ? [] : [server.error]), ...(docker.ok ? [] : docker.diagnostics)];
  if (diagnostics.length > 0) {
    showRecovery(diagnostics);
  } else {
    try {
      await openGateWindows(await resolveGateUrl());
    } catch (error) {
      showRecovery([error instanceof Error ? error.message : String(error)]);
    }
  }
}
