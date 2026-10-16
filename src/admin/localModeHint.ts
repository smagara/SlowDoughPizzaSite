/**
 * Local-edit-mode hint.
 * -----------------------------------------------------------------------
 * How Decap picks a backend (this is Decap's built-in behaviour, not ours):
 *   - Only when the page is served from localhost/127.0.0.1 AND config.yml
 *     has `local_backend: true`, Decap probes http://localhost:8081/api/v1
 *     (the `decap-server` proxy started by `npm run dev:cms`).
 *   - If the proxy answers, the login screen shows a plain "Login" button
 *     and edits are written straight to /content on disk.
 *   - If it does NOT answer (e.g. you ran `npm run dev` instead of
 *     `npm run dev:cms`), Decap silently falls back to the `github` backend
 *     and shows "Login with GitHub" - which works, but then every save
 *     opens a real PR against the production repo.
 *
 * That silent fallback is confusing, so on localhost we run the same probe
 * ourselves and, when it fails, render a small banner explaining how to get
 * local mode back. Production hosts are never probed.
 */
const PROXY_URL = 'http://localhost:8081/api/v1';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

async function proxyIsRunning(): Promise<boolean> {
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'info' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function renderBanner(): void {
  if (document.getElementById('sd-local-mode-hint')) return;
  const el = document.createElement('div');
  el.id = 'sd-local-mode-hint';
  el.setAttribute('role', 'status');
  el.style.cssText = [
    'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:10000',
    'background:#24211e', 'color:#e8ded3', 'font:13px/1.5 system-ui,sans-serif',
    'padding:10px 16px', 'border-top:3px solid #c85a32', 'display:flex', 'gap:12px',
    'align-items:center', 'justify-content:center', 'flex-wrap:wrap',
  ].join(';');
  el.innerHTML =
    '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#c85a32"></span>' +
    '<strong>Local edit mode is off</strong> — the <code>decap-server</code> proxy was not found on ' +
    '<code>localhost:8081</code>, so this page fell back to the <em>GitHub</em> backend (saves will open ' +
    'real pull requests). To edit the local <code>/content</code> files instead, stop the dev server and run ' +
    '<code>npm run dev:cms</code>, then reload.' +
    '<button id="sd-local-mode-hint-close" style="margin-left:8px;background:transparent;color:#e8ded3;' +
    'border:1px solid #8c8278;border-radius:6px;padding:2px 8px;cursor:pointer">dismiss</button>';
  document.body.appendChild(el);
  document.getElementById('sd-local-mode-hint-close')?.addEventListener('click', () => el.remove());
}

export function showLocalModeHintIfNeeded(): void {
  if (!LOCAL_HOSTS.has(window.location.hostname)) return;
  void proxyIsRunning().then((running) => {
    if (!running) renderBanner();
  });
}
