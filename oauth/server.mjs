#!/usr/bin/env node
/**
 * Plain Node.js server for the OAuth handler (alternative to the Cloudflare
 * Worker). Zero dependencies; requires Node 18+.
 *
 *   GITHUB_CLIENT_ID=… GITHUB_CLIENT_SECRET=… GITHUB_REPO=owner/name \
 *   ALLOWED_ORIGINS=https://owner.github.io node oauth/server.mjs
 *
 * Put it behind HTTPS (a reverse proxy such as Caddy/nginx or a PaaS like
 * Render/Fly/Railway) — the state cookie is marked Secure.
 */
import http from 'node:http';
import { handleRequest } from './handler.mjs';

const port = Number(process.env.PORT || 8788);
const publicUrl = (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, publicUrl);
    const request = new Request(url, { method: req.method, headers: req.headers });
    const response = await handleRequest(request, process.env);
    const headers = {};
    response.headers.forEach((v, k) => {
      headers[k] = k.toLowerCase() === 'set-cookie' ? response.headers.getSetCookie?.() ?? v : v;
    });
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(err);
    res.writeHead(500).end('Internal error');
  }
});

server.listen(port, () => {
  console.log(`Decap OAuth handler listening on ${publicUrl} (port ${port})`);
});
