/**
 * GitHub OAuth handler for Decap CMS — Slow Dough Pizza Co.
 *
 * Decap's GitHub backend needs a tiny server-side component to complete the
 * OAuth "web application flow", because the GitHub client secret must never
 * ship to the browser. This module implements that component with only the
 * web-standard Request/Response API, so the same code runs unchanged as a
 * Cloudflare Worker (worker.mjs) or a plain Node HTTP server (server.mjs).
 *
 * Flow (see docs/ for the diagram):
 *   1. /admin opens a popup to   GET {base_url}/auth?provider=github&scope=repo
 *   2. /auth sets a random `state` cookie and redirects to github.com/login/oauth/authorize
 *   3. GitHub sends the user back to GET /callback?code=…&state=…
 *   4. /callback verifies `state`, exchanges the code for an access token,
 *      checks that the user has WRITE access to the configured repository,
 *      and hands the token to the opener window with the postMessage
 *      handshake Decap expects. Non-collaborators never receive a token.
 *
 * Environment / secrets
 *   GITHUB_CLIENT_ID      OAuth App client id          (required)
 *   GITHUB_CLIENT_SECRET  OAuth App client secret      (required, secret)
 *   GITHUB_REPO           "owner/name" to authorise    (required)
 *   ALLOWED_ORIGINS       comma-separated site origins allowed to receive the
 *                         token, e.g. "https://owner.github.io" (required)
 *   OAUTH_SCOPE           "repo" (default, private repos) or "public_repo"
 *   REQUIRE_WRITE_ACCESS  "true" (default) — reject users without push rights
 *   GITHUB_WEB_BASE       optional, GitHub Enterprise web URL (default https://github.com)
 *   GITHUB_API_BASE       optional, GitHub Enterprise API URL (default https://api.github.com)
 */

// Overridable for GitHub Enterprise Server (and for tests).
function githubWeb(env) {
  return (env.GITHUB_WEB_BASE || 'https://github.com').replace(/\/$/, '');
}
function githubApi(env) {
  return (env.GITHUB_API_BASE || 'https://api.github.com').replace(/\/$/, '');
}
const STATE_COOKIE = 'decap_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;

/* ------------------------------------------------------------------------- */
/* helpers                                                                    */
/* ------------------------------------------------------------------------- */

function required(env, key) {
  const v = env[key];
  if (!v) throw new Error(`Missing required setting ${key}`);
  return v;
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function parseCookies(header) {
  const out = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // The callback page only needs its own inline script.
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Serialise for embedding inside <script>: JSON with HTML-significant chars escaped. */
function jsString(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/**
 * The page returned to the popup window. It performs Decap's handshake:
 *   popup  → opener : "authorizing:github"
 *   opener → popup  : (any message)            — Decap replies to confirm
 *   popup  → opener : "authorization:github:success:{token}"  (or :error:)
 * The token is only ever posted to an origin in ALLOWED_ORIGINS.
 */
function handshakePage({ status, payload, origins }) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const title = status === 'success' ? 'Signed in — you can close this window' : 'Sign-in failed';
  const detail = status === 'success' ? '' : escapeHtml(payload.message || 'Unknown error');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#faf8f5;color:#24211e;display:grid;place-items:center;height:100vh;margin:0}main{text-align:center;max-width:28rem;padding:2rem}h1{font-family:Georgia,serif;font-size:1.4rem}p{color:#7d7165}</style>
</head><body><main><h1>Slow Dough Pizza Co.</h1><p id="msg">${status === 'success' ? 'Finishing sign-in…' : detail}</p></main>
<script>
(function () {
  var allowed = ${jsString(origins)};
  var message = ${jsString(message)};
  function receive(e) {
    if (allowed.indexOf(e.origin) === -1) return;           // ignore strangers
    window.removeEventListener('message', receive, false);
    e.source.postMessage(message, e.origin);                  // only to the allowed opener
    setTimeout(function () { window.close(); }, 150);
  }
  window.addEventListener('message', receive, false);
  if (window.opener) {
    allowed.forEach(function (origin) { window.opener.postMessage('authorizing:github', origin); });
  } else {
    document.getElementById('msg').textContent = 'This page must be opened from the content manager.';
  }
})();
</script></body></html>`;
}

/* ------------------------------------------------------------------------- */
/* routes                                                                     */
/* ------------------------------------------------------------------------- */

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const clientId = required(env, 'GITHUB_CLIENT_ID');
  const scopeRequested = url.searchParams.get('scope') || env.OAUTH_SCOPE || 'repo';
  const scope = ['repo', 'public_repo'].includes(scopeRequested) ? scopeRequested : 'repo';
  const state = randomState();

  const redirect = new URL(`${githubWeb(env)}/login/oauth/authorize`);
  redirect.searchParams.set('client_id', clientId);
  redirect.searchParams.set('redirect_uri', `${url.origin}/callback`);
  redirect.searchParams.set('scope', scope);
  redirect.searchParams.set('state', state);
  redirect.searchParams.set('allow_signup', 'false');

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirect.toString(),
      'Set-Cookie': cookie(STATE_COOKIE, state, STATE_TTL_SECONDS),
      ...SECURITY_HEADERS,
    },
  });
}

async function exchangeCode(env, code, redirectUri, fetchImpl) {
  const res = await fetchImpl(`${githubWeb(env)}/login/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'slow-dough-decap-oauth' },
    body: JSON.stringify({
      client_id: required(env, 'GITHUB_CLIENT_ID'),
      client_secret: required(env, 'GITHUB_CLIENT_SECRET'),
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || `GitHub token exchange failed (${res.status})`);
  }
  return data.access_token;
}

/** Returns { login, push } for the signed-in user against GITHUB_REPO. */
async function checkRepoAccess(env, token, fetchImpl) {
  const repo = required(env, 'GITHUB_REPO');
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'slow-dough-decap-oauth',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const [userRes, repoRes] = await Promise.all([
    fetchImpl(`${githubApi(env)}/user`, { headers }),
    fetchImpl(`${githubApi(env)}/repos/${repo}`, { headers }),
  ]);
  const user = userRes.ok ? await userRes.json() : {};
  if (!repoRes.ok) {
    // 404 is what GitHub returns for private repos the user cannot see.
    return { login: user.login, push: false };
  }
  const repoData = await repoRes.json();
  return { login: user.login, push: Boolean(repoData.permissions && repoData.permissions.push) };
}

async function handleCallback(request, env, fetchImpl) {
  const url = new URL(request.url);
  const origins = allowedOrigins(env);
  const clearState = { 'Set-Cookie': cookie(STATE_COOKIE, '', 0) };
  const fail = (message, status = 400) =>
    html(handshakePage({ status: 'error', payload: { message }, origins }), status, clearState);

  const ghError = url.searchParams.get('error');
  if (ghError) return fail(`GitHub sign-in was cancelled or failed (${ghError}).`, 400);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = parseCookies(request.headers.get('Cookie'));
  if (!code || !state || !timingSafeEqual(state, cookies[STATE_COOKIE] || '')) {
    return fail('Sign-in session expired or was tampered with. Please close this window and try again.', 400);
  }

  let token;
  try {
    token = await exchangeCode(env, code, `${url.origin}/callback`, fetchImpl);
  } catch (err) {
    return fail(err.message, 502);
  }

  if (String(env.REQUIRE_WRITE_ACCESS ?? 'true') !== 'false') {
    const access = await checkRepoAccess(env, token, fetchImpl);
    if (!access.push) {
      // The user authenticated with GitHub but is not a collaborator with
      // write permission on the site repository: do not hand over the token.
      return fail(
        `GitHub account "${access.login || 'unknown'}" is not a collaborator with write access on ${env.GITHUB_REPO}. ` +
          'Ask the site owner to invite you to the repository.',
        403,
      );
    }
  }

  return html(handshakePage({ status: 'success', payload: { token, provider: 'github' }, origins }), 200, clearState);
}

/* ------------------------------------------------------------------------- */
/* entry point                                                                */
/* ------------------------------------------------------------------------- */

/**
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch?: typeof fetch }} [deps]  test hook for the GitHub calls
 */
export async function handleRequest(request, env, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const url = new URL(request.url);

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: SECURITY_HEADERS });
  }

  try {
    switch (url.pathname.replace(/\/+$/, '') || '/') {
      case '/':
        return new Response('Slow Dough Decap CMS OAuth handler is running.', { status: 200, headers: { 'Content-Type': 'text/plain', ...SECURITY_HEADERS } });
      case '/healthz':
        return new Response('ok', { status: 200, headers: SECURITY_HEADERS });
      case '/auth':
        return await handleAuth(request, env);
      case '/callback':
        return await handleCallback(request, env, fetchImpl);
      default:
        return new Response('Not Found', { status: 404, headers: SECURITY_HEADERS });
    }
  } catch (err) {
    // Configuration errors (missing secrets) end up here. Never leak details.
    console.error('oauth handler error:', err);
    return new Response('Server misconfigured', { status: 500, headers: SECURITY_HEADERS });
  }
}
