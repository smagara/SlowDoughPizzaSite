/**
 * Standalone Express server exposing the GitHub OAuth handshake needed
 * by Decap CMS's `github` backend in production.
 *
 * Run with:
 *   OAUTH_GITHUB_CLIENT_ID=xxx OAUTH_GITHUB_CLIENT_SECRET=yyy node server.js
 *
 * Deploy anywhere that can run a small Node process (Render, Fly.io,
 * a VM, Docker, etc. — see README.md in this folder for step-by-step
 * instructions). If you'd rather not run a standalone server, see
 * /oauth-provider/api for a drop-in Vercel serverless version.
 */
const express = require('express');
const crypto = require('crypto');
const {
  buildAuthorizeRedirectUrl,
  exchangeCodeForToken,
  renderPostMessageResponse,
} = require('./lib/github-oauth');

const app = express();
const PORT = process.env.PORT || 8080;

// Minimal in-memory state store for CSRF protection on the OAuth
// handshake. States expire quickly and this service has no other
// persistent data, so an in-memory Map is sufficient even across
// multiple instances being occasionally out of sync (worst case: a
// legitimate login has to be retried).
const pendingStates = new Map();
const STATE_TTL_MS = 5 * 60 * 1000;

function createState() {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now() + STATE_TTL_MS);
  return state;
}

function consumeState(state) {
  const expiry = pendingStates.get(state);
  pendingStates.delete(state);
  return Boolean(expiry) && expiry > Date.now();
}

app.get('/healthz', (_req, res) => res.status(200).send('ok'));

app.get('/auth', (req, res) => {
  try {
    const state = createState();
    res.redirect(buildAuthorizeRedirectUrl({ state }));
  } catch (err) {
    res.status(500).send(`OAuth configuration error: ${err.message}`);
  }
});

app.get('/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    res.status(400).send(
      renderPostMessageResponse({ status: 'error', payload: { message: errorDescription || error } }),
    );
    return;
  }

  if (!state || !consumeState(state)) {
    res.status(400).send(
      renderPostMessageResponse({
        status: 'error',
        payload: { message: 'Invalid or expired OAuth state. Please try logging in again.' },
      }),
    );
    return;
  }

  try {
    const token = await exchangeCodeForToken(code);
    res.status(200).send(
      renderPostMessageResponse({ status: 'success', payload: { token, provider: 'github' } }),
    );
  } catch (err) {
    res.status(500).send(renderPostMessageResponse({ status: 'error', payload: { message: err.message } }));
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Slow Dough Decap OAuth provider listening on port ${PORT}`);
});
