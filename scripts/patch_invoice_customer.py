#!/usr/bin/env python3
from pathlib import Path
p = Path('app/index.html')
html = p.read_text(encoding='utf-8')
changed = False
old_css = '.pdoc-band-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; margin-top:10px; }'
new_css = '.pdoc-band-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; margin-top:10px; align-items:start; }\n.pdoc-band-right { text-align:right; }\n.pdoc-band-right .pdoc-band-item b { display:block; }'
if old_css in html and '.pdoc-band-right' not in html:
    html = html.replace(old_css, new_css, 1)
    changed = True
old = '''      <div class="pdoc-band-grid">
        <div class="pdoc-band-item">${isBm?'Bank':'Bank'}<b>${_aiEscapeHtml(bankName || '\u2014')}</b></div>
        <div class="pdoc-band-item">${isBm?'No. Akaun Bank':'Bank Account No.'}<b>${_aiEscapeHtml(bankAcc || '\u2014')}</b></div>
        ${rec.employees?.epf_no ? `<div class="pdoc-band-item">${isBm?'No. KWSP':'EPF No.'}<b>${_aiEscapeHtml(rec.employees.epf_no)}</b></div>` : ''}
        ${rec.employees?.socso_no ? `<div class="pdoc-band-item">${isBm?'No. PERKESO':'SOCSO No.'}<b>${_aiEscapeHtml(rec.employees.socso_no)}</b></div>` : ''}
        <div class="pdoc-band-item">${isBm?'Tempoh':'Period'}<b>${_pdocMonthYearLabel(rec.month, rec.year, isBm)}</b></div>
      </div>'''
new = '''      <div class="pdoc-band-grid">
        <div>
          <div class="pdoc-band-item">${isBm?'Bank':'Bank'}<b>${_aiEscapeHtml(bankName || '\u2014')}</b></div>
          ${rec.employees?.epf_no ? `<div class="pdoc-band-item">${isBm?'No. KWSP':'EPF No.'}<b>${_aiEscapeHtml(rec.employees.epf_no)}</b></div>` : ''}
          ${rec.employees?.socso_no ? `<div class="pdoc-band-item">${isBm?'No. PERKESO':'SOCSO No.'}<b>${_aiEscapeHtml(rec.employees.socso_no)}</b></div>` : ''}
        </div>
        <div class="pdoc-band-right">
          <div class="pdoc-band-item">${isBm?'No. Akaun Bank':'Bank Account No.'}<b>${_aiEscapeHtml(bankAcc || '\u2014')}</b></div>
          <div class="pdoc-band-item">${isBm?'Tempoh':'Period'}<b>${_pdocMonthYearLabel(rec.month, rec.year, isBm)}</b></div>
        </div>
      </div>'''
if old in html:
    html = html.replace(old, new, 1)
    changed = True
    print('band html patched')
else:
    print('band html not found — check exact bytes')
    # fallback CSS-only: right-align 2nd column cells via even items is wrong; add helper class via css on last column
    if 'pdoc-band-right' not in html:
        html = html.replace('.pdoc-band-item {', '.pdoc-band-right,.pdoc-band-grid > .pdoc-band-item:nth-child(2),.pdoc-band-grid > .pdoc-band-item:nth-child(5){text-align:right;}\n.pdoc-band-item {', 1)
        changed = True
        print('css fallback')
if changed:
    p.write_text(html, encoding='utf-8')
    print('wrote index')
else:
    print('no change')
