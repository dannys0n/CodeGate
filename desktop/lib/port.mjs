import { createServer } from 'node:net';

export function configuredPort(value) {
  if (value === undefined || value === '') return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`CODEGATE_PORT must be an integer from 1 to 65535, received: ${value}`);
  }
  return port;
}

function probePort(port, host) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', (error) => {
      if (error?.code === 'EADDRINUSE' || error?.code === 'EACCES') resolve(undefined);
      else reject(error);
    });
    server.listen({ host, port, exclusive: true }, () => {
      const address = server.address();
      const selected = typeof address === 'object' && address ? address.port : undefined;
      server.close((error) => error ? reject(error) : resolve(selected));
    });
  });
}

async function portIsAvailable(port) {
  // Windows can allow an IPv4 bind beside an IPv6 wildcard listener (and the
  // reverse). Both probes must succeed before the desktop app claims a port.
  if (await probePort(port, '127.0.0.1') === undefined) return false;
  if (await probePort(port, '::') === undefined) return false;
  return true;
}

export async function selectLoopbackPort(preferredPort = 5375) {
  if (await portIsAvailable(preferredPort)) return preferredPort;

  for (let attempt = 0; attempt < 10; attempt++) {
    const ephemeral = await probePort(0, '127.0.0.1');
    if (ephemeral !== undefined && await portIsAvailable(ephemeral)) return ephemeral;
  }
  throw new Error('Unable to reserve an available local CodeGate port.');
}
