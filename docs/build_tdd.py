#!/usr/bin/env python3
"""Generates docs/technical-design-document.docx for Slow Dough's Decap CMS integration."""
import os
from docx import Document
from docx.shared import Pt, Inches, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

HERE = os.path.dirname(os.path.abspath(__file__))
SCREENS = os.path.join(HERE, "screenshots")
DIAGRAMS = os.path.join(HERE, "diagrams")

BRAND_DARK = RGBColor(0x24, 0x21, 0x1E)
BRAND_ORANGE = RGBColor(0xC8, 0x5A, 0x32)
BRAND_GRAY = RGBColor(0x52, 0x49, 0x40)
BRAND_LIGHT_BG = "FAF8F5"
BRAND_TABLE_HEAD = "24211E"

doc = Document()

# ---------------------------------------------------------------------
# Base style setup
# ---------------------------------------------------------------------
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(10.5)
style.font.color.rgb = BRAND_DARK

for i in range(1, 4):
    h = doc.styles[f"Heading {i}"]
    h.font.color.rgb = BRAND_ORANGE if i == 1 else BRAND_DARK
    h.font.name = "Calibri"


def set_cell_background(cell, color_hex):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color_hex)
    cell._tc.get_or_add_tcPr().append(shd)


def add_title_page():
    doc.add_paragraph().paragraph_format.space_before = Pt(60)
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("Slow Dough Pizza Co.")
    run.font.size = Pt(30)
    run.font.bold = True
    run.font.color.rgb = BRAND_DARK

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run("Decap CMS Content Management Integration")
    r.font.size = Pt(18)
    r.font.color.rgb = BRAND_ORANGE

    sub2 = doc.add_paragraph()
    sub2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r2 = sub2.add_run("Technical Design Document")
    r2.font.size = Pt(14)
    r2.italic = True
    r2.font.color.rgb = BRAND_GRAY

    doc.add_paragraph()
    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta_run = meta.add_run(
        "Version 1.1\nPrepared for: Slow Dough Pizza Co. ownership & engineering\n"
        "Scope: /admin content editor, GitHub-backed editorial workflow, CI/CD,\n"
        "GitHub Pages + Azure Functions deployment"
    )
    meta_run.font.size = Pt(11)
    meta_run.font.color.rgb = BRAND_GRAY
    doc.add_page_break()


def add_heading(text, level=1):
    doc.add_heading(text, level=level)


def add_para(text, *, bold=False, italic=False, size=None, color=None):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = bold
    r.italic = italic
    if size:
        r.font.size = Pt(size)
    if color:
        r.font.color.rgb = color
    return p


def add_bullets(items, numbered=False):
    style_name = "List Number" if numbered else "List Bullet"
    for item in items:
        p = doc.add_paragraph(style=style_name)
        if isinstance(item, tuple):
            label, rest = item
            run = p.add_run(label)
            run.bold = True
            p.add_run(rest)
        else:
            p.add_run(item)


def add_image(path, width_in=6.3, caption=None):
    doc.add_picture(path, width=Inches(width_in))
    last = doc.paragraphs[-1]
    last.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if caption:
        cap = doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = cap.add_run(caption)
        r.italic = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = BRAND_GRAY


def add_table(headers, rows, col_widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Light Grid Accent 1"
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = ""
        p = hdr_cells[i].paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_background(hdr_cells[i], BRAND_TABLE_HEAD)
    for row in rows:
        cells = table.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = str(val)
    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Inches(w)
    doc.add_paragraph()
    return table


# =======================================================================
# TITLE PAGE
# =======================================================================
add_title_page()

# =======================================================================
# 1. OVERVIEW
# =======================================================================
add_heading("1. Overview", 1)
add_para(
    "This document describes the design and implementation of a self-service content "
    "management workflow for the Slow Dough Pizza Co. marketing website, using Decap CMS "
    "(the actively maintained open-source successor to Netlify CMS). The goal is to let a "
    "non-technical pizza shop owner/manager make routine updates \u2014 adjusting the Daily "
    "Menu, publishing Blog posts in \u201cThe Baker's Journal,\u201d and changing the \u201cDough "
    "Announcement\u201d banner \u2014 without writing code or touching Git directly, while keeping "
    "every change reviewable, reversible, and safe."
)
add_para("Key outcomes delivered:", bold=True)
add_bullets(
    [
        "A hidden, unlisted admin route at /admin that renders a brand-styled Decap CMS editor.",
        "Three owner-editable content areas (Daily Menu, Blog Posts, Dough Announcement) plus a bonus Store Hours collection, all backed by plain JSON/Markdown files in /content.",
        "A local editing mode for development/testing that requires no GitHub credentials.",
        "A production editing mode gated by real GitHub collaborator permissions via OAuth.",
        "An editorial workflow: every saved change opens a feature branch and a GitHub Pull Request instead of writing to main directly.",
        "Defense-in-depth validation against script/HTML injection in free-text fields.",
        "A GitHub Actions pipeline that automatically builds and deploys the site the moment a content PR is approved and merged to main.",
    ]
)

# =======================================================================
# 2. ARCHITECTURE AT A GLANCE
# =======================================================================
add_heading("2. Architecture at a Glance", 1)
add_para(
    "Slow Dough is a static Vite + React single-page site (no server-side rendering, no "
    "backend database). Content that used to be hard-coded TypeScript objects "
    "(src/data/pizzaShopData.ts) has been extracted into plain-text files under /content, "
    "which are compiled into the site at build time via src/data/contentLoader.ts using "
    "Vite's import.meta.glob. Decap CMS is a pure client-side React application that edits "
    "those same files directly in the Git repository \u2014 there is no custom backend server "
    "for content storage. The only custom server-side code introduced is a minimal OAuth "
    "hand-off service (/oauth-provider) required by GitHub's OAuth spec, which never stores "
    "any content or tokens."
)
add_para("Deployment topology for the demo environment:", bold=True)
add_table(
    ["Component", "Hosting", "URL / identifier", "Deployed by"],
    [
        ("Website + /admin", "GitHub Pages (project site)", "https://smagara.github.io/SlowDoughPizzaSite", ".github/workflows/deploy.yml"),
        ("Source of truth (content + code)", "GitHub repository", "smagara/SlowDoughPizzaSite, branch main", "\u2014"),
        ("OAuth hand-off service", "Azure Functions (Node 20, v4 model)", "https://slowoauthfn-b3hzcgbnfch8bhbz.eastus2-01.azurewebsites.net (app: slowoauthfn)", ".github/workflows/deploy-oauth-provider-azure.yml"),
    ],
    col_widths=[1.5, 1.6, 2.4, 1.6],
)
add_para(
    "All three environment-specific values (repo slug, Pages URL/base path, OAuth host / "
    "Function App name) are declared once in /site.config.json. vite.config.ts reads that "
    "file to set the production base path (/SlowDoughPizzaSite/) and to render "
    "admin/config.template.yml into the served /admin/config.yml; the deployment workflows "
    "read it with jq. Re-pointing the solution at a different repo, domain or Azure app is "
    "therefore a one-file change validated by npm run validate:config in CI."
)
add_image(os.path.join(DIAGRAMS, "flow.png"), width_in=6.4,
          caption="Figure 1 \u2014 End-to-end content publishing flow, local dev mode (left) and production GitHub-backed editorial workflow (right).")

# =======================================================================
# 3. CONTENT MODEL
# =======================================================================
add_heading("3. Content Model", 1)
add_para(
    "Each editable area maps 1:1 to a Decap CMS \u201ccollection\u201d and a file (or folder of "
    "files) under /content. This keeps the mapping between \u201cwhat the owner edits\u201d and "
    "\u201cwhat the site renders\u201d obvious and auditable in any PR diff."
)
add_table(
    ["CMS Collection", "Storage", "Type", "Rendered by"],
    [
        ("Dough Announcement", "content/announcement.json", "Single file", "Navbar.tsx banner, Hero.tsx headline"),
        ("Daily Menu", "content/menu.json", "Single file, nested lists", "MenuSection.tsx"),
        ("Store Hours", "content/hours.json", "Single file, nested list", "HoursAndLocation.tsx"),
        ("Blog Posts", "content/blog/*.md", "Folder, one Markdown file per post", "ArticlesSection.tsx"),
    ],
    col_widths=[1.6, 2.0, 1.5, 2.0],
)
add_para(
    "Blog posts store their long-form body as Markdown (YAML frontmatter for metadata, "
    "Markdown body below the --- separator) rather than the original nested "
    "{sectionHeading, paragraphs, quote} JSON structure. This trade-off was made "
    "deliberately: Decap's \u201cmarkdown\u201d widget is the natural authoring surface for long-form "
    "text (it gives the owner a familiar rich-text toolbar), and it collapses what used to be "
    "a fiddly nested-list editing experience into a single, forgiving text field. The "
    "front-end now renders that Markdown through a small sanitize-on-render pipeline "
    "(see Section 5)."
)

# =======================================================================
# 4. THE /admin EXPERIENCE
# =======================================================================
add_heading("4. The /admin Experience", 1)
add_para(
    "/admin is intentionally not linked anywhere in the site's navigation, footer, or "
    "sitemap \u2014 it is discoverable only if you know the URL, functioning as the \u201chidden "
    "link\u201d requested. It is still a fully public URL (anyone can load the login screen), "
    "so the real access boundary is enforced one layer down by the GitHub backend's "
    "collaborator check (Section 6), not by obscurity."
)
add_para(
    "Decap CMS is bundled with Vite as a second, independent entry point "
    "(admin/index.html \u2192 src/admin/main.tsx) rather than pulled from a public CDN at "
    "runtime. This keeps the admin bundle versioned, code-reviewed, and reproducible "
    "alongside the rest of the codebase, and avoids a runtime dependency on a third-party "
    "CDN being available/unblocked."
)
add_image(os.path.join(SCREENS, "08-admin-login-screen.png"), width_in=6.3,
          caption="Figure 2 \u2014 Branded /admin login screen (custom logo, copy, and color palette).")
add_para(
    "Every collection registers a custom, brand-matched live preview pane "
    "(src/admin/previews.tsx + src/admin/previewStyles.ts) so the owner sees something "
    "close to the real site while editing, instead of Decap's generic default preview."
)
add_image(os.path.join(SCREENS, "05-admin-menu-editor.png"), width_in=6.3,
          caption="Figure 3 \u2014 Daily Menu editor: nested category/item lists on the left, live brand-styled preview on the right.")
add_image(os.path.join(SCREENS, "06-admin-blog-editor.png"), width_in=6.3,
          caption="Figure 4 \u2014 Blog Post editor: Markdown body widget, metadata fields, and a preview matching the live article view (including the same pull-quote styling).")

# =======================================================================
# 5. VALIDATION & XSS / SCRIPT-INJECTION HANDLING
# =======================================================================
add_heading("5. Free-Text Validation & Script-Injection Handling", 1)
add_para(
    "Free text authored through a CMS is, by definition, untrusted input \u2014 even when the "
    "author is a trusted collaborator, mistakes (pasting rich text from a Word doc full of "
    "markup, or a stray <script> from a copy-pasted snippet) should not be able to "
    "compromise the site. Four independent layers guard against this:"
)
add_bullets(
    [
        (
            "Layer 1 \u2014 CMS field patterns (public/admin/config.yml): ",
            "every free-text string/text field most at risk (titles, descriptions, excerpts, "
            "banner text, the homepage intro) declares a regex \u201cpattern\u201d validator, e.g. "
            "^((?!<script).)*$, that Decap enforces live in the editor before the Save/Publish "
            "button will even submit. This gives the owner immediate, specific feedback "
            "(\u201cFor security reasons, <script> tags are not allowed\u201d) rather than a cryptic "
            "failure later.",
        ),
        (
            "Layer 2 \u2014 Client-side publish guard (src/admin/main.tsx): ",
            "a registerEventListener('prePublish', \u2026) hook scans every field on submit for "
            "script/HTML-like patterns (<script, on\\w+=, javascript:) as a friendly, "
            "defense-in-depth nudge that complements (but does not replace) Layer 1.",
        ),
        (
            "Layer 3 \u2014 Render-time sanitization (src/lib/markdown.ts): ",
            "the one field that is ever converted to real HTML \u2014 the blog post Markdown "
            "body \u2014 is parsed with marked (raw HTML tags for <script>/<style>/<iframe>/etc. "
            "are neutralized before parsing) and then passed through DOMPurify with a strict "
            "allow-list of tags/attributes before being handed to React's "
            "dangerouslySetInnerHTML. Every other field is rendered as plain React text "
            "children, which React escapes automatically \u2014 it is structurally impossible for "
            "those fields to execute as HTML/JS.",
        ),
        (
            "Layer 4 \u2014 CI content validation (scripts/validate-content.mjs): ",
            "the \u201cPR Build Check\u201d GitHub Action re-parses every JSON/Markdown file in "
            "/content on every Pull Request (including the ones Decap opens automatically) "
            "and fails the check if any field matches the same dangerous-content pattern, or "
            "if required fields / shapes are missing. This is the backstop that runs even if "
            "someone edits a file by hand outside of Decap entirely.",
        ),
    ]
)
add_image(os.path.join(SCREENS, "07-admin-validation-error.png"), width_in=6.3,
          caption="Figure 5 \u2014 Layer 1 in action: Decap blocks publishing a field containing a <script> tag and explains why, inline.")

# =======================================================================
# 6. ACCESS CONTROL
# =======================================================================
add_heading("6. Access Control: Only Repository Collaborators", 1)
add_para(
    "Decap's github backend is used specifically because access control is delegated "
    "entirely to GitHub itself rather than re-implemented: a user must (a) successfully "
    "complete GitHub's OAuth login flow, and (b) have at least write/collaborator access on "
    "the repository before Decap will let them open the editor or write a branch/PR. There "
    "is no separate username/password list for the CMS to leak or misconfigure."
)
add_para(
    "Because a GitHub OAuth client secret can never be shipped to a static site's "
    "JavaScript bundle, a very small stateless hand-off service is required "
    "(/oauth-provider) to perform the \u201ccode \u2192 token\u201d exchange server-side. This service:"
)
add_bullets(
    [
        "Holds no database and persists no tokens \u2014 it relays GitHub's token to the browser over a one-time postMessage handshake, exactly matching Decap's documented protocol.",
        "Runs in production as an Azure Function App (slowoauthfn, East US 2, Node.js 20, Functions programming model v4) exposing GET /auth, GET /callback and GET /healthz with no route prefix. The handlers (oauth-provider/azure/handlers.js) are thin adapters over a framework-agnostic core (oauth-provider/lib/github-oauth.js) and are covered by unit tests (npm test) that run in the deploy workflow before every release.",
        "The same core is also wired to an Express server (server.js + Dockerfile) and to Vercel functions (api/), so the service can be re-hosted without touching the OAuth logic.",
        "Uses a short-lived (5 minute), single-use, random state value carried in an HttpOnly/Secure/SameSite=Lax cookie on every login attempt to mitigate CSRF.",
        "Is deployed automatically by .github/workflows/deploy-oauth-provider-azure.yml, which supports either a publish-profile secret or a secret-less OpenID Connect (federated credential) login to Azure, and finishes with a live smoke test of /healthz and /auth. GitHub OAuth App credentials are never stored in the repository; they are Function App application settings.",
    ]
)
add_para(
    "Local development intentionally bypasses all of this: Decap's local_backend: true "
    "flag, combined with running npm run dev:cms, starts the decap-server file-system "
    "proxy (localhost:8081) and lets anyone with access to the dev machine edit content "
    "without any login \u2014 appropriate for a trusted local/dev environment, never exposed to "
    "the public internet."
)

# =======================================================================
# 7. EDITORIAL WORKFLOW / PR PIPELINE
# =======================================================================
add_heading("7. Editorial Workflow: Feature Branches & Pull Requests", 1)
add_para(
    "publish_mode: editorial_workflow is enabled in config.yml. This is a built-in Decap "
    "feature \u2014 no custom branch/PR automation was written. When the owner saves a change:"
)
add_bullets(
    [
        "Decap commits the change to a new branch named cms/<collection>/<slug>, never to main directly.",
        "Decap opens a GitHub Pull Request from that branch into main on the owner's behalf.",
        "The entry's status (Draft \u2192 In Review \u2192 Ready) is tracked inside the CMS's own \u201cEditorial Workflow\u201d board, giving the owner a kanban-style view of everything awaiting review.",
        "A human reviewer (e.g., the site's engineering contact) reviews the PR diff on GitHub \u2014 or the owner's own teammate \u2014 and approves/merges it like any other code change.",
    ]
)
add_image(os.path.join(SCREENS, "09-editorial-workflow-board.png"), width_in=6.3,
          caption="Figure 6 \u2014 The CMS's built-in \u201cEditorial Workflow\u201d board, showing a Blog Post entry moved to \u201cIn Review.\u201d This corresponds 1:1 to an open GitHub Pull Request.")
add_image(os.path.join(SCREENS, "10-entry-status-draft-publish.png"), width_in=6.3,
          caption="Figure 7 \u2014 Per-entry status control inside the editor: Draft / In review / Ready, with a \u201cPublish\u201d action that opens or updates the Pull Request.")
add_para(
    "An additional GitHub Action, pr-build-check.yml, runs on every Pull Request (including "
    "Decap's automatic ones) and fails the check if the content doesn't parse, is missing "
    "required fields, contains disallowed script-like content, or breaks the production "
    "build (npm run build). This gives a human reviewer a simple green/red signal before "
    "approving, on top of manually reading the diff."
)

# =======================================================================
# 8. CI/CD: BUILD & DEPLOY ON MERGE
# =======================================================================
add_heading("8. CI/CD: Automatic Build & Deploy on Merge to main", 1)
add_para(
    ".github/workflows/deploy.yml triggers on every push to main (i.e., immediately after "
    "a content PR \u2014 or any other PR \u2014 is merged). It installs dependencies, type-checks, "
    "runs npm run build, and publishes the resulting dist/ folder to GitHub Pages via the "
    "official actions/upload-pages-artifact and actions/deploy-pages actions. No manual "
    "deploy step is required; the owner's approved content is live within the time it "
    "takes the Action to run (typically well under two minutes for this project)."
)
add_table(
    ["Workflow", "Trigger", "Purpose"],
    [
        ("pr-build-check.yml", "pull_request \u2192 main", "Validates content + type-checks + builds, surfacing failures to reviewers before merge."),
        ("deploy.yml", "push \u2192 main (i.e., after merge)", "Rebuilds the production bundle and deploys it to GitHub Pages."),
    ],
    col_widths=[1.8, 1.8, 3.0],
)
add_table(
    ["Workflow", "Trigger", "Purpose"],
    [
        ("deploy-oauth-provider-azure.yml", "push \u2192 main touching oauth-provider/** or site.config.json; manual", "Tests, deploys the OAuth service to Azure Functions, smoke-tests the live endpoints."),
    ],
    col_widths=[1.8, 1.8, 3.0],
)
add_para(
    "Hosting note: the site is published as a GitHub Pages project site, so the build uses "
    "the /SlowDoughPizzaSite/ base path from site.config.json (local dev keeps \"/\"). "
    "Content edits never redeploy the OAuth service and vice-versa: each workflow has path "
    "filters for its own inputs. If the site moves to a custom domain or another static "
    "host, only site.config.json and the final \u201cdeploy\u201d job need to change \u2014 the "
    "build and validation steps are host-agnostic."
)

# =======================================================================
# 9. STYLING THE ADMIN UI
# =======================================================================
add_heading("9. Styling the Admin UI to Match the Brand", 1)
add_para(
    "Decap CMS officially supports theming two areas of the editor: (1) the live preview "
    "pane per collection, via registerPreviewTemplate / registerPreviewStyle, and (2) "
    "top-level branding like the logo shown on the login screen, via the logo_url config "
    "key. Both are used extensively here \u2014 every collection has a bespoke preview "
    "component (src/admin/previews.tsx) built from the same color palette, font stack "
    "(Georgia serif headings, system-ui body text), and spacing used on the live site, so "
    "what the owner sees while editing closely matches what visitors will see."
)
add_para(
    "The outer editor chrome (the collection list sidebar, the top toolbar, the login "
    "button itself) is intentionally left in Decap's own default styling. Decap does not "
    "currently expose an official, stable theming API for that chrome beyond the logo, and "
    "hand-overriding its internal, hashed CSS class names would be brittle across version "
    "upgrades. This trade-off is called out explicitly in Section 10 (Open Questions) as a "
    "candidate for future investment if deeper admin-wide theming becomes a priority."
)

# =======================================================================
# 10. OPEN QUESTIONS / FUTURE WORK
# =======================================================================
add_heading("10. Open Questions & Future Work", 1)
add_bullets(
    [
        (
            "One-time manual setup still required (documented in docs/INTEGRATION-GUIDE.md): ",
            "registering the GitHub OAuth App (callback URL = the Azure host + /callback), "
            "adding OAUTH_GITHUB_CLIENT_ID / OAUTH_GITHUB_CLIENT_SECRET as Function App "
            "application settings, adding the Azure publish-profile (or OIDC) secrets to the "
            "GitHub repository, and switching GitHub Pages to the \u201cGitHub Actions\u201d "
            "source. None of these can be committed to the repo because they are secrets or "
            "account-level settings.",
        ),
        (
            "Azure authentication method for deployments: ",
            "the deploy workflow accepts either a publish profile (simplest) or OpenID "
            "Connect. Publish profiles depend on SCM basic-auth publishing, which Azure is "
            "gradually disabling by default on new apps; OIDC is the recommended long-term "
            "choice and the guide documents both.",
        ),
        (
            "Custom domain: ",
            "the demo runs under the GitHub Pages project path /SlowDoughPizzaSite/. Moving "
            "to a custom domain is a two-value change in site.config.json (site.url, "
            "site.basePath = \"/\") plus updating the GitHub OAuth App's homepage URL.",
        ),
        (
            "Media/image uploads: ",
            "the CMS config already points an \u201cimage\u201d media library at "
            "public/images/uploads, but no collection currently has an image field (the "
            "site uses hand-drawn inline SVG illustrations, not uploaded photos). If the "
            "owner later wants to upload real food photography, adding an optional image "
            "field to the Blog/Menu collections is straightforward.",
        ),
        (
            "Deeper admin-chrome theming: ",
            "see Section 9 \u2014 full rebranding of Decap's outer shell (beyond the logo and "
            "preview pane) is possible but was judged not worth the brittleness/maintenance "
            "trade-off for this iteration.",
        ),
        (
            "Multi-environment preview: ",
            "there is currently no automatic \u201cpreview deployment\u201d per Pull Request (e.g. a "
            "Vercel/Netlify preview URL). Reviewers rely on the CMS's own in-editor live "
            "preview plus reading the JSON/Markdown diff. Adding a PR preview deployment is "
            "a natural follow-up if richer visual review is desired.",
        ),
        (
            "Notifications: ",
            "no Slack/email notification is wired up for \u201cnew content PR opened\u201d or "
            "\u201cdeploy succeeded.\u201d GitHub's own PR/merge notifications are relied on today; a "
            "dedicated notification could be added to either GitHub Action if desired.",
        ),
    ]
)

# =======================================================================
# 11. FILE MANIFEST
# =======================================================================
add_heading("11. Appendix: File Manifest", 1)
add_table(
    ["Path", "Purpose"],
    [
        ("content/*.json, content/blog/*.md", "Owner-editable content, source of truth for the live site."),
        ("src/data/contentLoader.ts", "Build-time loader that turns /content into typed data for React components."),
        ("src/lib/markdown.ts", "Safe Markdown\u2192HTML rendering (marked + DOMPurify) for blog bodies."),
        ("admin/index.html, src/admin/main.tsx", "Vite entry point that bundles Decap CMS for /admin."),
        ("src/admin/previews.tsx, previewStyles.ts", "Brand-matched live preview components per collection."),
        ("site.config.json", "Single source of truth for repo slug, Pages URL/base path, Azure OAuth host + Function App name."),
        ("admin/config.template.yml", "Decap CMS configuration template (backends, collections, fields, validation patterns); rendered by vite.config.ts into /admin/config.yml."),
        ("scripts/validate-site-config.mjs", "CI check that site.config.json is complete and internally consistent."),
        ("public/admin/slow-dough-admin-logo.svg", "Custom login-screen logo."),
        ("oauth-provider/", "Standalone GitHub OAuth hand-off service: Azure Functions v4 (production) + Express and Vercel variants, with unit tests."),
        (".github/workflows/deploy-oauth-provider-azure.yml", "CD: tests and deploys the OAuth service to the Azure Function App, then smoke-tests it."),
        (".github/workflows/pr-build-check.yml", "CI: validates content + type-checks + builds on every PR."),
        (".github/workflows/deploy.yml", "CD: builds and deploys to GitHub Pages on every push to main."),
        ("scripts/validate-content.mjs", "Standalone Node script used by CI to validate all content files."),
        ("docs/", "This Technical Design Document, the manager's PDF guide, the integration/deployment runbook (INTEGRATION-GUIDE.md), and the flow diagram source."),
    ],
    col_widths=[2.6, 4.0],
)

doc.add_page_break()
add_heading("Document Control", 1)
add_para("Author: Engineering (AI-assisted implementation)")
add_para("Status: Implemented and wired to the demo environment (GitHub Pages + Azure Functions). Remaining one-time manual steps are listed in Section 10 and detailed in docs/INTEGRATION-GUIDE.md.")

out_path = os.path.join(HERE, "technical-design-document.docx")
doc.save(out_path)
print("Saved:", out_path)
