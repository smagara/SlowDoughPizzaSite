# Slow Dough — Decap CMS GitHub OAuth Provider

Decap CMS's `github` backend needs a tiny server-side helper to complete the
GitHub OAuth "web application flow," because the OAuth **client secret** can
never be shipped to the browser. This folder contains that helper and **only**
that helper — it holds no content, no database, and is deployed independently
of the main Vite site.

It exposes three routes:

| Route           | Purpose                                                                                      |
|-----------------|----------------------------------------------------------------------------------------------|
| `GET /healthz`  | Returns `ok` (used by the deploy workflow's smoke test / uptime checks).                     |
| `GET /auth`     | Redirects the admin's browser to GitHub's consent screen (sets a short-lived `state` cookie). |
| `GET /callback` | Exchanges GitHub's `code` for an access token and hands it back to the Decap CMS popup window via `postMessage`. |

## Production target: Azure Functions

The production deployment is an **Azure Function App** (Node.js 20, programming
model v4) and is deployed automatically by
[`.github/workflows/deploy-oauth-provider-azure.yml`](../.github/workflows/deploy-oauth-provider-azure.yml)
whenever anything under `oauth-provider/` changes on `main`.

| Setting                  | Where it lives                                   | Current value                                                     |
|--------------------------|--------------------------------------------------|-------------------------------------------------------------------|
| Function App name        | `site.config.json` → `oauthProvider.azure.functionAppName` | `SlowOAuthFn` (resource name; hostname is lowercase)     |
| Public URL               | `site.config.json` → `oauthProvider.url`          | `https://slowoauthfn-b3hzcgbnfch8bhbz.eastus2-01.azurewebsites.net` |
| GitHub OAuth credentials | Function App → *Settings → Environment variables* | `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET`            |

Step-by-step setup (GitHub OAuth App registration, Azure app settings, GitHub
Actions secrets) is in **[docs/INTEGRATION-GUIDE.md](../docs/INTEGRATION-GUIDE.md)**.

Layout:

```
oauth-provider/
├── lib/github-oauth.js        # framework-agnostic OAuth logic (shared by all variants)
├── azure/
│   ├── handlers.js            # Azure Functions v4 HTTP handlers (unit-tested)
│   └── functions/index.js     # app.http(...) registrations  <- package.json "main"
├── host.json                  # routePrefix "" so routes are /auth, /callback, /healthz
├── .funcignore                # files excluded from the deployment package
├── local.settings.json.example
├── test/azure-handlers.test.js
├── server.js                  # Express variant (VM / Docker / Render / Fly)
├── api/auth.js, api/callback.js, vercel.json   # Vercel variant
└── Dockerfile
```

### Run the tests

```bash
cd oauth-provider
npm ci
npm test
```

### Run the Function App locally (optional)

Requires [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local):

```bash
cd oauth-provider
cp local.settings.json.example local.settings.json   # fill in the client id/secret
npm ci
func start          # -> http://localhost:7071/auth, /callback, /healthz
```

## Environment variables (all hosts)

| Variable                     | Description                                        |
|------------------------------|----------------------------------------------------|
| `OAUTH_GITHUB_CLIENT_ID`     | From the GitHub OAuth App                          |
| `OAUTH_GITHUB_CLIENT_SECRET` | From the GitHub OAuth App (keep secret!)           |
| `OAUTH_GITHUB_SCOPE`         | Optional, defaults to `repo,user`                  |
| `PORT`                       | Optional (Express variant only), defaults to `8080`|

Never commit these values. On Azure they are Function App application settings;
elsewhere use the host's secret manager or a git-ignored `.env` file.

## Alternative hosts

The same `lib/` is wired to two other hosts in case the service ever moves:

- **Express** (`server.js`, `Dockerfile`): `npm install && npm start`, or
  `docker build -t slow-dough-oauth . && docker run -p 8080:8080 -e OAUTH_GITHUB_CLIENT_ID=… -e OAUTH_GITHUB_CLIENT_SECRET=… slow-dough-oauth`
- **Vercel** (`api/`, `vercel.json`): `vercel deploy` from this folder and add the two env vars in the project settings.

Whichever host is used, point Decap at it by editing `oauthProvider.url` in
`/site.config.json` (it becomes `backend.base_url` in the generated
`/admin/config.yml`) and set the GitHub OAuth App's callback URL to
`<that host>/callback`.

## Security notes

- The service never stores the GitHub access token; it only relays it from
  GitHub to the browser over the OAuth popup's `postMessage` channel, matching
  Decap's documented protocol.
- A random, single-use, 5-minute `state` value (stored in an `HttpOnly; Secure;
  SameSite=Lax` cookie on the serverless variants, in memory on Express) is
  verified on `/callback` to mitigate CSRF. On Azure the cookie is returned via
  the Functions v4 `cookies` response property (a raw `Set-Cookie` header is not
  reliably forwarded by the host). A failed check returns 400 with a message
  that says whether the `state` parameter or the cookie was missing.
- The *real* authorization boundary is GitHub itself: a signed-in user can only
  open branches/PRs against the content repository if GitHub already considers
  them a collaborator with write access. This service keeps no user list.
