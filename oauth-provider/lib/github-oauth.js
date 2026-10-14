/**
 * Minimal GitHub OAuth "web application flow" handshake for Decap CMS.
 * -----------------------------------------------------------------------
 * Decap CMS's `github` backend needs *some* server to perform the GitHub
 * OAuth exchange, because GitHub's OAuth client secret can never be
 * exposed to the browser. This module implements exactly the two steps
 * Decap expects, and nothing else:
 *
 *   1. GET /auth        -> redirect the browser to GitHub's consent screen
 *   2. GET /callback    -> exchange the returned `code` for an access
 *                          token, then hand that token back to the
 *                          Decap CMS popup window via `postMessage`,
 *                          using the exact message protocol Decap's
 *                          GitHub backend listens for.
 *
 * No session, database, or user storage is needed — the token is never
 * persisted by this service; it only ever passes through this server on
 * its way from GitHub to the browser. Decap CMS itself caches the token
 * in the browser's localStorage for the logged-in session, and the
 * repo's real authorization boundary is enforced by GitHub itself: a
 * user can only push to a feature branch / open a PR if GitHub
 * considers them a collaborator with write access to the repository.
 *
 * This file is framework-agnostic (plain functions) so it can be wired
 * up to any host:
 *   - Azure Functions (the production deployment target; see ../azure/)
 *   - a tiny Express app (../server.js, good for a VM/Docker/Render/Fly)
 *   - Vercel-style serverless functions (../api/auth.js, ../api/callback.js)
 */

const crypto = require('crypto');

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Step 1: build the URL to redirect the user's browser to so they can
 * approve (or already have approved) the Slow Dough Admin OAuth App.
 * We pass a random `state` value and expect the caller to have already
 * stored it (e.g. in a signed cookie) so `handleCallback` can verify it
 * and mitigate CSRF.
 */
function buildAuthorizeRedirectUrl({ state }) {
  const clientId = requiredEnv('OAUTH_GITHUB_CLIENT_ID');
  // `repo` scope is the minimum GitHub scope that allows Decap to read
  // collaborator status, create branches, and open Pull Requests.
  const scope = process.env.OAUTH_GITHUB_SCOPE || 'repo,user';
  const params = new URLSearchParams({ client_id: clientId, scope, state });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Step 2: exchange the `code` GitHub redirected back with for a real
 * access token.
 */
async function exchangeCodeForToken(code) {
  const clientId = requiredEnv('OAUTH_GITHUB_CLIENT_ID');
  const clientSecret = requiredEnv('OAUTH_GITHUB_CLIENT_SECRET');

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed with status ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`GitHub token exchange error: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

/**
 * Renders the tiny HTML page that ships the token back to the Decap CMS
 * admin tab via `window.postMessage`, following Decap's documented
 * handshake: the opener sends "authorizing:github" once it is ready to
 * receive the message, and we keep re-sending our result until it is
 * acknowledged (Decap's own example provider does the same).
 */
function renderPostMessageResponse({ status, provider = 'github', payload }) {
  const message =
    status === 'success'
      ? `authorization:${provider}:success:${JSON.stringify(payload)}`
      : `authorization:${provider}:error:${JSON.stringify(payload)}`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Slow Dough Admin — Authorizing…</title></head>
<body>
  <p>Finishing sign-in, you can close this window if it does not close automatically…</p>
  <script>
    (function () {
      function receiveMessage(e) {
        window.opener.postMessage(
          ${JSON.stringify(message)},
          e.origin
        );
        window.removeEventListener('message', receiveMessage, false);
      }
      window.addEventListener('message', receiveMessage, false);
      // Decap's popup announces itself once mounted; kick things off in
      // case it already has and we attached the listener too late.
      window.opener.postMessage('authorizing:${provider}', '*');
    })();
  </script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Stateless CSRF `state` helpers shared by the serverless variants (Vercel,
// Azure Functions). The Express variant keeps state in memory instead.
// ---------------------------------------------------------------------------
const STATE_COOKIE_NAME = 'sd_oauth_state';
const STATE_COOKIE_MAX_AGE_SECONDS = 300;

function createState() {
  return crypto.randomBytes(16).toString('hex');
}

/** Serialized Set-Cookie header value that stores the pending state. */
function buildStateCookie(state) {
  return `${STATE_COOKIE_NAME}=${state}; Max-Age=${STATE_COOKIE_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

/** Set-Cookie header value that clears the state cookie. */
function buildClearStateCookie() {
  return `${STATE_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function parseCookies(header = '') {
  return Object.fromEntries(
    String(header || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return [part, ''];
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      }),
  );
}

/** True when the `state` echoed back by GitHub matches the one we stored in the cookie. */
function isValidState(state, cookieHeader) {
  if (!state) return false;
  return parseCookies(cookieHeader)[STATE_COOKIE_NAME] === state;
}

module.exports = {
  STATE_COOKIE_NAME,
  STATE_COOKIE_MAX_AGE_SECONDS,
  buildAuthorizeRedirectUrl,
  exchangeCodeForToken,
  renderPostMessageResponse,
  createState,
  buildStateCookie,
  buildClearStateCookie,
  parseCookies,
  isValidState,
};
