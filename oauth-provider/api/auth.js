const { buildAuthorizeRedirectUrl, createState, buildStateCookie } = require('../lib/github-oauth');

/**
 * Vercel serverless function: GET /api/auth
 * (mapped to /auth at the domain root via vercel.json rewrites)
 */
module.exports = (req, res) => {
  try {
    const state = createState();
    // Stateless CSRF token: signed into a short-lived cookie instead of
    // server memory, since serverless instances are not guaranteed to be
    // the same process between /auth and /callback.
    res.setHeader('Set-Cookie', buildStateCookie(state));
    res.writeHead(302, { Location: buildAuthorizeRedirectUrl({ state }) });
    res.end();
  } catch (err) {
    res.status(500).send(`OAuth configuration error: ${err.message}`);
  }
};
