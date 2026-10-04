#!/usr/bin/env python3
"""Restore booking-card-ui.js if a bad push landed, then pin the script tag to v=7."""
from pathlib import Path
import subprocess

p = Path("app/booking-card-ui.js")
text = p.read_text(encoding="utf-8")
marker = "var terminal = r.status === 'expired' || r.status === 'cancelled';"
if marker not in text:
    subprocess.check_call([
        "git", "checkout", "2d9d60d49283bcc4fd256a9293376f699973e729", "--", "app/booking-card-ui.js"
    ])
    text = p.read_text(encoding="utf-8")
    old = (
        "    if (live) {\n"
        "      html += '<button type=\"button\" class=\"db-btn\" data-bk-act=\"amend\" data-id=\"' + esc(r.id) + '\">' + (isBm() ? 'Pinda' : 'Amend') + '</button>';\n"
        "      html += '<button type=\"button\" class=\"db-btn\" data-bk-act=\"delete\" data-id=\"' + esc(r.id) + '\">' + (isBm() ? 'Padam' : 'Delete') + '</button>';\n"
        "    }\n"
    )
    new = (
        "    var terminal = r.status === 'expired' || r.status === 'cancelled';\n"
        "    if (live) {\n"
        "      html += '<button type=\"button\" class=\"db-btn\" data-bk-act=\"amend\" data-id=\"' + esc(r.id) + '\">' + (isBm() ? 'Pinda' : 'Amend') + '</button>';\n"
        "    }\n"
        "    if (live || terminal) {\n"
        "      html += '<button type=\"button\" class=\"db-btn\" data-bk-act=\"delete\" data-id=\"' + esc(r.id) + '\">' + (isBm() ? 'Padam' : 'Delete') + '</button>';\n"
        "    }\n"
    )
    if old not in text:
        raise SystemExit("actions block missing in restored booking-card-ui.js")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("patched booking-card-ui.js")
else:
    print("card script already has terminal delete")

html_path = Path("app/index.html")
html = html_path.read_text(encoding="utf-8")
a = '<script src="./booking-card-ui.js?v=6"></script>'
b = '<script src="./booking-card-ui.js?v=7"></script>'
if html.count(a) == 1:
    html_path.write_text(html.replace(a, b, 1), encoding="utf-8")
    print("bumped card script to v=7")
elif b in html:
    print("already v=7")
else:
    print("card script tag not v=6; left index.html")
