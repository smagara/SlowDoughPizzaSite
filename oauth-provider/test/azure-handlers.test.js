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
  process.env.OAUTH_GITHUB_CLIENT_ID = 'Ov23liTESTclientid123';
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
  assert.equal(location.searchParams.get('client_id'), 'Ov23liTESTclientid123');
  assert.equal(location.searchParams.get('scope'), 'repo,user');
  const state = location.searchParams.get('state');
  assert.match(state, /^[0-9a-f]{32}$/);
  assert.equal(res.cookies.length, 1);
  assert.deepEqual(res.cookies[0], {
    name: oauth.STATE_COOKIE_NAME, value: state, path: '/', maxAge: 300, httpOnly: true, secure: true, sameSite: 'Lax',
  });
  assert.equal(res.headers['Set-Cookie'], undefined, 'cookie must go through the v4 cookies property');
});

test('auth returns 500 with a pointed message when OAUTH_GITHUB_CLIENT_ID is an Entra GUID', async () => {
  process.env.OAUTH_GITHUB_CLIENT_ID = '4230312f-5a1b-4c2d-9e8f-0123456789ab';
  const res = await handlers.auth(makeRequest(), noopContext);
  assert.equal(res.status, 500);
  assert.match(res.body, /is a GUID, i\.e\. an Azure\/Entra application id/);
  assert.match(res.body, /AZURE_CLIENT_ID instead/);
});

test('auth accepts both GitHub client id formats', async () => {
  for (const id of ['Ov23liYabcdefghijklm', 'abcdef0123456789abcd']) {
    process.env.OAUTH_GITHUB_CLIENT_ID = id;
    const res = await handlers.auth(makeRequest(), noopContext);
    assert.equal(res.status, 302, `expected redirect for ${id}`);
  }
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
  assert.match(res.body, /CSRF state check/);
  assert.match(res.body, /does not match the cookie/);
});

test('callback explains a missing cookie vs a missing state parameter', async () => {
  const noCookie = await handlers.callback(makeRequest({ query: { code: 'abc', state: 'xyz' } }), noopContext);
  assert.equal(noCookie.status, 400);
  assert.match(noCookie.body, /did not send the 'sd_oauth_state' cookie/);
  const noState = await handlers.callback(makeRequest({ query: { code: 'abc' }, cookie: `${oauth.STATE_COOKIE_NAME}=xyz` }), noopContext);
  assert.equal(noState.status, 400);
  assert.match(noState.body, /did not include the 'state' parameter/);
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
    assert.deepEqual(res.cookies[0], { name: oauth.STATE_COOKIE_NAME, value: '', path: '/', maxAge: 0, httpOnly: true, secure: true, sameSite: 'Lax' });
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
