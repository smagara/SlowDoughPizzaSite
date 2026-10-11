# Slow Dough Pizza Co. — website + content manager

A single-page React/Vite site for a fictional artisan pizzeria, with
[Decap CMS](https://decapcms.org) wired in so the owner can update the
**daily menu**, **blog posts**, the **dough announcement** banner and the
**opening hours** without touching code.

```
Owner edits at /admin  →  pull request on a cms/* branch  →  review & merge
                                                             →  GitHub Action builds & deploys to GitHub Pages
```

Full design rationale: `docs/Slow-Dough-Decap-CMS-Technical-Design.docx`.
Manager quick guide: `docs/Slow-Dough-Content-Manager-Guide.pdf`.

## Run locally

**Prerequisites:** Node.js 22+

```bash
npm install
npm run dev          # site only               → http://localhost:3000
npm run dev:cms      # site + local CMS proxy   → http://localhost:3000/admin/
```

`npm run dev:cms` starts Vite **and** `decap-server`, Decap's local proxy.
When `/admin` is opened on `localhost` and the proxy is running, no GitHub
login is needed and every save writes straight into `content/` (the site
hot-reloads). Review the result with `git diff` and commit as usual.

`npm run dev:cms:git` runs the proxy in *git* mode instead, which simulates
the production editorial workflow with local `cms/<collection>/<slug>`
branches (Draft → In review → Ready → Publish merges into your current branch).

## Checks

```bash
npm run validate:content   # schema + safety rules for everything in content/
npm run lint               # TypeScript
npm test                   # unit tests (markdown renderer, validator, OAuth handler)
npm run build              # production build into dist/
npm run check              # all of the above
```

## Project layout

| Path | Purpose |
| --- | --- |
| `content/settings/announcement.yml` | Top-of-page "dough announcement" banner |
| `content/settings/hours.yml` | Weekly schedule + header badge text |
| `content/menu/*.yml` | One file per menu category (items, prices, availability, tags) |
| `content/blog/*.md` | Blog posts: YAML front matter + Markdown body |
| `public/admin/` | Decap CMS admin page: `config.yml` (collections & validation), `cms.js` (previews, save guard), `admin.css` (site-styled skin) |
| `tools/content-loader.mjs` | Loads + validates `content/` — shared by the Vite plugin and CI |
| `tools/vite-plugin-site-content.mjs` | Exposes content as `virtual:site-content`; hot-reloads on change |
| `tools/vite-plugin-decap-admin.mjs` | Serves/bundles the pinned Decap build at `/admin/decap-cms.js` |
| `src/lib/safeMarkdown.ts` | Tiny Markdown parser → React elements (no raw HTML, ever) |
| `oauth/` | GitHub OAuth handler for production logins (Cloudflare Worker or Node) |
| `.github/workflows/` | `pr-checks.yml` (validate on every PR) and `deploy.yml` (build + Pages deploy on merge to `main`) |
| `.github/rulesets/` | Importable branch-protection ruleset for `main` |

## Production setup (one time, ~20 minutes)

1. **GitHub Pages** — Settings → Pages → *Source: GitHub Actions*.
   The deploy workflow works out the base path automatically
   (`/<repo>/` for project sites, `/` for `<owner>.github.io`).
   Using a custom domain? Set the repository variable `SITE_CUSTOM_DOMAIN`.
2. **Branch protection** — Settings → Rules → Rulesets → *Import* →
   `.github/rulesets/main-branch-protection.json`
   (requires a PR with 1 approval and the "Validate & build" check).
3. **GitHub OAuth App** — Settings → Developer settings → OAuth Apps → New:
   - Homepage URL: the live site URL
   - Authorization callback URL: `https://<oauth-host>/callback`
   Copy the *Client ID* and generate a *Client secret*.
4. **Deploy the OAuth handler** — see [`oauth/README.md`](oauth/README.md)
   (free Cloudflare Worker, or any Node host). Configure
   `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REPO`, `ALLOWED_ORIGINS`.
5. **Point the CMS at it** — in `public/admin/config.yml` set `backend.repo`,
   `backend.base_url` (the OAuth handler origin, no path) and `site_url`.
6. **Invite editors** — add the owner/manager as repository **collaborators
   with Write access**. Only such accounts can sign in to `/admin`; reviewers
   need at least Write to approve and merge.

## Editing flow in production

1. Owner opens `https://<site>/admin/` (also linked discreetly as "Staff" in
   the footer) and signs in with GitHub.
2. Edits an entry; the live preview shows it in the site's styling.
3. **Save** → Decap commits to a `cms/<collection>/<slug>` branch and opens a
   pull request (never to `main`). The status (Draft / In review / Ready)
   is a label on the PR.
4. A reviewer approves and merges the PR on GitHub.
5. `deploy.yml` rebuilds the site and publishes it to GitHub Pages.

## Validation & safety

Free text entered in the CMS is checked in three places:

1. **In the browser** — every field has a `pattern` that rejects HTML tags,
   `javascript:` URLs and over-long text, with a friendly message; a
   `preSave` hook in `cms.js` refuses to save if anything slipped through.
2. **In CI** — `npm run validate:content` re-checks every file on every PR
   and fails the required status check.
3. **At render time** — all content is rendered through React (auto-escaped)
   and blog Markdown goes through `SafeMarkdown`, which never emits raw HTML
   and only allows `http(s):`, `mailto:`, relative and `#` links.

## Typography

Body text uses the system sans-serif font stack (including Segoe UI on Windows).
Headings and serif accents use Georgia, with Times New Roman as a fallback.
All fonts are local.

## AI Disclosure

This site was originally generated with AI assistance in Google AI Studio.
All details, phone numbers, addresses, the company name, etc. are completely fictionalized.

## License

This project is licensed under the [MIT License](./LICENSE).
