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

export async function selectLoopbackPort(preferredPort = 5375, host = '127.0.0.1') {
  const preferred = await probePort(preferredPort, host);
  if (preferred !== undefined) return preferred;

  const ephemeral = await probePort(0, host);
  if (ephemeral === undefined) throw new Error('Unable to reserve an available local CodeGate port.');
  return ephemeral;
}
