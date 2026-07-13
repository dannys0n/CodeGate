import { describe, expect, it } from 'vitest';
import { isStartupEnabled } from './startup.mjs';

const options = { path: 'C:\\Program Files\\CodeGate\\CodeGate.exe', args: [] };

describe('Windows startup status', () => {
  it('recognizes the named enabled launch item even when Electron openAtLogin is false', () => {
    expect(isStartupEnabled({
      openAtLogin: false,
      launchItems: [{ name: 'CodeGate', enabled: true, path: options.path.toLowerCase(), args: [] }]
    }, options)).toBe(true);
  });

  it('does not treat another or disabled item as CodeGate startup', () => {
    expect(isStartupEnabled({
      openAtLogin: false,
      launchItems: [{ name: 'AnotherApp', enabled: true, path: options.path, args: [] }]
    }, options)).toBe(false);
  });
});
