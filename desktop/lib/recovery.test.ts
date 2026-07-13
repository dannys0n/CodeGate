import { describe, expect, it } from 'vitest';
import { recoveryHtml, serverExitDiagnostics } from './recovery.mjs';

describe('desktop infrastructure recovery', () => {
  it('turns a server exit into diagnostics and an independent Give Up action', () => {
    const diagnostics = serverExitDiagnostics(17);
    const html = recoveryHtml(diagnostics);
    expect(diagnostics).toEqual(['Local CodeGate server exited unexpectedly (17).']);
    expect(html).toContain('You are not trapped');
    expect(html).toContain('id="give-up"');
    expect(html).toContain("release('infrastructure-failure')");
  });

  it('escapes infrastructure diagnostics before rendering', () => {
    expect(recoveryHtml(['<script>alert(1)</script>'])).not.toContain('<script>alert(1)</script>');
  });
});
