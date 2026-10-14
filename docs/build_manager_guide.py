#!/usr/bin/env python3
"""Generates docs/pizza-manager-guide.pdf — a 1-2 page illustrated how-to for the shop owner."""
import os
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas as pdfcanvas

HERE = os.path.dirname(os.path.abspath(__file__))
GUIDE_IMG = os.path.join(HERE, "screenshots", "guide")

DARK = colors.HexColor("#24211E")
ORANGE = colors.HexColor("#C85A32")
CREAM = colors.HexColor("#FAF8F5")
TAN = colors.HexColor("#F0E7DC")
GRAY = colors.HexColor("#5C5247")
GREEN = colors.HexColor("#335928")

PAGE_W, PAGE_H = LETTER
MARGIN = 0.55 * inch


def on_page(canvas_obj, doc):
    canvas_obj.saveState()
    # Header band
    canvas_obj.setFillColor(DARK)
    canvas_obj.rect(0, PAGE_H - 0.62 * inch, PAGE_W, 0.62 * inch, stroke=0, fill=1)
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont("Helvetica-Bold", 13)
    canvas_obj.drawString(MARGIN, PAGE_H - 0.42 * inch, "Slow Dough Pizza Co.")
    canvas_obj.setFont("Helvetica", 9.5)
    canvas_obj.setFillColor(colors.HexColor("#E8DED3"))
    canvas_obj.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.42 * inch, "Website Content Guide \u2014 Using /admin")
    # Footer
    canvas_obj.setFillColor(GRAY)
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.drawString(MARGIN, 0.35 * inch, "Slow Dough Pizza Co. \u2014 Internal guide")
    canvas_obj.drawRightString(PAGE_W - MARGIN, 0.35 * inch, f"Page {doc.page}")
    canvas_obj.restoreState()


styles = {
    "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=18, textColor=DARK, spaceAfter=4, leading=22),
    "subtitle": ParagraphStyle("subtitle", fontName="Helvetica-Oblique", fontSize=10.5, textColor=ORANGE, spaceAfter=10, leading=14),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=12.5, textColor=ORANGE, spaceBefore=10, spaceAfter=4),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.6, textColor=DARK, leading=13, spaceAfter=5),
    "bodySmall": ParagraphStyle("bodySmall", fontName="Helvetica", fontSize=9, textColor=GRAY, leading=12, spaceAfter=4),
    "step": ParagraphStyle("step", fontName="Helvetica", fontSize=9.6, textColor=DARK, leading=13, spaceAfter=3, leftIndent=14),
    "caption": ParagraphStyle("caption", fontName="Helvetica-Oblique", fontSize=8, textColor=GRAY, alignment=TA_CENTER, spaceAfter=8, spaceBefore=2),
    "tip": ParagraphStyle("tip", fontName="Helvetica", fontSize=9, textColor=DARK, leading=12.5),
    "tipTitle": ParagraphStyle("tipTitle", fontName="Helvetica-Bold", fontSize=9.5, textColor=GREEN),
}


def img(path, max_w, max_h):
    from PIL import Image as PILImage
    w, h = PILImage.open(path).size
    scale = min(max_w / w, max_h / h)
    return Image(path, width=w * scale, height=h * scale)


story = []

story.append(Paragraph("Updating the Slow Dough Website", styles["title"]))
story.append(Paragraph(
    "A quick guide to editing the Daily Menu, Blog posts, and the Dough Announcement banner yourself \u2014 no developer needed.",
    styles["subtitle"],
))
story.append(HRFlowable(width="100%", thickness=1, color=TAN, spaceAfter=8))

story.append(Paragraph("1. Open the editor", styles["h2"]))
story.append(Paragraph(
    "Go to <b>https://smagara.github.io/SlowDoughPizzaSite/admin/</b> in any browser "
    "(bookmark it \u2014 it isn't linked from the website). Click <b>Login with GitHub</b> and "
    "sign in with your GitHub account (the same one your web developer added to the site as "
    "a collaborator); a small GitHub window opens, asks you to approve \u201cSlow Dough Content "
    "Admin\u201d the first time, and closes by itself. You stay signed in on that device.",
    styles["body"],
))

tbl1 = Table(
    [[img(os.path.join(GUIDE_IMG, "login.png"), 2.6 * inch, 1.5 * inch),
      img(os.path.join(GUIDE_IMG, "collections.png"), 3.6 * inch, 1.5 * inch)]],
    colWidths=[2.7 * inch, 3.7 * inch],
)
tbl1.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
story.append(tbl1)
capt = Table(
    [[Paragraph("The sign-in screen.", styles["caption"]), Paragraph("After signing in, pick what to edit on the left.", styles["caption"])]],
    colWidths=[2.7 * inch, 3.7 * inch],
)
story.append(capt)

story.append(Paragraph("2. Choose what to update", styles["h2"]))
story.append(Paragraph(
    "On the left you'll see four areas you can manage:",
    styles["body"],
))
bullet_data = [
    ["\u2022  Dough Announcement", "The dark banner at the top of the site and the homepage headline."],
    ["\u2022  Daily Menu", "Pizzas, small plates, drinks, prices, and descriptions."],
    ["\u2022  Store Hours", "Weekly hours and the holiday/closure notes."],
    ["\u2022  Blog Posts", "Articles shown in \u201cThe Baker's Journal.\u201d"],
]
bt = Table(bullet_data, colWidths=[1.7 * inch, 4.7 * inch])
bt.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 9.3),
    ("TEXTCOLOR", (0, 0), (-1, -1), DARK),
    ("TOPPADDING", (0, 0), (-1, -1), 1.5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
]))
story.append(bt)

story.append(Paragraph("3. Make your edit", styles["h2"]))
story.append(Paragraph(
    "Click into any field and type your change \u2014 for example, updating a pizza's price or "
    "description. The right-hand side shows a live preview that looks just like the real "
    "website, so you can check your change before saving.",
    styles["body"],
))
story.append(img(os.path.join(GUIDE_IMG, "menu_editor.png"), 6.4 * inch, 2.35 * inch))
story.append(Paragraph("Editing the Daily Menu: fields on the left, live preview on the right.", styles["caption"]))

story.append(Paragraph(
    "<b>A note on typing special text:</b> please don't paste in raw HTML or code snippets "
    "(e.g. anything starting with &lt;script&gt;). The editor will show a red warning and "
    "block saving if it detects this \u2014 that's expected, just remove it and use plain text "
    "or the formatting buttons (bold, italic, bullet points) instead.",
    styles["bodySmall"],
))

# ---------------------------------------------------------------------
from reportlab.platypus import PageBreak
story.append(PageBreak())

story.append(img(os.path.join(GUIDE_IMG, "validation.png"), 6.0 * inch, 0.98 * inch))
story.append(Paragraph("Example: the editor blocking a pasted script tag with a clear red warning.", styles["caption"]))

story.append(Paragraph("4. Save & publish your change", styles["h2"]))
story.append(Paragraph(
    "Click <b>Save</b>, then use the <b>Publish</b> button. Your change does <b>not</b> go live "
    "immediately \u2014 it's sent off for a quick review first, the same way a second pair of "
    "eyes checks things before they go out. You'll see its status change from "
    "<b>Draft \u2192 In review \u2192 Ready</b>.",
    styles["body"],
))
story.append(img(os.path.join(GUIDE_IMG, "workflow.png"), 6.4 * inch, 1.55 * inch))
story.append(Paragraph("The Editorial Workflow board: see everything waiting on review at a glance.", styles["caption"]))

tip_table = Table(
    [[Paragraph("What happens behind the scenes?", styles["tipTitle"])],
     [Paragraph(
         "Your edit is automatically turned into a \u201cPull Request\u201d on GitHub \u2014 think of it as a "
         "clearly marked, reversible change request. Once it's reviewed and approved, the "
         "website automatically rebuilds and your update goes live \u2014 usually within a "
         "couple of minutes, with no extra steps for you.",
         styles["tip"],
     )]],
    colWidths=[6.4 * inch],
)
tip_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E4EDE1")),
    ("BOX", (0, 0), (-1, -1), 0.75, GREEN),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(Spacer(1, 2))
story.append(tip_table)

story.append(Paragraph("5. Good to know", styles["h2"]))
faq = [
    ("Who can make changes?", "Only the GitHub accounts your developer has added as collaborators on the website's repository. Nobody else can sign in, even if they find the /admin link."),
    ("Can I undo a mistake?", "Yes \u2014 every change is reviewed before it goes live, and the full history of edits is kept forever, so anything can be reverted."),
    ("Do I need to tell anyone I made a change?", "If a reviewer is set up on your team, they'll see the pending change automatically and can approve it. Otherwise, check back on the status in the editor."),
    ("What if I just want to test things?", "Ask your developer about \u201clocal preview mode\u201d \u2014 a no-risk way to practice edits on their computer before touching the live site."),
]
faq_rows = [[Paragraph(f"<b>{q}</b>", styles["body"]), Paragraph(a, styles["body"])] for q, a in faq]
faq_table = Table(faq_rows, colWidths=[1.9 * inch, 4.5 * inch])
faq_table.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LINEBELOW", (0, 0), (-1, -2), 0.5, TAN),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story.append(faq_table)

story.append(Spacer(1, 10))
story.append(HRFlowable(width="100%", thickness=1, color=TAN, spaceAfter=6))
story.append(Paragraph(
    "Questions or something looks wrong? Contact your website developer/engineering contact "
    "before making further changes.",
    styles["bodySmall"],
))

out_path = os.path.join(HERE, "pizza-manager-guide.pdf")
doc = SimpleDocTemplate(
    out_path, pagesize=LETTER,
    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=0.85 * inch, bottomMargin=0.6 * inch,
    title="Slow Dough — Website Content Guide",
)
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print("Saved:", out_path)
