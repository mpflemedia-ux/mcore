#!/usr/bin/env python3
"""Bake Settings Audit Log mobile overflow fix into app/index.html (idempotent)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'
LINK = '<link rel="stylesheet" href="./settings-audit-mobile.css?v=1">'
PRINT_LINK = '<link rel="stylesheet" href="./print-multipage.css?v=1">'

OLD_CARD = '<div class="card" style="max-width:700px;margin-top:16px" id="stg-audit">'
NEW_CARD = '<div class="card" style="max-width:min(700px,100%);width:100%;box-sizing:border-box;overflow-x:hidden;margin-top:16px" id="stg-audit">'

OLD_PREV = '<div id="settings-audit-preview"><div class="spinner" style="width:16px;height:16px"></div></div>'
NEW_PREV = '<div id="settings-audit-preview" class="settings-audit-scroll" style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;min-width:0"><div class="spinner" style="width:16px;height:16px"></div></div>'

OLD_VIEW = '<div class="card"><div id="audit-log-wrap" style="overflow-x:auto">'
NEW_VIEW = '<div class="card" style="max-width:100%;width:100%;box-sizing:border-box;overflow-x:hidden;min-width:0"><div id="audit-log-wrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;min-width:0">'

OLD_ADMIN = '<div class="card"><div id="admin-audit-wrap" style="overflow-x:auto;padding:8px">'
NEW_ADMIN = '<div class="card" style="max-width:100%;width:100%;box-sizing:border-box;overflow-x:hidden;min-width:0"><div id="admin-audit-wrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;min-width:0;padding:8px">'

OLD_SEL = '''  .card [style*="overflow-x"], #inv-list-wrap, #po-list-wrap, #pv-list-wrap,
  #exp-table-wrap, #bill-list-wrap, #crm-table-wrap, #supp-table-wrap, #audit-log-wrap {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
  }'''
NEW_SEL = '''  .card [style*="overflow-x"], #inv-list-wrap, #po-list-wrap, #pv-list-wrap,
  #exp-table-wrap, #bill-list-wrap, #crm-table-wrap, #supp-table-wrap, #audit-log-wrap,
  #settings-audit-preview, #admin-audit-wrap {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
    max-width: 100%;
    min-width: 0;
  }
  #stg-audit, .card:has(> #audit-log-wrap), .card:has(> #admin-audit-wrap) {
    max-width: 100% !important;
    width: 100%;
    box-sizing: border-box;
    overflow-x: hidden;
    min-width: 0;
  }'''


def main():
    html = INDEX.read_text(encoding='utf-8')
    changed = False

    if OLD_CARD in html:
        html = html.replace(OLD_CARD, NEW_CARD, 1)
        changed = True
    if OLD_PREV in html:
        html = html.replace(OLD_PREV, NEW_PREV, 1)
        changed = True
    if OLD_VIEW in html:
        html = html.replace(OLD_VIEW, NEW_VIEW, 1)
        changed = True
    if OLD_ADMIN in html:
        html = html.replace(OLD_ADMIN, NEW_ADMIN, 1)
        changed = True
    if OLD_SEL in html:
        html = html.replace(OLD_SEL, NEW_SEL, 1)
        changed = True

    if 'settings-audit-mobile.css' not in html:
        if PRINT_LINK in html:
            html = html.replace(PRINT_LINK, PRINT_LINK + LINK, 1)
            changed = True
        else:
            marker = '<script src="./public-inv-scroll.js?v=4"></script>'
            if marker not in html:
                raise SystemExit('head marker not found for CSS link')
            html = html.replace(marker, marker + LINK, 1)
            changed = True

    if changed:
        INDEX.write_text(html, encoding='utf-8')
        print('patched', INDEX)
    else:
        print('already patched')


if __name__ == '__main__':
    main()
