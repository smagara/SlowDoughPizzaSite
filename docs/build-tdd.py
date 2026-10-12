#!/usr/bin/env python3
"""Builds docs/Slow-Dough-Decap-CMS-Technical-Design.docx with python-docx."""
from docx import Document
from docx.shared import Pt, Inches, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'Slow-Dough-Decap-CMS-Technical-Design.docx')
INK = RGBColor(0x24, 0x21, 0x1e); ACC = RGBColor(0xc8, 0x5a, 0x32); MUTED = RGBColor(0x7d, 0x71, 0x65)

doc = Document()
sec = doc.sections[0]
sec.page_width = Inches(8.5); sec.page_height = Inches(11)
sec.left_margin = sec.right_margin = Inches(1); sec.top_margin = sec.bottom_margin = Inches(0.9)

styles = doc.styles
styles['Normal'].font.name = 'Calibri'; styles['Normal'].font.size = Pt(10.5)
styles['Normal'].element.rPr.rFonts.set(qn('w:eastAsia'), 'Calibri')
for lvl, size in ((1, 18), (2, 14), (3, 12)):
    st = styles[f'Heading {lvl}']; st.font.name = 'Georgia'; st.font.size = Pt(size); st.font.bold = True; st.font.color.rgb = INK
    st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Georgia')
    rf = st.element.rPr.rFonts; rf.set(qn('w:ascii'), 'Georgia'); rf.set(qn('w:hAnsi'), 'Georgia')
styles['Title'].font.name = 'Georgia'; styles['Title'].font.size = Pt(26); styles['Title'].font.color.rgb = INK

def shade(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr(); shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), hex_fill); tcPr.append(shd)

def set_cell_text(cell, text, bold=False, size=9.5, color=None, mono=False):
    cell.text = ''
    p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(1)
    lines = text.split('\n')
    for i, line in enumerate(lines):
        r = p.add_run(line); r.bold = bold; r.font.size = Pt(size)
        if color: r.font.color.rgb = color
        if mono: r.font.name = 'Consolas'; r._element.rPr.rFonts.set(qn('w:eastAsia'), 'Consolas')
        if i < len(lines) - 1: r.add_break()

def table(headers, rows, widths=None, mono_cols=(), size=9.5):
    t = doc.add_table(rows=1, cols=len(headers)); t.style = 'Table Grid'; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]; set_cell_text(c, h, bold=True, size=size, color=RGBColor(0x8a, 0x42, 0x24)); shade(c, 'F0E7DC')
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            set_cell_text(cells[i], str(v), size=size, mono=(i in mono_cols))
    if widths:
        t.autofit = False
        tblPr = t._tbl.tblPr
        layout = OxmlElement('w:tblLayout'); layout.set(qn('w:type'), 'fixed'); tblPr.append(layout)
        for i, w in enumerate(widths):
            t.columns[i].width = Inches(w)
        for row in t.rows:
            for i, w in enumerate(widths): row.cells[i].width = Inches(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t

def h(text, lvl=1): return doc.add_heading(text, level=lvl)
def p(text='', bold=False, italic=False, size=None, color=None, after=6, align=None):
    para = doc.add_paragraph(); para.paragraph_format.space_after = Pt(after)
    if align: para.alignment = align
    if text:
        r = para.add_run(text); r.bold = bold; r.italic = italic
        if size: r.font.size = Pt(size)
        if color: r.font.color.rgb = color
    return para
def rich(parts, after=6):
    """parts: list of (text, style) where style in {'', 'b', 'i', 'code'}"""
    para = doc.add_paragraph(); para.paragraph_format.space_after = Pt(after)
    for text, st in parts:
        r = para.add_run(text)
        if 'b' in st: r.bold = True
        if 'i' in st: r.italic = True
        if 'code' in st:
            r.font.name = 'Consolas'; r._element.rPr.rFonts.set(qn('w:eastAsia'), 'Consolas'); r.font.size = Pt(9.5)
    return para
def bullets(items, style='List Bullet'):
    for it in items:
        para = doc.add_paragraph(style=style); para.paragraph_format.space_after = Pt(2)
        if isinstance(it, (list, tuple)):
            for text, st in it:
                r = para.add_run(text)
                if 'b' in st: r.bold = True
                if 'i' in st: r.italic = True
                if 'code' in st: r.font.name = 'Consolas'; r.font.size = Pt(9.5)
        else:
            para.add_run(it)
def code(text, size=8.5):
    t = doc.add_table(rows=1, cols=1); t.style = 'Table Grid'; c = t.rows[0].cells[0]; shade(c, 'F7F2EA')
    set_cell_text(c, text, size=size, mono=True)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
def figure(path, caption, width=6.3):
    doc.add_picture(os.path.join(HERE, path), width=Inches(width))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap = p(caption, italic=True, size=9, color=MUTED, after=10, align=WD_ALIGN_PARAGRAPH.CENTER)
def fit_height(path, max_h, max_w=6.3):
    from PIL import Image
    w, hh = Image.open(os.path.join(HERE, path)).size
    ratio = hh / w
    width = min(max_w, max_h / ratio)
    return width

# ============================================================================ COVER
today = datetime.date(2026, 10, 11).strftime('%B %d, %Y')
p('Slow Dough Pizza Co.', size=12, color=ACC, bold=True, after=0)
doc.add_paragraph('Decap CMS Integration — Technical Design Document', style='Title')
p('Self-service content management for the daily menu, blog posts, dough announcement and opening hours, with GitHub-based review and automated deployment.', size=12, color=MUTED, after=18)
table(['Field', 'Value'], [
    ['Document', 'Technical Design Document (TDD)'],
    ['Version', '1.0 — Proposed / implemented'],
    ['Date', today],
    ['System', 'slow-dough-pizza website (React 19 · Vite 8 · Tailwind 4) + Decap CMS 3.8.4'],
    ['Audience', 'Developers maintaining the site; technical reviewers; the site owner for sections 1–3'],
    ['Companion documents', 'README.md (developer setup) · oauth/README.md · docs/Slow-Dough-Content-Manager-Guide.pdf (end-user guide)'],
], widths=[1.6, 4.9])

h('Contents', 1)
for line in [
    '1. Executive summary', '2. Goals, non-goals and requirements traceability', '3. Baseline and constraints',
    '4. Solution architecture', '5. Content model', '6. The /admin editing experience', '7. Authentication and authorisation',
    '8. Editorial workflow and pull requests', '9. Continuous integration and deployment', '10. Input validation and XSS defence in depth',
    '11. Local edit mode for developers', '12. Build-time content pipeline', '13. Design decisions (with alternatives considered)',
    '14. Security considerations and residual risks', '15. Operations runbook', '16. Verification performed', '17. Open questions',
    'Appendix A — File inventory', 'Appendix B — Decap configuration reference', 'Appendix C — Glossary']:
    p(line, after=0, size=9.5)
doc.add_page_break()

# ============================================================================ 1
h('1. Executive summary', 1)
p('The Slow Dough website was a hand-coded React single-page application whose menu, blog posts, store hours and the “Today’s Dough” announcement banner lived inside a TypeScript file. Every change required a developer. This design moves that content into plain files under content/ and adds Decap CMS — an open-source, Git-based content manager — at the hidden URL /admin, so the owner can make routine updates through a web form that looks and feels like the site.')
p('Every save in the CMS becomes a commit on a feature branch (cms/<collection>/<slug>) and a pull request against main; nothing is ever written to main directly. A GitHub Action validates the content on each pull request, a reviewer approves and merges, and a second Action builds the site with Vite and deploys it to GitHub Pages automatically. Access to /admin requires signing in with GitHub through a small OAuth handler that only hands a token to accounts that are collaborators with write access to the repository. Free text typed by the editor is validated in the browser, re-validated in CI and rendered through React without ever injecting HTML, so script characters are displayed literally rather than executed.')
rich([('Outcome: ', 'b'), ('the owner can change prices, mark a pizza as sold out, post an essay or switch the announcement banner in a few minutes with no developer involvement, while the repository stays the single source of truth with a reviewable history of every change.', '')])
figure('diagrams/fig1-content-flow.png', 'Figure 1 — End-to-end content update flow.', width=fit_height('diagrams/fig1-content-flow.png', 7.6))

# ============================================================================ 2
h('2. Goals, non-goals and requirements traceability', 1)
h('2.1 Goals', 2)
bullets([
    'Let a non-technical owner update the daily menu, blog posts, the dough announcement and opening hours from a browser.',
    'Keep Git/GitHub as the single source of truth with every change reviewable as a pull request.',
    'Deploy automatically on merge to main; no servers to operate for the site itself.',
    'Restrict editing to GitHub collaborators of the repository; keep the admin URL out of navigation and search engines.',
    'Treat all CMS input as untrusted: validate it, and render it safely.',
    'Give developers an offline “local edit mode” to test the CMS without touching GitHub.',
])
h('2.2 Non-goals', 2)
bullets([
    'Image/media management (no image fields exist on the site today; see Open questions).',
    'Per-pull-request preview deployments of the site.',
    'Multi-language content, scheduling of posts, or user roles beyond “can edit” / “can approve”.',
    'Replacing GitHub Pages with another host (the design is portable, but not configured for it).',
])
h('2.3 Requirements traceability', 2)
table(['#', 'Requirement (from the brief)', 'How it is met', 'Where'], [
    ['R1', 'Integrate Decap CMS so the owner can self-serve the Daily Menu, Blog posts and Dough announcement', 'Four collections: Daily Menu (folder), Blog Posts (folder), Site Settings → Dough Announcement and Hours (files). Content moved out of TypeScript into content/.', 'public/admin/config.yml, content/'],
    ['R2', 'Local edit mode for dev testing', 'npm run dev:cms starts Vite + decap-server; on localhost Decap auto-detects the proxy and writes straight to content/ (no login). npm run dev:cms:git simulates the branch workflow locally.', 'tools/dev-with-cms.mjs, §11'],
    ['R3', 'Production integration with GitHub', 'Decap github backend with editorial workflow, squash merges and custom commit messages; OAuth handler for sign-in.', 'config.yml backend:, oauth/'],
    ['R4', 'Hidden link /admin showing editable fields in a web form styled for the site', 'public/admin/index.html served at /admin (+ dev/preview rewrite); discreet “· Staff” footer link with rel=nofollow; robots.txt + noindex; admin.css skins Decap in the site palette; cms.js preview templates mimic the live components.', '§6, public/admin/'],
    ['R5', 'Only GitHub repository collaborators allowed', 'OAuth handler refuses to release a token unless GET /repos/{repo} reports permissions.push (write); Decap repeats the check; GitHub enforces permissions on every API call; branch protection governs merging.', '§7, oauth/handler.mjs'],
    ['R6', 'Reasonable validation of free text incl. script characters', 'Three layers: Decap field patterns + preSave guard; CI validator (tools/content-loader.mjs) as a required check; React auto-escaping + SafeMarkdown renderer (no innerHTML, link-scheme allow-list).', '§10'],
    ['R7', 'A successful update triggers a PR on a feature branch (not main)', 'publish_mode: editorial_workflow → commits on cms/<collection>/<slug> and a PR labelled decap-cms/<status>. Branch protection blocks direct pushes to main.', '§8'],
    ['R8', 'On approval and merge to main a GitHub Action builds and deploys', '.github/workflows/deploy.yml runs on push to main: validate → lint → test → vite build → deploy to GitHub Pages.', '§9'],
    ['R9', 'Technical design document with flow diagram', 'This document (Figures 1–5).', 'docs/'],
    ['R10', 'Manager instruction PDF with screenshots', 'docs/Slow-Dough-Content-Manager-Guide.pdf (2 pages).', 'docs/'],
], widths=[0.35, 1.9, 3.2, 1.05], size=8.5)

# ============================================================================ 3
h('3. Baseline and constraints', 1)
p('The starting point is a Vite + React 19 + Tailwind CSS 4 single-page site (five sections: hero, craft, menu, journal, hours) with all content in src/data/pizzaShopData.ts. It has no router, no backend and no build server; it can be hosted as static files.')
table(['Constraint', 'Implication for the design'], [
    ['Static hosting on GitHub Pages (no server-side code)', 'The CMS must be a static bundle talking to the GitHub API from the browser. The only server-side component is the OAuth token exchange, which is kept tiny and stateless so it can run on a free Cloudflare Worker (or any Node host).'],
    ['Content lived in TypeScript', 'Decap edits files it can parse (YAML/Markdown/JSON). Content is migrated to YAML (structured data) and Markdown with front matter (blog posts). A build-time loader turns the files back into typed data for React.'],
    ['Project site URL has a base path (https://<owner>.github.io/SlowDough/)', 'Vite base is injected by the deploy workflow; the admin page only uses relative URLs; the footer link uses import.meta.env.BASE_URL.'],
    ['Repository layout', 'All paths in this design assume the SlowDough folder is the repository root (where package.json and .github/ live). If the site is kept in a sub-folder, the workflows and Decap folder paths must be prefixed accordingly (see Open questions).'],
    ['Editor is non-technical', 'No Markdown knowledge required for menu/announcement; blog posts use Decap’s rich-text toolbar restricted to headings, bold/italic, quotes, lists and links. Previews are styled like the site.'],
    ['Security scope', 'A compromised editor account can only open pull requests; it cannot publish without review (if branch protection is enabled) and cannot inject executable content into the site.'],
], widths=[2.2, 4.3], size=9)

# ============================================================================ 4
h('4. Solution architecture', 1)
figure('diagrams/fig2-architecture.png', 'Figure 2 — System architecture and trust boundaries.', width=6.3)
table(['Component', 'Technology', 'Responsibility'], [
    ['Public site', 'React 19, Vite 8, Tailwind 4, deployed to GitHub Pages as static files', 'Renders content that was validated and inlined at build time. No runtime calls to GitHub.'],
    ['/admin', 'Decap CMS 3.8.4 (decap-cms npm package, copied into dist/admin/ at build time) + config.yml, cms.js, admin.css, preview.css', 'Editing UI, live previews, client-side validation, Git operations via the GitHub API using the signed-in user’s token.'],
    ['OAuth handler', 'oauth/handler.mjs — dependency-free, web-standard Request/Response; deployable as a Cloudflare Worker (worker.mjs) or Node server (server.mjs)', 'Completes the GitHub OAuth web flow with the client secret, verifies CSRF state, checks repository write permission and posts the token to the admin window.'],
    ['Content store', 'content/**/*.yml, content/blog/*.md in the Git repository', 'Single source of truth; reviewable diffs; history.'],
    ['Content loader', 'tools/content-loader.mjs (ESM JavaScript, js-yaml)', 'Parses and validates content; used by the Vite plugin and by CI.'],
    ['Vite plugins', 'tools/vite-plugin-site-content.mjs, tools/vite-plugin-decap-admin.mjs', 'virtual:site-content module with hot reload; /admin rewrite; bundling the pinned Decap build.'],
    ['CI/CD', 'GitHub Actions: pr-checks.yml, deploy.yml; .github/rulesets/main-branch-protection.json', 'Required checks on PRs; build & deploy on merge; branch protection for main.'],
], widths=[1.2, 2.4, 2.9], size=9)

# ============================================================================ 5
h('5. Content model', 1)
p('Content was migrated from src/data/pizzaShopData.ts with a one-off script so that no text was retyped. Each collection maps to files Decap can edit natively. Item IDs (used for DOM ids and React keys) are derived from names at build time so editors never see them.')
h('5.1 Files', 2)
table(['File(s)', 'Decap collection', 'Format', 'Notes'], [
    ['content/settings/announcement.yml', 'Site Settings → Dough Announcement', 'YAML (single file)', 'enabled, headline, detail, style (standard | alert)'],
    ['content/settings/hours.yml', 'Site Settings → Hours & Schedule', 'YAML (single file)', 'summary (header badge) + days[] {day, hours, statusNote, isClosed}'],
    ['content/menu/<category>.yml', 'Daily Menu (folder collection, one entry per category)', 'YAML', 'title, subtitle, order, items[] {name, italianName, description, price, available, tags[]}'],
    ['content/blog/<yyyy-mm-dd>-<slug>.md', 'Blog Posts (folder collection)', 'Markdown + YAML front matter', 'title, subtitle, author, authorRole, date, readTime, artType (dough | oven), excerpt, keyTakeaways[], body'],
], widths=[1.9, 1.7, 1.1, 1.8], size=8.5)
h('5.2 Field rules (enforced in the browser and in CI)', 2)
table(['Field', 'Type', 'Rule'], [
    ['headline / title / name / day / hours / summary', 'string', 'Required, plain text, no HTML-like tags, 1–60/120/160 chars depending on field'],
    ['detail / subtitle / statusNote / italianName / authorRole', 'string', 'Optional, plain text, length-limited'],
    ['description / excerpt', 'text', 'Required, ≤ 800 chars, no HTML tags, no javascript:/vbscript: URLs'],
    ['price', 'number', '0–500, at most 2 decimals'],
    ['available / enabled / isClosed', 'boolean', 'Defaults: true / true / false'],
    ['order', 'integer', '1–99 (categories sorted ascending)'],
    ['tags[]', 'list of string', '≤ 6 tags, ≤ 40 chars each, letters/numbers/spaces and . & / ’ -'],
    ['date', 'YYYY-MM-DD', 'Valid calendar date; stored as a string (YAML JSON schema) so time zones never shift it'],
    ['artType / style', 'select', 'Allow-listed values only'],
    ['body (blog)', 'markdown', '≤ 50 000 chars; no HTML tags; no javascript:/vbscript:; no data: link targets; rendered by SafeMarkdown'],
    ['file names', 'slug', '^[a-z0-9]+(-[a-z0-9]+)*$ (Decap slug settings + CI check)'],
], widths=[2.2, 0.9, 3.4], size=8.5)
h('5.3 Example — menu category', 2)
code('''title: Neapolitan Pizzas (Pizze Napoletane)
subtitle: Strict Neapolitan discipline: hand-crushed San Marzano D.O.P. tomatoes …
order: 1
items:
  - name: Margherita Verace D.O.P.
    italianName: Pizza Margherita Tradizionale
    description: Crushed San Marzano D.O.P. tomatoes, fresh fior di latte …
    price: 19
    available: true
    tags: [Neapolitan Classic, Vegetarian]''')
h('5.4 Example — blog post', 2)
code('''---
title: 'The Architecture of Time: Why We Age Our Dough for 72 Hours'
author: Marco Bellini
authorRole: Head Baker & Pizzaiolo
date: '2026-09-14'
artType: dough
excerpt: Long cold fermentation is not a marketing hook …
keyTakeaways:
  - Protease enzymes predigest complex gluten proteins over 72 hours …
---

## The Rush of Modern Commercial Dough

In modern commercial pizza shops, dough is treated as an inconvenience …

> Speed is the enemy of flavor and digestibility.''')

# ============================================================================ 6
h('6. The /admin editing experience', 1)
h('6.1 Serving the page', 2)
bullets([
    [('public/admin/index.html', 'code'), (' is copied verbatim by Vite into dist/admin/. GitHub Pages serves it for /admin/ (and redirects /admin → /admin/).', '')],
    [('tools/vite-plugin-decap-admin.mjs', 'code'), (' rewrites /admin and /admin/ to /admin/index.html in the Vite dev and preview servers (Vite’s static middleware does not serve directory indexes), serves the Decap bundle from node_modules in dev, and emits it as dist/admin/decap-cms.js in builds.', '')],
    [('Hidden link: ', 'b'), ('the footer contains a low-contrast “· Staff” link (', ''), ('id="staff-admin-link"', 'code'), (', rel="nofollow") pointing at BASE_URL + "admin/". The page carries <meta name="robots" content="noindex, nofollow"> and robots.txt disallows /admin/. This is discoverability hygiene only; access control is the GitHub login.', '')],
])
h('6.2 Styling for the site', 2)
p('Decap styles itself with Emotion at runtime. admin.css targets the stable component labels embedded in Emotion class names ([class*="-AppHeader"], [class*="-FieldLabel"], …) and applies the site palette (cream #faf8f5, ink #24211e, terracotta #c85a32, Georgia headings). The Decap logo is replaced by a Slow Dough SVG wordmark; the unused Media tab is hidden; toggles and buttons use the accent colour.')
p('Preview templates registered in cms.js render each collection with the same layout, typography and badges as the live components (menu cards with price and “Sold Out Today”, the announcement strip, the hours table, blog header with key takeaways). preview.css is injected into Decap’s preview iframe. The previews are deliberately implemented in plain JavaScript with Decap’s createClass/h helpers rather than by importing the site’s React components: Decap bundles its own React 18 while the site uses React 19, and mixing element types across React versions is unsupported.')
figure('screenshots/03-edit-menu.png', 'Figure 6 — Editing a menu category: controls on the left, site-styled preview on the right (price changed to $21, “Marinara Antica” marked sold out).', width=6.3)
figure('screenshots/02-home.png', 'Figure 7 — Collections home with the site skin applied.', width=fit_height('screenshots/02-home.png', 3.0))

# ============================================================================ 7
h('7. Authentication and authorisation', 1)
p('Decap’s GitHub backend needs an OAuth access token for the signed-in user. GitHub’s OAuth web flow requires a client secret to exchange the temporary code for a token, and that secret cannot live in a static site, so a minimal server-side handler is required. Netlify historically provided this service; since the site is hosted on GitHub Pages, the project ships its own.')
figure('diagrams/fig3-auth-flow.png', 'Figure 3 — Sign-in flow.', width=fit_height('diagrams/fig3-auth-flow.png', 6.2))
h('7.1 Who can get in', 2)
bullets([
    [('Authentication', 'b'), (' is delegated entirely to GitHub (including 2FA/SSO policies).', '')],
    [('Authorisation', 'b'), (' = “collaborator with write access on the repository”. The handler calls GET /repos/{owner}/{repo} with the new token and only releases the token if permissions.push is true; otherwise it discards the token and shows a clear message (verified in a browser test: “GitHub account "marco" is not a collaborator with write access …”). Decap performs the same check again on load (hasWriteAccess), and GitHub itself rejects any write by a non-collaborator, so the guarantee does not depend on the handler alone.', '')],
    [('Approval rights', 'b'), (' are a separate, stronger privilege controlled by branch protection: a PR to main needs one approving review from someone other than its author and a passing “Validate & build” check. The owner can therefore edit, while a trusted reviewer (or the owner with a second account, see Open questions) publishes.', '')],
])
h('7.2 Hardening in the handler', 2)
bullets([
    'Random 24-byte state stored in an HttpOnly, Secure, SameSite=Lax cookie (10-minute TTL) and compared in constant time on /callback — prevents login CSRF.',
    'Scope is clamped to repo or public_repo regardless of what the query string asks for; allow_signup=false.',
    'The token is posted with window.postMessage only to origins listed in ALLOWED_ORIGINS; messages from other origins are ignored. Decap, in turn, only accepts messages whose origin equals backend.base_url.',
    'Responses carry Cache-Control: no-store, X-Frame-Options: DENY, a strict Content-Security-Policy and nosniff; the token is embedded as JSON with < escaped.',
    'Missing configuration yields a generic 500; GitHub errors are surfaced without the secret; only GET/HEAD are accepted.',
    'No persistent storage, no logging of tokens; the client secret is read from environment/secret bindings only.',
])

# ============================================================================ 8
h('8. Editorial workflow and pull requests', 1)
p('config.yml sets publish_mode: editorial_workflow. With the GitHub backend this means:')
table(['Editor action in /admin', 'What happens in GitHub'], [
    ['Save (new or existing entry)', 'Commit on branch cms/<collection>/<slug> (created from main). A pull request is opened against main with label decap-cms/draft. Commit message: content: add|update <collection> "<slug>". Further saves push more commits to the same branch.'],
    ['Status → In review / Ready', 'PR label changes to decap-cms/pending_review / decap-cms/pending_publish.'],
    ['Reviewer approves & merges on GitHub', 'Squash merge into main (squash_merges: true keeps one commit per change). Decap notices the closed PR and removes the entry from the Workflow board.'],
    ['Publish → Publish now in /admin', 'Decap asks GitHub to merge the PR. If branch protection is active this only succeeds when the PR already has the required approval and green check — otherwise GitHub returns an error and nothing is merged.'],
    ['Delete unpublished entry', 'Branch deleted, PR closed.'],
], widths=[2.0, 4.5], size=9)
p('Direct pushes to main are not possible for editors because the imported ruleset (.github/rulesets/main-branch-protection.json) requires a pull request, one approval, the “Validate & build” status check, and blocks deletions and force pushes. The deploy workflow is therefore only ever triggered by a reviewed merge.')
p('Behaviour verified locally with decap-server in git mode: saving created branch cms/blog/2026-10-11-autumn-squash-sage-a-seasonal-special with commit “content: add Blog Post …”, the status transitions set decap-cms/pending_review and decap-cms/pending_publish, and Publish merged the branch into main and deleted it (§16).')

# ============================================================================ 9
h('9. Continuous integration and deployment', 1)
table(['Workflow', 'Trigger', 'Steps', 'Outcome'], [
    ['pr-checks.yml — “Validate & build”', 'pull_request → main (includes cms/* branches)', 'npm ci → validate:content → lint (tsc) → test → vite build; writes a job summary listing changed content files; comments on cms/* PRs when green', 'Required status check; blocks merge on failure'],
    ['deploy.yml — “Deploy to GitHub Pages”', 'push → main, manual dispatch', 'Same checks → resolves Vite base path → vite build (VITE_BASE_PATH) → optional CNAME → upload-pages-artifact → deploy-pages', 'Live site updated ~1–2 min after merge'],
], widths=[1.6, 1.4, 2.4, 1.1], size=8.5)
bullets([
    [('Base path: ', 'b'), ('project sites are served from /<repo>/; the workflow derives it from the repository name. Repository variables SITE_BASE_PATH or SITE_CUSTOM_DOMAIN override this (custom domains get base “/” and a CNAME file).', '')],
    [('Concurrency: ', 'b'), ('deployments are serialised (group pages, no cancellation); PR checks cancel superseded runs.', '')],
    [('Permissions: ', 'b'), ('least privilege — contents: read for builds, pages: write + id-token: write only in the deploy job, pull-requests: write only for the PR comment.', '')],
    [('One-time settings: ', 'b'), ('Pages source = GitHub Actions; import the ruleset; (optional) CODEOWNERS handles for automatic reviewer requests.', '')],
])

# ============================================================================ 10
h('10. Input validation and XSS defence in depth', 1)
p('The brief asks for “reasonable validation on the free text entry, such as handling script characters”. The design treats every CMS value as untrusted and applies three independent layers, so that bypassing any one of them (for example by editing a file by hand or calling the GitHub API directly) still cannot result in script execution on the public site.')
figure('diagrams/fig5-validation-layers.png', 'Figure 5 — Defence in depth.', width=fit_height('diagrams/fig5-validation-layers.png', 5.2))
table(['Layer', 'Mechanism', 'What it rejects', 'Failure mode'], [
    ['1 · Browser (UX)', 'Decap field pattern rules per field; preSave event handler in cms.js walks every string in the entry', '“<” followed by a tag name (<b, </b, <!--, <?), javascript:/vbscript: URLs, data: link targets, control characters, over-long text, bad numbers/dates', 'Red message under the field; save aborted with a toast'],
    ['2 · CI gate', 'tools/validate-content.mjs (same loader as the build) as a required status check; the build itself also fails on invalid content', 'Everything above plus schema errors: missing required fields, unknown enum values, bad YAML, bad file names, too many items', 'PR cannot be merged; build cannot ship'],
    ['3 · Render time', 'React JSX auto-escapes all text; no dangerouslySetInnerHTML anywhere; SafeMarkdown parses a small Markdown subset into React elements and allow-lists link schemes (http, https, mailto, relative, #)', 'Any residual markup is shown as literal characters; javascript:/data: links degrade to plain text', 'Content is displayed, never executed'],
], widths=[1.0, 2.1, 2.2, 1.2], size=8.5)
h('10.1 Why a custom Markdown renderer', 2)
p('The conventional approach (markdown → HTML string → DOMPurify → innerHTML) works, but it puts an HTML injection point in the render path and relies on keeping a sanitiser configured correctly. Because the site only needs headings, paragraphs, quotes, lists, bold/italic, inline code and links, a 150-line parser that emits React elements removes the HTML boundary entirely. The Decap toolbar is restricted to exactly these constructs (buttons: and editor_components: [] in config.yml), so editors cannot produce anything the renderer does not support. Unit tests cover <script>/<img onerror> literal rendering and javascript:, data:, vbscript: and protocol-relative links.')
h('10.2 Verified behaviour', 2)
bullets([
    'Typing <script>alert(1)</script> into the announcement headline shows “Headline didn’t match the pattern: Plain text only (no HTML or scripts)…”, the save is refused and the file is unchanged (browser test).',
    'The same text in a YAML file makes npm run validate:content exit 1 with “headline: HTML tags are not allowed” (unit test).',
    'SafeMarkdown renders “<script>alert(1)</script> <img src=x onerror=alert(1)>” as a single text node (unit test).',
])

# ============================================================================ 11
h('11. Local edit mode for developers', 1)
table(['Command', 'What runs', 'Behaviour'], [
    ['npm run dev', 'Vite only', 'Site at http://localhost:3000; /admin loads but shows the GitHub login (production backend).'],
    ['npm run dev:cms', 'Vite + decap-server (MODE=fs)', 'On localhost Decap detects the proxy at http://localhost:8081/api/v1 and switches to it; editorial workflow is unsupported in fs mode so Decap falls back to “simple” publishing: Publish writes directly to content/. The content plugin watches content/ and reloads the site. No GitHub account needed.'],
    ['npm run dev:cms:git', 'Vite + decap-server (MODE=git)', 'Proxy uses the local git working copy: Save creates cms/<collection>/<slug> branches, statuses are stored as branch descriptions, Publish merges into the current branch. Requires a clean working tree and a git identity.'],
], widths=[1.3, 1.5, 3.7], size=9)
p('The single config.yml serves both modes: local_backend: true is only honoured when the page is opened on localhost/127.0.0.1 and a proxy responds, so it is safe to ship in production.')

# ============================================================================ 12
h('12. Build-time content pipeline', 1)
figure('diagrams/fig4-content-pipeline.png', 'Figure 4 — Files to React.', width=fit_height('diagrams/fig4-content-pipeline.png', 5.0))
bullets([
    [('tools/content-loader.mjs', 'code'), (' reads the four content sources, validates them (collecting every problem before failing), derives item IDs (slugified names), computes display dates, sorts categories by order and posts by date descending, and returns a plain object typed as SiteContent (src/types.ts).', '')],
    [('tools/vite-plugin-site-content.mjs', 'code'), (' exposes that object as the virtual module virtual:site-content. In production the JSON is inlined into the bundle (no runtime fetch, no CORS, no GitHub rate limits for visitors). In dev it watches content/ and triggers a full reload; invalid content shows Vite’s error overlay with the list of problems.', '')],
    [('src/content.ts', 'code'), (' re-exports ANNOUNCEMENT, HOURS, MENU_CATEGORIES and BLOG_POSTS so the components changed minimally (import path only). src/data/pizzaShopData.ts was removed to avoid two sources of truth.', '')],
    [('Component changes: ', 'b'), ('Navbar renders the announcement (hidden when disabled; “alert” style in terracotta) and the hours summary; MenuSection shows a “Sold Out Today” badge for available: false; ArticlesSection renders post.body through SafeMarkdown; HoursAndLocation reads HOURS.days; Footer adds the staff link.', '')],
])

# ============================================================================ 13
h('13. Design decisions (with alternatives considered)', 1)
table(['#', 'Decision', 'Alternatives considered', 'Rationale'], [
    ['D1', 'Decap CMS loaded from the pinned npm package (decap-cms 3.8.4) and bundled into dist/admin/, not from a CDN <script>', 'unpkg/jsDelivr CDN tag (Decap’s documented default); importing decap-cms-app into the Vite bundle', 'Exact version pinning and reproducible builds; no third-party origin at runtime (CSP-friendly); works offline. Importing decap-cms-app into the site bundle was rejected because Decap ships React 18 while the site uses React 19 and the 5 MB bundle would pollute the site build.'],
    ['D2', 'Content as YAML files + Markdown with front matter, one file per menu category / blog post', 'JSON; a single menu file with nested categories; keep TypeScript and generate it', 'YAML diffs are readable in PR review by non-developers; one file per category gives the editor a short, focused form; Decap edits these formats natively.'],
    ['D3', 'Content inlined at build time via a Vite virtual module', 'Fetch YAML at runtime in the browser; a pre-build script that writes a JSON file', 'No runtime dependencies or loading states; invalid content fails the build instead of the live site; hot reload in dev; no generated file to commit.'],
    ['D4', 'One shared loader/validator (ESM JS) used by the build and by CI', 'Separate JSON Schema for CI; TypeScript validator compiled for Node', 'Guarantees the build and the gate agree; plain JS runs under node without a build step in Actions.'],
    ['D5', 'Custom SafeMarkdown parser emitting React elements', 'react-markdown; marked + DOMPurify + innerHTML', 'Removes HTML injection from the render path entirely; the site only needs a small subset; zero new runtime dependencies; easy to unit test.'],
    ['D6', 'Editorial workflow with squash merges; branch protection via importable ruleset', 'Simple publish mode (commit straight to main); protected branch via manual settings only', 'The brief requires a PR on a feature branch with review before deploy. Squash keeps one commit per content change. The ruleset file makes the protection reproducible and reviewable.'],
    ['D7', 'Self-hosted, dependency-free OAuth handler with a server-side collaborator check', 'Netlify Identity + Git Gateway; third-party OAuth proxies; GitHub App with PKCE (not supported by Decap’s GitHub backend)', 'GitHub Pages has no Netlify; third-party proxies would hold the client secret. ~250 lines of auditable code that runs on a free Worker; the push-permission check stops non-collaborators before any token reaches the browser.'],
    ['D8', 'Same config.yml for local and production (local_backend: true)', 'Separate config files or build-time templating', 'Decap only uses the proxy on localhost when it answers; one file means no drift between environments.'],
    ['D9', 'Validation messages and rules duplicated between config.yml patterns, cms.js and the loader', 'Generate config.yml from the loader’s rules', 'Keeps config.yml human-editable and conventional; the CI gate is authoritative, the browser rules are UX. A PR checklist item reminds developers to keep them in sync (see Open questions for the generator idea).'],
    ['D10', 'Hours & Schedule included as a fourth editable area', 'Strictly the three areas named in the brief', 'Holiday hours are among the most frequent small-business updates; it reuses the same mechanisms at negligible cost.'],
    ['D11', 'No image fields / Media library hidden', 'Enable media_folder uploads', 'The site uses inline SVG art only; images would add upload size, licensing and alt-text concerns. Can be enabled later (see Open questions).'],
    ['D12', 'Discreet footer link + noindex instead of a fully hidden URL', 'No link at all; HTTP basic auth in front of /admin (impossible on GitHub Pages)', 'Editors need a way to find the page on a phone; obscurity is not a control — GitHub login is. The link is low-contrast, rel=nofollow and the page is noindex.'],
    ['D13', 'Availability toggle (“Sold Out Today”) instead of deleting items', 'Delete/restore items', 'Daily menu changes are mostly temporary; a toggle is reversible and the badge informs customers.'],
    ['D14', 'Vite dev/preview middleware for /admin', 'Multi-page Vite build with admin as an entry', 'Keeps the admin a static page with no bundling of Decap; the middleware is 30 lines and mirrors GitHub Pages’ directory-index behaviour.'],
], widths=[0.35, 1.7, 1.8, 2.65], size=8)

# ============================================================================ 14
h('14. Security considerations and residual risks', 1)
table(['Topic', 'Assessment'], [
    ['Token in browser storage', 'Decap stores the user’s OAuth token in localStorage (Decap design). Scope is repo (or public_repo); the token is as powerful as the user’s own GitHub access. Mitigations: the /admin page loads no third-party scripts (CDN avoided), inputs are escaped, editors should use 2FA. Users can revoke the OAuth App from GitHub settings. Consider GitHub’s fine-grained tokens when Decap supports them.'],
    ['Compromised editor account', 'Can open PRs and push to cms/* branches only; cannot merge (branch protection) and cannot inject executable content (layers 2–3). Cleanup = close PR, delete branch, remove collaborator.'],
    ['OAuth handler availability', 'If the handler is down, editors cannot sign in; the public site is unaffected. The handler is stateless, so it can be redeployed anywhere in minutes.'],
    ['Supply chain', 'Decap and decap-server are pinned exact versions in package.json; npm ci in CI uses the lockfile. Decap 3.8.4 pulls a large dependency tree — run npm audit periodically (see Runbook).'],
    ['Validation bypass', 'A collaborator could hand-craft a commit with HTML in content/. CI rejects it; even if merged by force, React escaping and SafeMarkdown render it as text. The only “HTML-ish” path would be a future dangerouslySetInnerHTML — forbidden by convention and easy to grep for.'],
    ['Secrets', 'Only the OAuth client secret exists; it lives in the Worker/host secret store, never in the repository. The deploy workflow needs no secrets beyond the GitHub-provided token.'],
    ['Privacy', 'The site makes no runtime calls; /admin talks to github.com and the OAuth handler only. GitHub Pages serves everything over HTTPS.'],
], widths=[1.6, 4.9], size=9)

# ============================================================================ 15
h('15. Operations runbook', 1)
h('15.1 First-time setup', 2)
bullets([
    'Push the repository to GitHub with the SlowDough folder as the root. Settings → Pages → Source: GitHub Actions.',
    'Settings → Rules → Rulesets → Import → .github/rulesets/main-branch-protection.json. Confirm “Validate & build” appears as the required check after the first PR.',
    'Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps): Homepage = site URL; Callback = https://<oauth-host>/callback. Note the Client ID; generate a Client Secret.',
    'Deploy oauth/ as a Cloudflare Worker (wrangler deploy; secrets via wrangler secret put) or as a Node service. Set GITHUB_REPO and ALLOWED_ORIGINS (site origin only, e.g. https://<owner>.github.io).',
    'Edit public/admin/config.yml: backend.repo, backend.base_url (handler origin, no path), site_url/display_url. Commit via a normal PR.',
    'Invite the owner/manager as a collaborator with Write permission; invite at least one reviewer (Write or higher). Optionally fill .github/CODEOWNERS.',
    'Sign in at https://<site>/admin/ and make a test change; approve and merge the PR; confirm the deploy workflow ran and the site updated.',
], style='List Number')
h('15.2 Routine operations', 2)
table(['Task', 'How'], [
    ['Add a field to a collection', 'Edit public/admin/config.yml (field + pattern), tools/content-loader.mjs (rule + output), src/types.ts and the component; add a unit test; run npm run check.'],
    ['Upgrade Decap', 'npm install --save-exact decap-cms@x.y.z decap-server@…; run npm run dev:cms and click through each collection; check admin.css selectors still match (component labels are stable across minor versions).'],
    ['Rotate the OAuth secret', 'Generate a new secret on the OAuth App, update the Worker/host secret, redeploy; old sessions stay valid until the token is revoked.'],
    ['Remove an editor', 'Remove the collaborator on GitHub; optionally revoke the OAuth App authorisation for that user.'],
    ['Emergency: take the announcement down', 'Edit content/settings/announcement.yml (enabled: false) via PR, or in /admin → Site Settings → Dough Announcement.'],
    ['Dependency hygiene', 'npm audit monthly; Dependabot for GitHub Actions and npm is recommended (see Open questions).'],
], widths=[1.8, 4.7], size=9)
h('15.3 Troubleshooting', 2)
table(['Symptom', 'Likely cause / fix'], [
    ['Login popup says “not a collaborator with write access”', 'User lacks Write on GITHUB_REPO; invite them or fix GITHUB_REPO.'],
    ['Popup closes but nothing happens', 'backend.base_url must equal the handler origin exactly (Decap compares event.origin); ALLOWED_ORIGINS must contain the site origin.'],
    ['“Repo not found” after login', 'backend.repo typo, organisation has not approved the OAuth App, or the user cannot see the repository.'],
    ['PR check fails with “Content validation failed”', 'Open the job summary; fix the listed field in /admin (the same rules apply) and save again.'],
    ['Site shows old content after merge', 'Wait for the Deploy workflow; check Actions tab; hard refresh. Ensure Pages source is “GitHub Actions”.'],
    ['Publish button in /admin fails', 'Expected when branch protection is active and the PR is not yet approved; merge on GitHub after review.'],
], widths=[2.3, 4.2], size=9)

# ============================================================================ 16
h('16. Verification performed', 1)
p('All checks were executed in a sandbox with Node 22.21, Chromium 141 (Playwright) and a local GitHub fake where network access was required.')
table(['Area', 'Evidence'], [
    ['Build & types', 'npm run check passes: content valid (3 categories, 13 items, 2 posts), tsc clean, 18 unit tests green, vite build emits dist/admin/decap-cms.js (5.2 MB) and the site bundle.'],
    ['Base path', 'VITE_BASE_PATH=/SlowDough/ build served with vite preview: /SlowDough/admin, /SlowDough/admin/, config.yml, decap-cms.js all 200; footer link resolves to /SlowDough/admin/; preview.css loads inside the preview iframe.'],
    ['Local fs mode', 'Edited the announcement in /admin → content/settings/announcement.yml rewritten → site reloaded with the alert-style banner. <script> in the headline refused with the pattern message; file unchanged.'],
    ['Local git mode (editorial workflow)', 'New blog post → branch cms/blog/2026-10-11-autumn-squash-sage-a-seasonal-special with commit “content: add Blog Post …”; statuses mapped to decap-cms/pending_review and pending_publish; Publish merged into main and deleted the branch. Decap-written YAML/Markdown passes the CI validator unchanged.'],
    ['OAuth handler', '8 unit tests (state/CSRF, scope clamp, token exchange, collaborator refusal, secret never leaks, error routes). Browser end-to-end with the real Decap client against a fake GitHub: successful login stored {login, token, backendName: github}; a user without push permission was refused and no token was stored.'],
    ['Safe rendering', 'Unit tests: raw HTML rendered as literal text; javascript:/data:/vbscript:/protocol-relative links degrade to text; blog modal renders headings, paragraphs and pull quotes identically to the original design.'],
    ['Admin skin', 'Screenshots of login, collections, menu/announcement/hours/blog editors and the workflow board (docs/screenshots/).'],
], widths=[1.6, 4.9], size=9)
p('Not verifiable offline (requires real GitHub): PR creation through the GitHub API, Actions execution, Pages deployment, ruleset import. These follow documented Decap/GitHub behaviour and are covered by the first-time setup checklist.', italic=True, color=MUTED)

# ============================================================================ 17
h('17. Open questions', 1)
table(['#', 'Question', 'Options / recommendation'], [
    ['Q1', 'Repository root: is the GitHub repository rooted at the SlowDough folder (assumed) or one level up?', 'If one level up, add working-directory: SlowDough to both workflows, prefix Decap folder/file paths and media_folder with SlowDough/, and pass the same prefix to the loader. Recommendation: make SlowDough the root.'],
    ['Q2', 'Who reviews? The brief implies a reviewer separate from the editor. GitHub does not allow self-approval.', 'Either a second person (developer or co-owner) approves, or — if the owner must be able to publish alone — relax the ruleset to 0 required approvals while keeping the PR + status-check requirement. Decide before importing the ruleset.'],
    ['Q3', 'Hosting of the OAuth handler: Cloudflare account available? Custom domain for it?', 'Default: free Cloudflare Worker on workers.dev. Alternatives in oauth/README.md.'],
    ['Q4', 'Public or private repository?', 'Private needs auth_scope: repo and OAUTH_SCOPE=repo (the defaults); public could use public_repo for a smaller token scope.'],
    ['Q5', 'Custom domain (e.g. slowdoughpizza.com)?', 'Set repository variable SITE_CUSTOM_DOMAIN; the workflow writes CNAME and uses base “/”. Update site_url, ALLOWED_ORIGINS and the OAuth App homepage.'],
    ['Q6', 'Should editors be able to create/delete menu categories, or only edit items?', 'Currently allowed (create: true, delete: true) because review is mandatory. Can be locked down per collection.'],
    ['Q7', 'Images for blog posts or menu items?', 'Would require enabling media_folder/public_folder (with the Pages base path), an image widget, alt-text rules and size limits. Out of scope for v1.'],
    ['Q8', 'Notifications: how does the reviewer learn that a change awaits?', 'GitHub PR notifications + CODEOWNERS auto-requests; optionally a Slack/e-mail Action on cms/* PRs.'],
    ['Q9', 'Per-PR preview of the site for reviewers?', 'Could deploy cms/* branches to a preview host (e.g. Cloudflare Pages) and set show_preview_links: true. Adds infrastructure; defer until reviewers ask for it.'],
    ['Q10', 'Should the browser patterns be generated from the loader rules to prevent drift?', 'A small script could emit the regexes into config.yml. Deferred; the CI gate is authoritative today.'],
    ['Q11', 'Dependabot / renovate for decap-cms, actions and npm?', 'Recommended: enable Dependabot for npm and github-actions with grouped weekly updates.'],
    ['Q12', 'Analytics or error reporting for /admin?', 'None planned; Decap logs to the console. Revisit if support load appears.'],
], widths=[0.4, 2.4, 3.7], size=8.5)

# ============================================================================ Appendices
doc.add_page_break()
h('Appendix A — File inventory', 1)
table(['Path', 'Purpose'], [
    ['content/settings/announcement.yml, hours.yml; content/menu/*.yml; content/blog/*.md', 'Editable content (single source of truth)'],
    ['public/admin/index.html', 'Admin page; loads decap-cms.js, cms.js, admin.css; noindex'],
    ['public/admin/config.yml', 'Decap configuration: backend, workflow, collections, validation patterns'],
    ['public/admin/cms.js', 'Preview templates, preSave guard, cosmetics'],
    ['public/admin/admin.css, preview.css, logo.svg', 'Site skin for the Decap UI and the preview pane; wordmark'],
    ['public/robots.txt', 'Disallow /admin/'],
    ['src/content.ts, src/virtual-site-content.d.ts, src/types.ts', 'Typed access to the build-time content'],
    ['src/lib/safeMarkdown.ts, src/components/SafeMarkdown.tsx', 'Safe Markdown subset parser and renderer'],
    ['src/components/{Navbar,MenuSection,ArticlesSection,HoursAndLocation,Footer}.tsx', 'Updated to read from content; announcement, sold-out badge, staff link'],
    ['tools/content-loader.mjs', 'Loader + validator shared by build and CI'],
    ['tools/validate-content.mjs', 'CLI: npm run validate:content'],
    ['tools/vite-plugin-site-content.mjs, tools/vite-plugin-decap-admin.mjs', 'Vite integration'],
    ['tools/dev-with-cms.mjs', 'npm run dev:cms / dev:cms:git'],
    ['oauth/handler.mjs, worker.mjs, server.mjs, wrangler.toml, README.md', 'OAuth handler and deployment options'],
    ['tests/*.test.mjs', 'Unit tests (node --test): loader, SafeMarkdown, OAuth handler'],
    ['.github/workflows/pr-checks.yml, deploy.yml', 'CI and deployment'],
    ['.github/rulesets/main-branch-protection.json, CODEOWNERS, PULL_REQUEST_TEMPLATE.md', 'Repository governance'],
    ['docs/', 'This document, the manager guide, diagrams and screenshots'],
], widths=[3.2, 3.3], size=8.5)

h('Appendix B — Decap configuration reference (key settings)', 1)
code('''backend:
  name: github
  repo: <owner>/SlowDough          # CHANGE ME
  branch: main
  base_url: https://<oauth-host>   # CHANGE ME — origin only, no path
  auth_endpoint: auth
  auth_scope: repo
  squash_merges: true
  commit_messages: { create: 'content: add {{collection}} "{{slug}}"', update: 'content: update …', delete: 'content: remove …' }
local_backend: true                # used only on localhost when decap-server answers
publish_mode: editorial_workflow   # Draft → In review → Ready; PR per change
show_preview_links: false
media_folder: public/uploads       # required key; no image widgets are configured
public_folder: /uploads
site_url: https://<owner>.github.io/SlowDough   # CHANGE ME
logo_url: ./logo.svg
collections: settings (files: announcement, hours) · menu (folder content/menu, yml) · blog (folder content/blog, md)''')
p('Every free-text field carries a pattern such as:', after=2)
code('''pattern:
  - '^(?![\\s\\S]*<\\s*/?\\s*[A-Za-z!?/])(?![\\s\\S]*(?:javascript|vbscript)\\s*:)[\\s\\S]{1,120}$'
  - 'Plain text only (no HTML or scripts), 1–120 characters\'''')
p('The markdown body additionally forbids data: link targets; the toolbar is limited to bold, italic, heading-two/three, quote, bulleted/numbered list and link, with editor_components: [] and sanitize_preview: true.')

h('Appendix C — Glossary', 1)
table(['Term', 'Meaning'], [
    ['Decap CMS', 'Open-source, Git-based content manager (formerly Netlify CMS). Runs entirely in the browser and talks to a Git provider API.'],
    ['Editorial workflow', 'Decap mode in which each change lives on its own branch/PR with Draft, In review and Ready statuses.'],
    ['decap-server', 'Decap’s local proxy for development; fs mode edits files directly, git mode simulates branches.'],
    ['OAuth web flow', 'GitHub authorisation flow where a server exchanges a temporary code for a user token using the app’s client secret.'],
    ['Collaborator (write)', 'A GitHub user granted Write (or higher) permission on the repository — the only accounts allowed into /admin.'],
    ['Ruleset / branch protection', 'GitHub settings that require PRs, approvals and status checks before main can change.'],
    ['GitHub Pages', 'Static hosting for the built site; deployed via Actions artifacts.'],
    ['Virtual module', 'A Vite module generated in memory by a plugin (here: virtual:site-content).'],
], widths=[1.7, 4.8], size=9)

# footer with page numbers
def add_page_number(section):
    footer = section.footer; para = footer.paragraphs[0]; para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = para.add_run('Slow Dough Pizza Co. — Decap CMS Technical Design · v1.0 · Page '); r.font.size = Pt(8); r.font.color.rgb = MUTED
    fld = OxmlElement('w:fldSimple'); fld.set(qn('w:instr'), 'PAGE'); rr = OxmlElement('w:r'); t = OxmlElement('w:t'); t.text = '1'; rr.append(t); fld.append(rr); para._p.append(fld)
add_page_number(sec)

doc.save(OUT)
print('wrote', OUT)
