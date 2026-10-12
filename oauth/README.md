# GitHub OAuth handler for `/admin`

Decap CMS talks to GitHub directly from the browser, but the OAuth *client
secret* must stay server-side. This folder contains that server-side piece —
about 250 lines, no dependencies — plus two ways to run it.

```
/admin (browser) ──popup──▶ /auth ──302──▶ github.com/login/oauth/authorize
                                                     │ user approves
/admin ◀──postMessage(token)── /callback ◀──302──────┘
                                 │
                                 ├─ verifies anti-CSRF `state` cookie
                                 ├─ exchanges code → token (server side, uses the secret)
                                 └─ GET /repos/<GITHUB_REPO> with the token:
                                    permissions.push must be true, otherwise
                                    the token is discarded and the user sees
                                    "not a collaborator with write access"
```

## Settings

| Variable | Required | Meaning |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | yes | From the GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | yes (secret) | From the GitHub OAuth App |
| `GITHUB_REPO` | yes | `owner/name` — editors must have **Write** access here |
| `ALLOWED_ORIGINS` | yes | Comma-separated origins of the site, e.g. `https://owner.github.io`. The token is only ever posted to these origins |
| `OAUTH_SCOPE` | no | `repo` (default; needed for private repos) or `public_repo` |
| `REQUIRE_WRITE_ACCESS` | no | `true` (default). Set `false` to rely solely on Decap's own check |
| `GITHUB_WEB_BASE` / `GITHUB_API_BASE` | no | Only for GitHub Enterprise Server |

The GitHub OAuth App's **Authorization callback URL** must be
`https://<this-host>/callback`, and `backend.base_url` in
`public/admin/config.yml` must be `https://<this-host>` (origin only — Decap
compares it with `event.origin` of the popup message).

## Option A — Cloudflare Worker (free tier, recommended)

```bash
cd oauth
npx wrangler login
# edit wrangler.toml: GITHUB_REPO and ALLOWED_ORIGINS
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler deploy
```

The worker URL (`https://slowdough-cms-auth.<account>.workers.dev`) is the
`base_url` for the CMS config and the host for the OAuth App callback URL.

## Option B — Node server (any host with HTTPS in front)

```bash
GITHUB_CLIENT_ID=… GITHUB_CLIENT_SECRET=… \
GITHUB_REPO=owner/SlowDough ALLOWED_ORIGINS=https://owner.github.io \
PUBLIC_URL=https://auth.example.com PORT=8788 node oauth/server.mjs
```

Requires Node 18+. Terminate TLS in front of it (Caddy, nginx, Render, Fly,
Railway…) — the state cookie is marked `Secure`.

## Tests

`npm test` runs `tests/oauth-handler.test.mjs`, which drives the handler with
a fake GitHub: state/CSRF checks, scope clamping, token exchange errors,
collaborator refusal, and that the secret never appears in any response.
