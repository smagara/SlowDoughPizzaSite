/**
 * Unit tests for the Azure Functions handlers and the shared OAuth helpers.
 * Run with: npm test   (Node >= 20, uses the built-in node:test runner)
 * No Azure Functions host or network access is required: GitHub's token
 * endpoint is stubbed by replacing global fetch.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const handlers = require('../azure/handlers');
const oauth = require('../lib/github-oauth');

function makeRequest({ query = {}, cookie = '' } = {}) {
  return {
    query: new URLSearchParams(query),
    headers: new Headers(cookie ? { cookie } : {}),
  };
}

const noopContext = { error() {}, log() {} };

test.beforeEach(() => {
  process.env.OAUTH_GITHUB_CLIENT_ID = 'test-client-id';
  process.env.OAUTH_GITHUB_CLIENT_SECRET = 'test-client-secret';
});

test('healthz returns ok', async () => {
  const res = await handlers.healthz();
  assert.equal(res.status, 200);
  assert.equal(res.body, 'ok');
});

test('auth redirects to GitHub with client_id, scope and a state cookie', async () => {
  const res = await handlers.auth(makeRequest(), noopContext);
  assert.equal(res.status, 302);
  const location = new URL(res.headers.Location);
  assert.equal(location.origin + location.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(location.searchParams.get('client_id'), 'test-client-id');
  assert.equal(location.searchParams.get('scope'), 'repo,user');
  const state = location.searchParams.get('state');
  assert.match(state, /^[0-9a-f]{32}$/);
  assert.match(res.headers['Set-Cookie'], new RegExp(`^${oauth.STATE_COOKIE_NAME}=${state}; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax$`));
});

test('auth returns 500 when the OAuth app is not configured', async () => {
  delete process.env.OAUTH_GITHUB_CLIENT_ID;
  const res = await handlers.auth(makeRequest(), noopContext);
  assert.equal(res.status, 500);
  assert.match(res.body, /OAUTH_GITHUB_CLIENT_ID/);
});

test('callback rejects a missing or mismatched state', async () => {
  const res = await handlers.callback(
    makeRequest({ query: { code: 'abc', state: 'wrong' }, cookie: `${oauth.STATE_COOKIE_NAME}=right` }),
    noopContext,
  );
  assert.equal(res.status, 400);
  assert.match(res.body, /authorization:github:error/);
  assert.match(res.body, /Invalid or expired OAuth state/);
});

test('callback surfaces GitHub-side errors (e.g. user cancelled)', async () => {
  const res = await handlers.callback(
    makeRequest({ query: { error: 'access_denied', error_description: 'The user has denied your application access.' } }),
    noopContext,
  );
  assert.equal(res.status, 400);
  assert.match(res.body, /authorization:github:error/);
  assert.match(res.body, /denied your application access/);
});

test('callback exchanges the code and posts the token back to the opener', async () => {
  const originalFetch = global.fetch;
  let capturedBody;
  global.fetch = async (url, init) => {
    assert.equal(url, 'https://github.com/login/oauth/access_token');
    capturedBody = JSON.parse(init.body);
    return { ok: true, json: async () => ({ access_token: 'gho_test_token' }) };
  };
  try {
    const res = await handlers.callback(
      makeRequest({ query: { code: 'the-code', state: 'xyz' }, cookie: `${oauth.STATE_COOKIE_NAME}=xyz` }),
      noopContext,
    );
    assert.equal(res.status, 200);
    assert.equal(capturedBody.code, 'the-code');
    assert.equal(capturedBody.client_secret, 'test-client-secret');
    assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
    // Exact message protocol Decap's GitHub backend listens for:
    assert.match(res.body, /"authorization:github:success:\{\\"token\\":\\"gho_test_token\\",\\"provider\\":\\"github\\"\}"/);
    assert.match(res.body, /window\.opener\.postMessage\('authorizing:github', '\*'\)/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('parseCookies handles multiple cookies and encoded values', () => {
  const cookies = oauth.parseCookies('a=1; sd_oauth_state=abc%20def; flag');
  assert.deepEqual(cookies, { a: '1', sd_oauth_state: 'abc def', flag: '' });
});
