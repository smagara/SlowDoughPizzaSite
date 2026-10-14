## Run Locally

**Prerequisites:**  Node.js 20+

1. Install dependencies:
   `npm install`

2. Run the app:
   `npm run dev`

## Content & the `/admin` CMS

Day-to-day content (the Daily Menu, the Dough Announcement banner, Store
Hours, and Blog Posts) lives as plain JSON/Markdown files under
[`/content`](./content) and is rendered at build time by
[`src/data/contentLoader.ts`](./src/data/contentLoader.ts). The pizza
shop owner edits this content through a [Decap CMS](https://decapcms.org)
admin UI at `/admin`, instead of editing these files by hand.

- **Local editing** (no GitHub login required): run
  `npm run dev:cms` (starts both Vite and the Decap local-backend proxy),
  then open `http://localhost:3000/admin`.
- **Production editing**: collaborators on this GitHub repo sign in with
  GitHub at `https://smagara.github.io/SlowDoughPizzaSite/admin/` and
  publish changes as a Pull Request for review — see the Technical Design
  Document for the full flow.

### Environment configuration (one file)

The GitHub repo, the GitHub Pages URL/base path and the Azure OAuth host are
all defined in [`site.config.json`](./site.config.json). `vite.config.ts`
reads it to set the build base path and to generate `/admin/config.yml`
from [`admin/config.template.yml`](./admin/config.template.yml); the GitHub
Actions workflows read it too. Run `npm run validate:config` after editing.

| Piece                         | Deployed by                                             | Target                                                                 |
|-------------------------------|---------------------------------------------------------|------------------------------------------------------------------------|
| Website + `/admin`            | `.github/workflows/deploy.yml` (on merge to `main`)     | GitHub Pages — https://smagara.github.io/SlowDoughPizzaSite             |
| OAuth proxy (`oauth-provider/`) | `.github/workflows/deploy-oauth-provider-azure.yml`   | Azure Functions — https://slowoauthfn-b3hzcgbnfch8bhbz.eastus2-01.azurewebsites.net |

Step-by-step setup (GitHub OAuth App, Azure app settings, Actions secrets,
Pages) lives in **[`docs/INTEGRATION-GUIDE.md`](./docs/INTEGRATION-GUIDE.md)**.

Full design rationale, the PR/review/deploy pipeline, and an
owner-facing how-to guide live in [`/docs`](./docs):

- `docs/technical-design-document.docx` — architecture, decisions, and
  open questions.
- `docs/pizza-manager-guide.pdf` — a 1–2 page illustrated guide for the
  shop owner.
- `docs/INTEGRATION-GUIDE.md` — deployment/integration runbook (GitHub
  Pages + Azure Functions).

The GitHub OAuth handshake service required for production `/admin`
logins is a separate, tiny deployable in [`/oauth-provider`](./oauth-provider),
deployed to Azure Functions by its own workflow.

## Typography

Body text uses the system sans-serif font stack (including Segoe UI on Windows).
Headings and serif accents use Georgia, with Times New Roman as a fallback.
All fonts are local.

## AI Disclosure

This site was originally generated with AI assistance in Google AI Studio.
All details, phone numbers, addresses, the company name, etc. are completely fictionalized.

## License

This project is licensed under the [MIT License](./LICENSE).