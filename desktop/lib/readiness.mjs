import { spawn } from 'node:child_process';
import http from 'node:http';

export const requiredImages = ['python:3.11-slim', 'gcc:13', 'alpine/java:22-jdk'];

export function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => resolve({ ok: false, stdout, stderr: `${stderr}${error.message}` }));
    child.once('close', (code) => resolve({ ok: code === 0, stdout, stderr, code }));
  });
}

export async function wakeWsl({
  platform = process.platform,
  command = 'wsl.exe',
  run = runCommand
} = {}) {
  if (platform !== 'win32') return { ok: true, attempted: false };

  const result = await run(command, ['--exec', '/bin/true'], { timeout: 10_000 });
  if (result.ok) return { ok: true, attempted: true };

  const detail = result.stderr?.trim() || result.stdout?.trim() || 'the WSL command did not complete successfully';
  return {
    ok: false,
    attempted: true,
    diagnostic: `WSL could not be started automatically: ${detail}`
  };
}

export async function waitForServer(baseUrl, attempts = 60, delayMs = 250, expectedInstanceToken) {
  let lastError = 'Local server did not respond';
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await localRequest(`${baseUrl}/api/codegate/health`);
      const body = JSON.parse(response.body);
      const correctInstance = expectedInstanceToken === undefined || body.instanceToken === expectedInstanceToken;
      const availableVariants = body.candidateVariants ?? body.playableVariants ?? 0;
      if (response.status === 200 && body.ready && availableVariants > 0 && correctInstance) return { ok: true, body };
      lastError = !correctInstance
        ? 'Port is occupied by a different local server instance'
        : body.error ?? `Health check returned ${response.status}`;
    } catch (error) {
      lastError = error instanceof SyntaxError
        ? 'Health endpoint returned a non-JSON response (the port may be occupied)'
        : error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { ok: false, error: lastError };
}

export function localRequest(url, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body }));
    });
    request.once('timeout', () => request.destroy(new Error('Local request timed out')));
    request.once('error', reject);
  });
}

export async function checkDocker(command = 'docker') {
  const daemon = await runCommand(command, ['info', '--format', '{{.ServerVersion}}']);
  if (!daemon.ok) return { ok: false, diagnostics: [`Docker daemon unavailable: ${daemon.stderr.trim() || daemon.stdout.trim()}`] };
  const diagnostics = [];
  for (const image of requiredImages) {
    const inspected = await runCommand(command, ['image', 'inspect', image]);
    if (!inspected.ok) diagnostics.push(`Required image is missing: ${image}`);
  }
  return { ok: diagnostics.length === 0, diagnostics, version: daemon.stdout.trim() };
}
