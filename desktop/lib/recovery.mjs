export function serverExitDiagnostics(code) {
  return [`Local CodeGate server exited unexpectedly (${code ?? 'unknown'}).`];
}

export function recoveryHtml(diagnostics) {
  const escaped = diagnostics.map((item) => String(item).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])).join('</li><li>');
  return `<!doctype html><meta charset="utf-8"><title>CodeGate recovery</title><style>body{font:16px system-ui;background:#111827;color:#f9fafb;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:680px;padding:32px;background:#1f2937;border-radius:16px}button{padding:12px 18px;border:0;border-radius:8px;font-weight:700;cursor:pointer}</style><main><h1>CodeGate could not start safely</h1><p>You are not trapped. Review the diagnostics or give up this session immediately.</p><ul><li>${escaped}</li></ul><button id="give-up">Give Up</button><script>document.querySelector('#give-up').onclick=()=>window.codegateDesktop.release('infrastructure-failure')</script></main>`;
}
