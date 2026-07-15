import { createServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { configuredPort, selectLoopbackPort } from './port.mjs';

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('configuredPort', () => {
  it('accepts an unset or valid port', () => {
    expect(configuredPort(undefined)).toBeUndefined();
    expect(configuredPort('49152')).toBe(49152);
  });

  it('rejects invalid ports', () => {
    expect(() => configuredPort('0')).toThrow(/1 to 65535/);
    expect(() => configuredPort('not-a-port')).toThrow(/1 to 65535/);
  });
});

describe('selectLoopbackPort', () => {
  it('falls back when the preferred port is occupied', async () => {
    const occupied = createServer();
    servers.push(occupied);
    await new Promise<void>((resolve, reject) => {
      occupied.once('error', reject);
      occupied.listen({ host: '127.0.0.1', port: 0 }, () => resolve());
    });
    const address = occupied.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a TCP port.');

    const selected = await selectLoopbackPort(address.port);
    expect(selected).not.toBe(address.port);
    expect(selected).toBeGreaterThan(0);
  });
});
