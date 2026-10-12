import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../oauth/handler.mjs';

const env = {
  GITHUB_CLIENT_ID: 'cid',
  GITHUB_CLIENT_SECRET: 'shh',
  GITHUB_REPO: 'slow-dough-pizza/SlowDough',
  ALLOWED_ORIGINS: 'https://slow-dough-pizza.github.io, http://localhost:3000',
};

/** Fake GitHub: token exchange + user + repo permission lookup. */
function fakeGitHub({ push = true, tokenOk = true, repoVisible = true } = {}) {
  const calls = [];
  return {
    calls,
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      if (url === 'https://github.com/login/oauth/access_token') {
        const body = JSON.parse(init.body);
        assert.equal(body.client_secret, 'shh');
        return new Response(JSON.stringify(tokenOk ? { access_token: 'gho_test123', token_type: 'bearer' } : { error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' }), { status: 200 });
      }
      if (url === 'https://api.github.com/user') return new Response(JSON.stringify({ login: 'marco' }), { status: 200 });
      if (url === 'https://api.github.com/repos/slow-dough-pizza/SlowDough') {
        assert.equal(init.headers.Authorization, 'Bearer gho_test123');
        return repoVisible ? new Response(JSON.stringify({ permissions: { push, pull: true } }), { status: 200 }) : new Response('{}', { status: 404 });
      }
      throw new Error('unexpected fetch ' + url);
    },
  };
}

function stateCookie(res) {
  const m = /decap_oauth_state=([^;]+)/.exec(res.headers.get('set-cookie'));
  return m && m[1];
}

test('/auth redirects to GitHub with a state cookie and restricted scope', async () => {
  const res = await handleRequest(new Request('https://auth.example.com/auth?provider=github&scope=public_repo&site_id=x'), env);
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(loc.searchParams.get('client_id'), 'cid');
  assert.equal(loc.searchParams.get('scope'), 'public_repo');
  assert.equal(loc.searchParams.get('redirect_uri'), 'https://auth.example.com/callback');
  const state = stateCookie(res);
  assert.match(state, /^[0-9a-f]{48}$/);
  assert.equal(loc.searchParams.get('state'), state);
  assert.match(res.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
});

test('/auth ignores unknown scopes', async () => {
  const res = await handleRequest(new Request('https://auth.example.com/auth?scope=admin:org'), env);
  assert.equal(new URL(res.headers.get('location')).searchParams.get('scope'), 'repo');
});

test('/callback with valid state hands the token to allowed origins only', async () => {
  const gh = fakeGitHub();
  const res = await handleRequest(
    new Request('https://auth.example.com/callback?code=abc&state=s1', { headers: { Cookie: 'decap_oauth_state=s1' } }),
    env, gh,
  );
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /authorization:github:success:\{\\"token\\":\\"gho_test123\\"/);
  assert.match(body, /"https:\/\/slow-dough-pizza.github.io","http:\/\/localhost:3000"/);
  assert.doesNotMatch(body, /shh/);
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(gh.calls.length, 3);
});

test('/callback rejects a mismatched or missing state', async () => {
  const gh = fakeGitHub();
  for (const headers of [{ Cookie: 'decap_oauth_state=other' }, {}]) {
    const res = await handleRequest(new Request('https://auth.example.com/callback?code=abc&state=s1', { headers }), env, gh);
    assert.equal(res.status, 400);
    assert.match(await res.text(), /authorization:github:error/);
  }
  assert.equal(gh.calls.length, 0, 'GitHub must not be contacted');
});

test('/callback refuses users without write access (not a collaborator)', async () => {
  for (const opts of [{ push: false }, { repoVisible: false }]) {
    const res = await handleRequest(
      new Request('https://auth.example.com/callback?code=abc&state=s1', { headers: { Cookie: 'decap_oauth_state=s1' } }),
      env, fakeGitHub(opts),
    );
    assert.equal(res.status, 403);
    const body = await res.text();
    assert.match(body, /not a collaborator with write access/);
    assert.doesNotMatch(body, /gho_test123/, 'token must not leak');
  }
});

test('/callback surfaces GitHub token errors without leaking secrets', async () => {
  const res = await handleRequest(
    new Request('https://auth.example.com/callback?code=bad&state=s1', { headers: { Cookie: 'decap_oauth_state=s1' } }),
    env, fakeGitHub({ tokenOk: false }),
  );
  assert.equal(res.status, 502);
  const body = await res.text();
  assert.match(body, /incorrect or expired/);
  assert.doesNotMatch(body, /shh/);
});

test('/callback error param (user cancelled) returns an error handshake', async () => {
  const res = await handleRequest(new Request('https://auth.example.com/callback?error=access_denied'), env, fakeGitHub());
  assert.equal(res.status, 400);
  assert.match(await res.text(), /cancelled/);
});

test('misconfiguration is a 500 without detail; unknown routes 404; POST 405', async () => {
  const res = await handleRequest(new Request('https://auth.example.com/auth'), {});
  assert.equal(res.status, 500);
  assert.equal((await handleRequest(new Request('https://auth.example.com/nope'), env)).status, 404);
  assert.equal((await handleRequest(new Request('https://auth.example.com/auth', { method: 'POST' }), env)).status, 405);
  assert.equal((await handleRequest(new Request('https://auth.example.com/healthz'), env)).status, 200);
});
