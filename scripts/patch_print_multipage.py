#!/usr/bin/env python3
"""Bake print multipage unlock into app/index.html (idempotent)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'

UNLOCK = '''  /* Unlock app shell so multi-page prints (Journal Entries, PV lists, reports)
     are not clipped to one viewport. Screen UI keeps overflow:hidden / 100dvh;
     print must allow height:auto + overflow:visible or Chrome shows 1/1 only. */
  html, body, #app, #shell, #shell.active, #main-area, #main {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    position: static !important;
  }
  #shell, #shell.active, #main-area {
    display: block !important;
    width: 100% !important;
  }
'''

WRAPS = '''  #main-area { margin:0 !important; }
  #main { padding:0 !important; overflow: visible !important; }
  body, html { background:#fff !important; }
  .card { box-shadow:none !important; border:1px solid #ccc !important; break-inside:avoid; }
  /* Horizontal scroll wraps clip paged media — same issue as .pdoc-sd-scroll */
  #jnl-table-wrap, #pv-list-wrap, #exp-table-wrap, #coa-table-wrap,
  #inv-list-wrap, #po-list-wrap, #bill-list-wrap, #crm-table-wrap,
  #supp-table-wrap, #audit-log-wrap, #pc-list-wrap,
  #main [style*="overflow-x"], #main [style*="overflow:auto"], #main [style*="overflow: auto"] {
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
  }
  #main table { page-break-inside: auto; }
  #main tr { page-break-inside: avoid; break-inside: avoid; }
  #main thead { display: table-header-group; }
  #main tfoot { display: table-footer-group; }
  .print-only { display:inline !important; }
'''

OLD_MAIN_PAD = '''  #main-area { margin:0 !important; }
  #main { padding:0 !important; }
  body, html { background:#fff !important; }
  .card { box-shadow:none !important; border:1px solid #ccc !important; break-inside:avoid; }
  .print-only { display:inline !important; }'''

LINK = '<link rel="stylesheet" href="./print-multipage.css?v=1">'
MARKER = '<script src="./public-inv-scroll.js?v=4"></script>'

def main():
    html = INDEX.read_text(encoding='utf-8')
    changed = False
    if 'Unlock app shell so multi-page prints' not in html:
        anchor = '@media print {\n  #sidebar, #header, .no-print, .page-header, .acc-tabs, #acc-tabs { display:none !important; }'
        if anchor not in html:
            raise SystemExit('print media anchor not found')
        html = html.replace(anchor, '@media print {\n' + UNLOCK + '  #sidebar, #header, .no-print, .page-header, .acc-tabs, #acc-tabs { display:none !important; }', 1)
        if OLD_MAIN_PAD not in html:
            raise SystemExit('main pad block not found')
        html = html.replace(OLD_MAIN_PAD, WRAPS, 1)
        changed = True
    if 'print-multipage.css' not in html:
        if MARKER not in html:
            raise SystemExit('public-inv-scroll marker not found')
        html = html.replace(MARKER, MARKER + LINK, 1)
        changed = True
    if changed:
        INDEX.write_text(html, encoding='utf-8')
        print('patched', INDEX)
    else:
        print('already patched')

if __name__ == '__main__':
    main()
