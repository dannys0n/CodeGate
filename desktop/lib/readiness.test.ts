import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { waitForServer } from './readiness.mjs';

let server: http.Server | undefined;

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = undefined;
});

async function listen(body: unknown) {
  server = http.createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');
  return `http://127.0.0.1:${address.port}`;
}

describe('desktop server readiness', () => {
  it('accepts a ready catalog from the launched instance', async () => {
    const baseUrl = await listen({ ready: true, playableVariants: 10, instanceToken: 'expected' });
    await expect(waitForServer(baseUrl, 1, 0, 'expected')).resolves.toMatchObject({ ok: true });
  });

  it('rejects a healthy response from a different process on the port', async () => {
    const baseUrl = await listen({ ready: true, playableVariants: 10, instanceToken: 'stale' });
    await expect(waitForServer(baseUrl, 1, 0, 'expected')).resolves.toEqual({
      ok: false,
      error: 'Port is occupied by a different local server instance'
    });
  });
});
