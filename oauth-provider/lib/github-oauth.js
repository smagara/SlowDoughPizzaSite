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
// GitHub OAuth App client ids are either 20 hex chars (older apps) or
// "Ov23li..." (newer apps). An Azure/Entra *application (client) id* is a
// GUID - a very common mix-up because both are called "client ID". Sending a
// GUID to github.com/login/oauth/authorize just yields GitHub's 404 page, so
// fail fast with a message that says which id belongs where.
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Known GitHub client-id shapes (used only for a soft sanity check; GitHub may
// add formats, so anything that is not a GUID is allowed through).
const GITHUB_CLIENT_ID_PATTERN = /^(Ov23li[A-Za-z0-9]{8,}|Iv1\.[0-9a-f]{16}|Iv23li[A-Za-z0-9]{8,}|[0-9a-f]{20})$/;

function assertLooksLikeGitHubClientId(clientId) {
  if (GUID_PATTERN.test(clientId)) {
    throw new Error(
      'OAUTH_GITHUB_CLIENT_ID is a GUID, i.e. an Azure/Entra application id. It must be the ' +
        "GitHub OAuth App's Client ID (github.com -> Settings -> Developer settings -> OAuth Apps), " +
        "which looks like 'Ov23li...' or a 20-character hex string. The Entra id belongs in the " +
        'GitHub repository secret AZURE_CLIENT_ID instead.',
    );
  }
}

function buildAuthorizeRedirectUrl({ state }) {
  const clientId = requiredEnv('OAUTH_GITHUB_CLIENT_ID').trim();
  assertLooksLikeGitHubClientId(clientId);
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
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderPostMessageResponse({ status, provider = 'github', payload }) {
  const message =
    status === 'success'
      ? `authorization:${provider}:success:${JSON.stringify(payload)}`
      : `authorization:${provider}:error:${JSON.stringify(payload)}`;

  const visibleText =
    status === 'success'
      ? 'Finishing sign-in, you can close this window if it does not close automatically…'
      : `Sign-in failed: ${escapeHtml(String((payload && payload.message) || 'unknown error'))}`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Slow Dough Admin — ${status === 'success' ? 'Authorizing…' : 'Sign-in failed'}</title>
<style>body{font-family:system-ui,sans-serif;background:#faf8f5;color:#24211e;padding:32px;max-width:640px}p{line-height:1.5}</style></head>
<body>
  <p>${visibleText}</p>
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

/**
 * Human-readable reason for a failed state check, so a user staring at the
 * popup (or an operator reading logs) can tell WHICH half of the CSRF
 * handshake broke instead of seeing a generic 400.
 */
function explainStateFailure(state, cookieHeader) {
  const cookieValue = parseCookies(cookieHeader)[STATE_COOKIE_NAME];
  if (!state && !cookieValue) {
    return (
      "GitHub's redirect did not include a 'state' parameter and the browser did not send the " +
      `'${STATE_COOKIE_NAME}' cookie. The sign-in was not started from this service's /auth endpoint ` +
      '(open the admin page and click "Login with GitHub" again).'
    );
  }
  if (!state) {
    return "GitHub's redirect did not include the 'state' parameter that /auth sent. Start the sign-in again from the admin page.";
  }
  if (!cookieValue) {
    return (
      `The browser did not send the '${STATE_COOKIE_NAME}' cookie that /auth set ${STATE_COOKIE_MAX_AGE_SECONDS / 60} minutes ` +
      'or less ago. Usual causes: more than 5 minutes passed on the GitHub approval page, the cookie was blocked ' +
      '(browser privacy settings / an extension), or the /auth response did not carry a Set-Cookie header. Try again; ' +
      'if it persists, allow cookies for ' + 'this site and retry.'
    );
  }
  return 'The state parameter does not match the cookie (a stale or duplicated sign-in window). Close this window and sign in again.';
}

module.exports = {
  GITHUB_CLIENT_ID_PATTERN,
  assertLooksLikeGitHubClientId,
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
  explainStateFailure,
};
