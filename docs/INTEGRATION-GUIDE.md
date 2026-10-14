# Slow Dough — Integration & Deployment Guide

This guide walks through wiring the three moving parts together for the demo
environment:

| Part                                  | Where                                                                  |
|---------------------------------------|------------------------------------------------------------------------|
| Website + `/admin` (Decap CMS)        | GitHub Pages — `https://smagara.github.io/SlowDoughPizzaSite`          |
| Source repository                     | GitHub — `smagara/SlowDoughPizzaSite` (branch `main`)                  |
| OAuth proxy (GitHub login for /admin) | Azure Functions — `https://slowoauthfn-b3hzcgbnfch8bhbz.eastus2-01.azurewebsites.net` |

**Every one of those values lives in exactly one file: [`/site.config.json`](../site.config.json).**
Change them there and nothing else needs to be edited (see
[Changing the environment later](#6-changing-the-environment-later)).

```
                       ┌──────────────────────────────┐
   owner's browser ──► │ smagara.github.io/…/admin/   │ ── "Login with GitHub" ──┐
                       │ (Decap CMS, static)          │                           ▼
                       └──────────────────────────────┘      ┌──────────────────────────────────────┐
                                   ▲                         │ slowoauthfn-….azurewebsites.net       │
                 token via         │                         │   /auth     → redirect to GitHub      │
                 window.postMessage└──────────────────────── │   /callback ← code, exchange → token  │
                                                             └──────────────────────────────────────┘
```

---

## 0. Prerequisites

- The repository `smagara/SlowDoughPizzaSite` exists on GitHub and this
  project is at its **root** (i.e. `package.json`, `site.config.json`,
  `.github/` are top-level). The default branch is `main`.
- An Azure subscription with the Function App **`slowoauthfn`** already
  created (Node.js 20 runtime, any plan — Consumption, Flex Consumption or
  Premium all work). Its default hostname must match `oauthProvider.url` in
  `site.config.json`.
- You are an **owner/admin** of the GitHub repo (to add secrets, enable Pages)
  and have **Contributor** rights on the Function App.

> If the local checkout is still on `master`, rename it first:
> `git branch -M main`, then push: `git push -u origin main`.

---

## 1. Confirm `site.config.json`

```json
{
  "github":        { "repo": "smagara/SlowDoughPizzaSite", "branch": "main" },
  "site":          { "url": "https://smagara.github.io/SlowDoughPizzaSite", "basePath": "/SlowDoughPizzaSite/" },
  "oauthProvider": { "url": "https://slowoauthfn-b3hzcgbnfch8bhbz.eastus2-01.azurewebsites.net",
                     "azure": { "functionAppName": "slowoauthfn", "region": "eastus2" } }
}
```

Run `npm run validate:config` locally — it checks the values are consistent
(e.g. that `basePath` matches the path in `site.url`, that the URL looks like
the Pages URL for the repo). The same check runs in CI.

These values flow to:

- `vite.config.ts` → the site's **base path** (`/SlowDoughPizzaSite/`) and the
  generated **`/admin/config.yml`** (Decap's `backend.repo`, `backend.branch`,
  `backend.base_url`, `site_url`, `logo_url`, `public_folder`).
- `.github/workflows/deploy-oauth-provider-azure.yml` → the Azure Function App
  name and the smoke-test URL (read with `jq` at run time).

---

## 2. Register the GitHub OAuth App (one time)

Decap signs users in with GitHub, so GitHub must know about the app.

1. Go to **github.com → Settings → Developer settings → OAuth Apps → New OAuth App**
   (use the `smagara` account, or the org that owns the repo).
2. Fill in **exactly**:

   | Field                          | Value                                                                          |
   |--------------------------------|--------------------------------------------------------------------------------|
   | Application name               | `Slow Dough Content Admin`                                                     |
   | Homepage URL                   | `https://smagara.github.io/SlowDoughPizzaSite`                                 |
   | Authorization callback URL     | `https://slowoauthfn-b3hzcgbnfch8bhbz.eastus2-01.azurewebsites.net/callback`   |
   | Enable Device Flow             | leave unchecked                                                                |

3. Click **Register application**, then **Generate a new client secret**.
4. Copy the **Client ID** and the **Client secret** — you will paste them into
   Azure in the next step. (The secret is shown only once.)

> The callback URL must be the OAuth provider host + `/callback` — *not* the
> GitHub Pages site. If `oauthProvider.url` ever changes, update this field too.

---

## 3. Configure the Azure Function App (one time)

### 3a. Application settings (the GitHub credentials)

In the Azure portal open **Function App `slowoauthfn` → Settings →
Environment variables → App settings** and add:

| Name                           | Value                                  |
|--------------------------------|----------------------------------------|
| `OAUTH_GITHUB_CLIENT_ID`       | *Client ID from step 2*                |
| `OAUTH_GITHUB_CLIENT_SECRET`   | *Client secret from step 2*            |
| `OAUTH_GITHUB_SCOPE`           | `repo,user` *(optional — this is the default)* |

Make sure these exist as well (they are created automatically when the app is
created with the Node stack; verify they are present):

| Name                        | Value    |
|-----------------------------|----------|
| `FUNCTIONS_WORKER_RUNTIME`  | `node`   |
| `FUNCTIONS_EXTENSION_VERSION` | `~4`   |

Click **Apply** / **Save** (the app restarts).

Equivalent CLI (replace `<rg>` with the app's resource group):

```bash
az functionapp config appsettings set \
  --name slowoauthfn --resource-group <rg> \
  --settings OAUTH_GITHUB_CLIENT_ID=<client-id> OAUTH_GITHUB_CLIENT_SECRET=<client-secret>
```

### 3b. Give GitHub Actions permission to deploy — pick ONE method

**Method A — Publish profile (fastest to set up)**

1. In the portal, on the Function App **Overview** page click **Get publish
   profile** (top toolbar). A `slowoauthfn.PublishSettings` file downloads.
   - If the button is greyed out / the download fails, enable
     **Settings → Configuration → General settings → SCM Basic Auth
     Publishing Credentials = On**, save, and retry.
2. In GitHub: **repo → Settings → Secrets and variables → Actions → New
   repository secret**
   - Name: `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`
   - Value: paste the *entire contents* of the `.PublishSettings` file.

**Method B — OpenID Connect (no stored secret; recommended long-term)**

1. Create an Entra ID app registration (or use an existing one):
   `az ad app create --display-name slowdough-github-deploy`
   and a service principal for it: `az ad sp create --id <appId>`.
2. Add a **federated credential** to that app registration:
   - Issuer: `https://token.actions.githubusercontent.com`
   - Subject: `repo:smagara/SlowDoughPizzaSite:ref:refs/heads/main`
     *(the workflow also uses an environment named `azure-oauth-provider`; if
     you enable environment protection rules, add a second credential with
     subject `repo:smagara/SlowDoughPizzaSite:environment:azure-oauth-provider`)*
   - Audience: `api://AzureADTokenExchange`
3. Grant it rights on the Function App (least privilege):
   `az role assignment create --assignee <appId> --role "Website Contributor" --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Web/sites/slowoauthfn`
4. Add three GitHub repository secrets: `AZURE_CLIENT_ID` (the app id),
   `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.

The workflow automatically uses Method A if `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`
is present, otherwise Method B.

---

## 4. Deploy the OAuth provider

Push to `main` (or run the workflow manually):

```
GitHub → Actions → "Deploy OAuth Provider (Azure Functions)" → Run workflow
```

The workflow:

1. runs the unit tests in `oauth-provider/test/`,
2. reads the Function App name + URL from `site.config.json`,
3. installs production dependencies and deploys `oauth-provider/` with
   `Azure/functions-action@v1`,
4. **smoke-tests** the live service: `GET /healthz` must return `ok`, and
   `GET /auth` must answer with a redirect to `https://github.com/login/oauth/authorize…`.
   A `500` from `/auth` means step 3a was skipped (missing client id/secret).

Manual check from any terminal:

```bash
curl -s https://slowoauthfn-b3hzcgbnfch8bhbz.eastus2-01.azurewebsites.net/healthz      # -> ok
curl -sI https://slowoauthfn-b3hzcgbnfch8bhbz.eastus2-01.azurewebsites.net/auth | grep -i location
# -> Location: https://github.com/login/oauth/authorize?client_id=...&scope=repo%2Cuser&state=...
```

The Azure workflow only runs when `oauth-provider/**`,
`site.config.json` or its own workflow file change, so day-to-day content
edits never redeploy the function.

---

## 5. Deploy the website to GitHub Pages

1. **One time:** in GitHub, **repo → Settings → Pages → Build and deployment →
   Source = "GitHub Actions"**. (Do not choose "Deploy from a branch".)
2. Push to `main`. The **"Build & Deploy (main)"** workflow validates
   `site.config.json` and the content files, builds with
   `base = /SlowDoughPizzaSite/`, and publishes `dist/` to Pages.
3. Open:
   - Site: `https://smagara.github.io/SlowDoughPizzaSite/`
   - Admin: `https://smagara.github.io/SlowDoughPizzaSite/admin/`
   - Generated Decap config (for debugging): `https://smagara.github.io/SlowDoughPizzaSite/admin/config.yml`

### First login test

1. Open the admin URL → click **Login with GitHub**.
2. A popup opens at `…azurewebsites.net/auth`, bounces to GitHub, asks you to
   authorize **Slow Dough Content Admin** (first time only), returns to
   `/callback`, and closes itself. The editor loads.
3. Only GitHub users who are **collaborators with write access** on
   `smagara/SlowDoughPizzaSite` get past this point — everyone else sees a
   Decap error after the popup closes. Add editors via **repo → Settings →
   Collaborators**.
4. Make a small edit (e.g. the Dough Announcement banner) → **Save** → set
   status **In review** → **Publish**. Decap creates branch
   `cms/announcement/announcement` and opens a Pull Request into `main`.
5. The **"PR Build Check"** workflow runs on that PR. Review, approve and
   **merge** it (squash merge is the default Decap uses — keep *Allow squash
   merging* enabled under repo Settings → General → Pull Requests).
6. The merge triggers **"Build & Deploy (main)"**; the change is live a minute
   or two later.

---

## 6. Changing the environment later

| You want to…                                   | Edit                                                              | Then                                                                  |
|------------------------------------------------|-------------------------------------------------------------------|-----------------------------------------------------------------------|
| Move the repo (new owner/name)                 | `site.config.json` → `github.repo`, `site.url`, `site.basePath`   | Update the OAuth App's *Homepage URL*; push; re-add collaborators     |
| Serve from a custom domain (root path)         | `site.url` → `https://www.example.com`, `site.basePath` → `/`      | Configure the domain under Settings → Pages; update OAuth App homepage |
| Move the OAuth proxy to a new Function App     | `oauthProvider.url`, `oauthProvider.azure.functionAppName`        | Update the OAuth App's *callback URL*; add the new publish profile / OIDC secret; push |
| Rotate the GitHub client secret                | *(nothing in the repo)*                                           | Generate a new secret in the OAuth App; update `OAUTH_GITHUB_CLIENT_SECRET` in Azure |
| Change the production branch                   | `site.config.json` → `github.branch` **and** the `branches:` lists in the three workflows | push                                                  |

After editing `site.config.json` run `npm run validate:config` and
`npm run build`; both CI workflows will refuse to deploy if the file is
inconsistent or still contains placeholders.

---

## 7. Local development (no Azure / GitHub login needed)

```bash
npm install
npm run dev:cms        # Vite on http://localhost:3000 + decap-server proxy on :8081
```

Open `http://localhost:3000/admin/`, click **Login** (no credentials — the
local proxy edits the files in `/content` directly). The production values
from `site.config.json` are still rendered into the local `/admin/config.yml`,
but Decap only talks to GitHub/Azure when the page is *not* on `localhost`.

To preview the real production build (with the `/SlowDoughPizzaSite/` base
path and the GitHub login button):

```bash
npm run build && npm run preview    # -> http://localhost:4173/SlowDoughPizzaSite/admin/
```

---

## 8. Troubleshooting

| Symptom                                                                 | Likely cause / fix                                                                                          |
|-------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Popup shows *"OAuth configuration error: Missing … OAUTH_GITHUB_CLIENT_ID"* | Step 3a not done, or settings saved on a deployment slot instead of the production app.                 |
| GitHub shows *"The redirect_uri is not associated with this application"* | OAuth App callback URL ≠ `oauthProvider.url` + `/callback`. Fix in GitHub (step 2), no redeploy needed. |
| Popup closes but Decap says the user isn't authorized / *"Not Found"*   | The GitHub account is not a collaborator with write access on `smagara/SlowDoughPizzaSite`.              |
| `/admin/` loads the pizza site instead of the editor                    | You are on `vite dev` and typed `/admin` without the slash; it redirects now. On Pages, verify `site.basePath`. |
| Deploy workflow fails at *"Deploy (publish profile)"* with 401/403        | The publish profile is stale or basic-auth publishing is disabled (see 3b-A). Download a fresh profile.   |
| Deploy workflow's smoke test times out on `/healthz`                    | Function App stopped, or the default hostname differs from `oauthProvider.url`. Check Overview → URL.     |
| Site assets 404 on GitHub Pages                                         | `site.basePath` must equal `/<repo-name>/` for project pages (or `/` for a custom domain).                |
| *"Failed to load config.yml"* in the admin                              | The build didn't emit `admin/config.yml`; run `npm run build` locally and check `dist/admin/config.yml`.  |

Logs: Function App → **Monitor → Logs / Log stream** for the OAuth service;
GitHub → **Actions** tab for both deploy workflows.
