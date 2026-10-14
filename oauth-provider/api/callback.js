const {
  exchangeCodeForToken,
  renderPostMessageResponse,
  isValidState,
  buildClearStateCookie,
} = require('../lib/github-oauth');

/**
 * Vercel serverless function: GET /api/callback
 * (mapped to /callback at the domain root via vercel.json rewrites)
 */
module.exports = async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    res.status(400).send(
      renderPostMessageResponse({ status: 'error', payload: { message: errorDescription || error } }),
    );
    return;
  }

  if (!isValidState(state, req.headers.cookie)) {
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
    res.setHeader('Set-Cookie', buildClearStateCookie());
    res.status(200).send(
      renderPostMessageResponse({ status: 'success', payload: { token, provider: 'github' } }),
    );
  } catch (err) {
    res.status(500).send(renderPostMessageResponse({ status: 'error', payload: { message: err.message } }));
  }
};
