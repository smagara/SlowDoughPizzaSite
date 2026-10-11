/**
 * Cloudflare Worker entry point. Deploy with:
 *   cd oauth && npx wrangler deploy
 * then set secrets:
 *   npx wrangler secret put GITHUB_CLIENT_ID
 *   npx wrangler secret put GITHUB_CLIENT_SECRET
 * (GITHUB_REPO / ALLOWED_ORIGINS live in wrangler.toml [vars])
 */
import { handleRequest } from './handler.mjs';

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
