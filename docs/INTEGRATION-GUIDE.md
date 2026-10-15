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
                     "azure": { "functionAppName": "SlowOAuthFn", "region": "eastus2" } }
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
4. Copy the **Client ID** (looks like `Ov23li…` or 20 hex characters) and the
   **Client secret** — you will paste them into Azure in the next step. (The
   secret is shown only once.)

> The callback URL must be the OAuth provider host + `/callback` — *not* the
> GitHub Pages site and *not* `…/api/callback`. If `oauthProvider.url` ever
> changes, update this field too. GitHub sends the browser to this URL after
> the user approves; anything else produces either a GitHub
> *"redirect_uri is not associated with this application"* error or a 404
> on the Pages site.

> **Two unrelated "client IDs" — don't mix them up.**
>
> | ID | Looks like | Where it comes from | Where it goes |
> |----|------------|---------------------|---------------|
> | GitHub OAuth App **Client ID** | `Ov23li…` / 20 hex chars | github.com → Settings → Developer settings → OAuth Apps → *SlowDoughPizzaSite_Decap* | Function App setting **`OAUTH_GITHUB_CLIENT_ID`** (+ its secret → `OAUTH_GITHUB_CLIENT_SECRET`) |
> | Entra app registration **Application (client) ID** | GUID `4230312f-…` | Azure portal → App registrations → *SlowDoughDecapCMS* | GitHub repository secret **`AZURE_CLIENT_ID`** (deploy-time only) |
>
> If the GUID ends up in `OAUTH_GITHUB_CLIENT_ID`, the login popup lands on a
> GitHub **404 "This is not the web page you are looking for"** page, because
> GitHub has no OAuth App with that id. The deploy workflow's pre-flight and
> smoke test now both detect this.

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

**Method B — OpenID Connect (no stored secret; recommended, and REQUIRED on
Flex Consumption)**

1. Create an Entra ID app registration (or use an existing one):
   `az ad app create --display-name slowdough-github-deploy`
   and a service principal for it: `az ad sp create --id <appId>`.
2. Add a **federated credential** to that app registration. Entra matches the
   **subject** string *character for character*, and GitHub now embeds the
   immutable owner and repository IDs in it, so the value is:

   ```
   repo:smagara@17964984/SlowDoughPizzaSite@1413782001:ref:refs/heads/main
   ```

   (`17964984` = the `smagara` account ID, `1413782001` = the repository ID;
   both are printed by `gh api repos/smagara/SlowDoughPizzaSite --jq '.owner.id, .id'`.
   The workflow's **"Show OIDC subject claim"** step also prints the exact
   value and puts a copy-paste `az` command in the run's *Summary* tab.)

   > In the portal's **"GitHub Actions deploying Azure resources"** scenario,
   > fill in **Organization ID = `17964984`** and **Repository ID =
   > `1413782001`** (fields next to the names; the page also shows a banner
   > recommending this "new subject identifier format with immutable IDs").
   > The generated *Subject identifier* must read exactly
   > `repo:smagara@17964984/SlowDoughPizzaSite@1413782001:ref:refs/heads/main`.
   > If the IDs are left blank the old ID-less subject is generated, which
   > **does not match** and fails `azure/login` with
   > `AADSTS700213: No matching federated identity record found`. CLI
   > equivalent:

   ```bash
   az ad app federated-credential create --id <Application (client) ID> --parameters '{
     "name": "github-slowdough-main",
     "issuer": "https://token.actions.githubusercontent.com",
     "subject": "repo:smagara@17964984/SlowDoughPizzaSite@1413782001:ref:refs/heads/main",
     "audiences": ["api://AzureADTokenExchange"]
   }'
   ```

   (The **Other issuer** scenario also works: Issuer
   `https://token.actions.githubusercontent.com`, Subject identifier = the
   string above, Audience `api://AzureADTokenExchange`.) It does no harm to
   also keep a credential with the ID-less subject.

   The deploy job intentionally has no `environment:` — if one is ever added,
   the token's subject becomes `repo:…:environment:<name>` and a credential
   with that subject is required. Manual `workflow_dispatch` runs from `main`
   present the same `ref:refs/heads/main` subject, so one credential covers
   both. If you'd rather not depend on the exact format, Entra's *flexible*
   federated credentials accept an expression such as
   `claims['sub'] matches 'repo:smagara*/SlowDoughPizzaSite*:ref:refs/heads/main'`.
3. **Grant the identity a role on the Function App — this step is what makes
   the subscription visible to `az login`.** A federated credential only
   proves *who* the workflow is; without a role assignment the sign-in
   succeeds and then fails with **`No subscriptions found for <client-id>`**.

   > **Which identity?** There are two different principals in play, and the
   > role must go to the first one:
   >
   > | Principal | Where you see it | Used for |
   > |-----------|------------------|----------|
   > | **Service principal of the app registration** (the one holding the federated credential; its *Application (client) ID* is `AZURE_CLIENT_ID`) | Entra ID → *Enterprise applications* → same display name as the app registration | **GitHub Actions signs in as this.** It needs **Contributor** on the Function App / resource group. |
   > | Managed identity of the Function App (`slowoauthfn`) | Function App → *Identity* → *Azure role assignments* | Used by the *running* function (e.g. `Storage Blob Data Contributor` on the Flex deployment container — leave that in place). Roles here do **not** apply to GitHub Actions. |
   >
   > In the portal's *Add role assignment → Members* picker, search for the
   > **app registration's display name**, not for `slowoauthfn`.
   >
   > There is **no conflict** between the two: keep the Function App's
   > system-assigned identity **On** (Flex Consumption uses it — with
   > *Storage Blob Data Contributor* on the deployment container — to load the
   > deployed package; turning it off breaks the app). Extra roles granted to
   > that managed identity (Contributor / Website Contributor on `CMS`) are
   > unnecessary and can be removed for least privilege, but they don't
   > interfere with the GitHub deployment either.
   >
   > **Which ID goes where?** The Enterprise application's *Overview* shows
   > two IDs:
   >
   > | ID on the Enterprise application page | Use it for |
   > |---|---|
   > | **Application ID** (same as the app registration's *Application (client) ID*) | the GitHub secret **`AZURE_CLIENT_ID`** |
   > | **Object ID** (the service principal's object id) | only for role assignment by object id: `az role assignment create --assignee-object-id <Object ID> --assignee-principal-type ServicePrincipal …` |
   >
   > Do **not** put the Object ID in `AZURE_CLIENT_ID`. *"Assign users and
   > groups"* on the Enterprise application page is single-sign-on user
   > assignment and has no effect on Azure RBAC.

   Step-by-step in the portal: *Subscriptions → your subscription → Resource
   groups → `CMS` → Access control (IAM) → **+ Add → Add role assignment** →
   tab **Privileged administrator roles** → **Contributor** → Next → Assign
   access to: **User, group, or service principal** → **+ Select members** →
   type `SlowDoughDecapCMS` → select it → Review + assign.* Confirm with *IAM
   → Check access → search `SlowDoughDecapCMS`* (it should list Contributor),
   or with `az role assignment list --assignee <Application ID> --all -o table`.
   New assignments can take 2–5 minutes to become effective.
   `Website Contributor` on the app is enough for Consumption/Premium; on
   **Flex Consumption** the action also needs to read the app's deployment
   configuration, so grant **Contributor** on the Function App (or its
   resource group):

   ```bash
   az ad sp create --id <Application (client) ID>      # only if Entra -> Enterprise applications has no entry for the app yet
   az role assignment create --assignee <Application (client) ID> --role Contributor \
     --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Web/sites/slowoauthfn
   az role assignment list --assignee <Application (client) ID> --all -o table   # verify: one Contributor row
   ```

   Portal: *Function App → Access control (IAM) → Add → Add role assignment →
   Privileged administrator roles → **Contributor** → Members: **User, group,
   or service principal** → Select members → search the app registration's
   display name → Review + assign.* Role assignments can take a couple of
   minutes to propagate.

   Also make sure the subscription that holds `slowoauthfn` belongs to the
   **same directory (tenant)** as the app registration: *Portal → Subscriptions
   → "Directory" column* must match `AZURE_TENANT_ID`. A subscription attached
   to a different directory is invisible to this identity no matter what role
   you assign.
4. Add three GitHub repository secrets:

   | Secret                  | Value                                                                 |
   |-------------------------|-----------------------------------------------------------------------|
   | `AZURE_CLIENT_ID`       | the app registration's **Application (client) ID** (not the object ID) |
   | `AZURE_TENANT_ID`       | Directory (tenant) ID                                                 |
   | `AZURE_SUBSCRIPTION_ID` | the subscription that contains `slowoauthfn`                          |

The workflow's **Select deployment method** step uses Method A if
`AZURE_FUNCTIONAPP_PUBLISH_PROFILE` is present, Method B if the three OIDC
secrets are present, and **fails immediately with a clear message if neither
is configured**. The OIDC path then runs a pre-flight that verifies the
identity can see the Function App, that its hostname matches
`site.config.json`, and that the OAuth app settings exist — before deploying.

---

## 4. Deploy the OAuth provider

Push to `main` (or run the workflow manually):

```
GitHub → Actions → "Deploy OAuth Provider (Azure Functions)" → Run workflow
```

The workflow:

1. runs the unit tests in `oauth-provider/test/`,
2. reads the Function App name + URL from `site.config.json`,
3. selects the authentication method (fails if no secrets are configured) and
   **pre-flight checks** it: with a publish profile, against Kudu (see
   [8a](#8a-kudu-401-with-the-publish-profile)); with OIDC, that the identity
   can see the app, the hostname matches `site.config.json`, and
   `OAUTH_GITHUB_CLIENT_ID` / `OAUTH_GITHUB_CLIENT_SECRET` exist,
4. installs production dependencies and deploys `oauth-provider/` with
   `Azure/functions-action@v1`, then **verifies a deploy step actually ran**,
5. **smoke-tests** the live service: `GET /healthz` must return `ok`, and
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
| Popup lands on a GitHub **404 page** (`github.com/login/oauth/authorize?client_id=<a GUID>`) | `OAUTH_GITHUB_CLIENT_ID` on the Function App holds the Entra application id instead of the GitHub OAuth App Client ID (`Ov23li…`). Fix the two app settings from the GitHub OAuth App page; no redeploy needed (the app reads settings at runtime). |
| Popup shows *"OAuth configuration error: OAUTH_GITHUB_CLIENT_ID is a GUID…"* | Same as above — the service now refuses to send an Entra id to GitHub and tells you which id belongs where. |
| After approving on GitHub, the popup shows **400** from `…azurewebsites.net/callback` with *"Sign-in could not be completed (CSRF state check) …"* | This is the service's own **CSRF** (cross-site request *forgery*, not scripting) guard, not a permission on GitHub or Azure — nothing needs to be "allowed" on either side. `/auth` sets a 5-minute `sd_oauth_state` cookie and `/callback` requires it back. The page text says which half is missing: *browser did not send the cookie* → usually the deployed function returned the cookie via a raw `Set-Cookie` header that the Functions host dropped (fixed: cookies now go through the v4 `cookies` property — redeploy), cookies blocked by a privacy setting/extension, or >5 min spent on the GitHub page; *no `state` parameter* → the flow did not start at `/auth`. The deploy smoke test now verifies `/auth` sets the cookie. |
| GitHub shows *"The redirect_uri is not associated with this application"*, or after approving you land on a 404 at `smagara.github.io/…/api/callback` | OAuth App **Authorization callback URL** must be exactly `https://slowoauthfn-b3hzcgbnfch8bhbz.eastus2-01.azurewebsites.net/callback` (step 2). Fix in GitHub, no redeploy needed. |
| Popup closes but Decap says the user isn't authorized / *"Not Found"*   | The GitHub account is not a collaborator with write access on `smagara/SlowDoughPizzaSite`.              |
| `/admin/` loads the pizza site instead of the editor                    | You are on `vite dev` and typed `/admin` without the slash; it redirects now. On Pages, verify `site.basePath`. |
| Deploy workflow fails with *"Failed to fetch Kudu App Settings. Unauthorized (CODE: 401)"* | See [8a](#8a-kudu-401-with-the-publish-profile) — basic-auth publishing is off (or the profile is stale). |
| Deploy workflow fails at Kudu with **403**                                | The SCM site has access restrictions blocking GitHub runners (Networking → Access restriction → *Advanced tool site*). |
| Smoke test fails with `/healthz` → **404** (×20)                         | Nothing is deployed or functions failed to index — see [8b](#8b-healthz-returns-404-after-the-workflow-runs).  |
| Smoke test cannot connect to `/healthz` (HTTP 000)                       | Function App stopped, or the default hostname differs from `oauthProvider.url`. Check Overview → URL.     |
| `azure/login` fails with **AADSTS70021 / AADSTS700213** *No matching federated identity record found for presented assertion subject '…'* | The federated credential subject must equal the subject quoted in the error, character for character (GitHub includes `@<id>` suffixes; the portal wizard omits them). Copy it from the error or from the "Show OIDC subject claim" step / run Summary and create the credential via CLI or the "Other issuer" scenario — see 3b-B. |
| `azure/login` fails with **AADSTS700016** *application not found*        | `AZURE_CLIENT_ID` is not the app registration's Application (client) ID, or wrong `AZURE_TENANT_ID`.     |
| `azure/login` / OIDC pre-flight: **No subscriptions found for `<client-id>`** / **The subscription of '`<id>`' doesn't exist in cloud 'AzureCloud'** / *has NO role assignment in any subscription* | The sign-in worked; the **app registration's service principal** has no role assignment visible in that subscription — most often because the role was given to the Function App's *managed identity* instead (see the "Which identity?" box in 3b-B step 3), or the subscription is in another tenant. The subscription ID itself is not the problem, and repository secrets are fine — environment secrets are *not* required. Verify with `az role assignment list --assignee <client-id> --all -o table`. |
| OIDC pre-flight: *AZURE_SUBSCRIPTION_ID … is not among the subscriptions this identity can access* | The step lists the visible subscriptions. If the only entry is **`N/A(tenant level account)`**, the identity still has **no role assignment anywhere** (same fix as the row above); otherwise the secret holds a different subscription than the one where the role was assigned. |
| OIDC pre-flight: *cannot see a Function App named '…'* — *It can see NO Microsoft.Web/sites at all* | The Contributor role is not on resource group `CMS` for **`SlowDoughDecapCMS`** (check *RG → IAM → Check access*); roles on the Function App's managed identity don't count. |
| OIDC pre-flight: *cannot see a Function App named '…'* but lists *Sites it CAN see* | The app exists under a different name/case or resource group; copy the exact name into `oauthProvider.azure.functionAppName`. (Azure keeps the name's original case, e.g. `SlowOAuthFn`; the pre-flight matches case-insensitively and deploys using the exact name.) |
| Site assets 404 on GitHub Pages                                         | `site.basePath` must equal `/<repo-name>/` for project pages (or `/` for a custom domain).                |
| *"Failed to load config.yml"* in the admin                              | The build didn't emit `admin/config.yml`; run `npm run build` locally and check `dist/admin/config.yml`.  |

Logs: Function App → **Monitor → Logs / Log stream** for the OAuth service;
GitHub → **Actions** tab for both deploy workflows.

### 8a. Kudu 401 with the publish profile

Symptom in the *Deploy OAuth Provider (Azure Functions)* run:

```
Run Azure/functions-action@v1
Successfully parsed SCM credential from publish-profile format.
Error: ... Get Function App Settings : Failed to acquire app settings from https://<scmsite>/api/settings with publish-profile
Error:   Failed to fetch Kudu App Settings.
Unauthorized (CODE: 401)
```

The action could parse the profile but Kudu (the Function App's deployment
endpoint) rejected its username/password. In order of likelihood:

1. **SCM Basic Auth Publishing Credentials is OFF** on the Function App. Azure
   turns this off by default for new apps; the portal still lets you download a
   profile, but Kudu refuses it. (≈90 % of cases.)
2. **The profile is stale** — publishing credentials were reset after download
   (e.g. basic auth was toggled, or someone clicked *Reset publish profile*).
3. **The secret isn't the whole XML file** (only the password pasted, text
   wrapped/edited, or the profile of another app or a slot).
4. **Flex Consumption plan** — basic auth is off by default and publish-profile
   deploys are only partially supported; use OIDC.

**Confirm in 2 minutes.** The workflow now has a *Pre-flight* step that
performs this check automatically and prints the fix; to do it by hand, take
`publishUrl`, `userName`, `userPWD` from the `publishMethod="MSDeploy"` entry
of the `.PublishSettings` file and run:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -u '<userName>:<userPWD>' 'https://<publishUrl>/api/settings'
#  401 -> basic auth off / stale profile (causes 1-2)
#  200 -> profile is fine; the GitHub secret is wrong or incomplete (cause 3)
```

or ask Azure for the policy directly:

```bash
az resource show -g <rg> --resource-type Microsoft.Web/sites/basicPublishingCredentialsPolicies \
  --name scm --parent sites/slowoauthfn --query properties.allow      # false => cause 1
az functionapp show -g <rg> -n slowoauthfn --query "{plan:sku, kind:kind}"  # "FlexConsumption" => prefer OIDC
```

You can also run the same pre-flight locally (the file is never committed):

```bash
PUBLISH_PROFILE="$(cat slowoauthfn.PublishSettings)" EXPECTED_APP_NAME=slowoauthfn \
  python3 .github/scripts/check-publish-profile.py
```

**Fix — Option 1 (keep the publish profile):**

1. Portal → Function App → **Settings → Configuration → General settings →
   SCM Basic Auth Publishing Credentials = On** → **Save**.
   CLI: `az resource update -g <rg> --resource-type Microsoft.Web/sites/basicPublishingCredentialsPolicies --name scm --parent sites/slowoauthfn --set properties.allow=true`
2. **Overview → Get publish profile** — download a *fresh* file (the old one may
   have been invalidated).
3. Replace the `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` secret with the **entire**
   file contents and re-run the workflow.

**Fix — Option 2 (switch to OIDC; recommended, and required on Flex Consumption):**
delete the `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` secret and add
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` as described in
[3b — Method B](#3b-give-github-actions-permission-to-deploy--pick-one-method).
The workflow switches to `azure/login` automatically when the publish-profile
secret is absent.

### 8b. `/healthz` returns 404 after the workflow runs

Symptom: every step is green until the smoke test, which logs
`curl: (22) The requested URL returned error: 404` twenty times.

A 404 from `<host>/healthz` means the Function App itself is up (Azure
answered) but **no function named `healthz` exists in it**. Check, in order:

1. **Did a deploy step actually run?** Open the run → *Deploy to Azure
   Functions* job. You should see **"Azure login (OIDC)"** and **"Deploy
   (OIDC)"** (or the publish-profile pair) with a green tick, *not* grey
   "skipped". In the raw log, the "Download action repository" lines at the
   top must include `azure/login@v2`; if they don't, the OIDC steps are
   missing from the workflow file on `main` — restore
   `.github/workflows/deploy-oauth-provider-azure.yml` from this repository.
   The current workflow fails early in this situation ("Neither deploy step
   ran successfully").
2. **Did the deployment produce functions?** Portal → Function App →
   **Overview → Functions** must list `auth`, `callback`, `healthz`. If the
   list is empty, open **Log stream** / **Monitor → Logs** and look for
   `Worker failed to index functions` or a Node stack trace — typically a
   missing dependency (`node_modules` not shipped) or a syntax error in
   `oauth-provider/azure/functions/index.js`. The package must contain
   `host.json`, `package.json` (with `"main": "azure/functions/index.js"`),
   `azure/`, `lib/` and `node_modules/`.
3. **Flex Consumption specifics:**
   - `WEBSITE_RUN_FROM_PACKAGE` must **not** be set (the OIDC pre-flight
     checks this). Flex runs from the deployment storage container instead.
   - The deploying identity needs **Contributor** on the app (not just
     Website Contributor) — check *Deployment Center → Logs* for 403s.
   - The runtime stack must be **Node.js 20**; `host.json` sets
     `routePrefix: ""`, which is supported on Flex.
4. **Manual deploy to isolate the problem** (requires Azure Functions Core
   Tools + `az login`): from `oauth-provider/`, run
   `npm ci --omit=dev && func azure functionapp publish slowoauthfn`. The
   output lists the deployed functions and their invoke URLs; if this works
   but the workflow doesn't, the issue is in the workflow's credentials.
