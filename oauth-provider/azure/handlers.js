/**
 * Azure Functions (Node.js programming model v4) HTTP handlers.
 * -----------------------------------------------------------------------
 * These are plain async functions that take the v4 `HttpRequest` and
 * return an `HttpResponseInit`. They are kept separate from the
 * `app.http(...)` registrations in ./functions/index.js so they can be
 * unit-tested without the Functions host (see ../test/azure-handlers.test.js).
 *
 * Public routes (host.json sets routePrefix to "" so there is no /api/):
 *   GET /healthz   -> "ok"  (used by the deploy workflow's smoke test)
 *   GET /auth      -> 302 to GitHub's consent screen (+ state cookie)
 *   GET /callback  -> exchanges ?code for a token, posts it to the opener
 */
const {
  buildAuthorizeRedirectUrl,
  exchangeCodeForToken,
  renderPostMessageResponse,
  createState,
  isValidState,
  explainStateFailure,
  STATE_COOKIE_NAME,
  STATE_COOKIE_MAX_AGE_SECONDS,
} = require('../lib/github-oauth');

// Cookies are returned through the v4 model's dedicated `cookies` property
// rather than a raw Set-Cookie header: the Functions host serialises that
// property itself, whereas a Set-Cookie entry in `headers` is not guaranteed
// to survive the worker -> host hop.
const stateCookie = (value, maxAge) => ({
  name: STATE_COOKIE_NAME,
  value,
  path: '/',
  maxAge,
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
});

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };

async function healthz() {
  return { status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'ok' };
}

async function auth(request, context) {
  try {
    const state = createState();
    return {
      status: 302,
      headers: {
        Location: buildAuthorizeRedirectUrl({ state }),
        'Cache-Control': 'no-store',
      },
      cookies: [stateCookie(state, STATE_COOKIE_MAX_AGE_SECONDS)],
    };
  } catch (err) {
    context?.error?.(`OAuth configuration error: ${err.message}`);
    return {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: `OAuth configuration error: ${err.message}`,
    };
  }
}

async function callback(request, context) {
  const code = request.query.get('code');
  const state = request.query.get('state');
  const error = request.query.get('error');
  const errorDescription = request.query.get('error_description');

  if (error) {
    return {
      status: 400,
      headers: HTML_HEADERS,
      body: renderPostMessageResponse({ status: 'error', payload: { message: errorDescription || error } }),
    };
  }

  if (!isValidState(state, request.headers.get('cookie'))) {
    const reason = explainStateFailure(state, request.headers.get('cookie'));
    context?.warn?.(`OAuth state check failed: ${reason}`);
    return {
      status: 400,
      headers: HTML_HEADERS,
      body: renderPostMessageResponse({
        status: 'error',
        payload: { message: `Sign-in could not be completed (CSRF state check). ${reason}` },
      }),
    };
  }

  try {
    const token = await exchangeCodeForToken(code);
    return {
      status: 200,
      headers: HTML_HEADERS,
      cookies: [stateCookie('', 0)],
      body: renderPostMessageResponse({ status: 'success', payload: { token, provider: 'github' } }),
    };
  } catch (err) {
    context?.error?.(`GitHub token exchange failed: ${err.message}`);
    return {
      status: 500,
      headers: HTML_HEADERS,
      body: renderPostMessageResponse({ status: 'error', payload: { message: err.message } }),
    };
  }
}

module.exports = { healthz, auth, callback };
