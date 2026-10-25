#!/usr/bin/env python3
"""One-shot: Customer detail Info→Invoices mobile stack + invoice card rows (idempotent)."""
from pathlib import Path
import sys

OLD_GRID_OPEN = '''  <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%">
  <div style="display:grid;grid-template-columns:minmax(280px,1fr) minmax(420px,1.5fr);gap:16px;min-width:700px">'''

NEW_GRID_OPEN = '''  <div class="crm-detail-info-inv-scroll" style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%">
  <div class="crm-detail-info-inv" style="display:grid;grid-template-columns:minmax(280px,1fr) minmax(420px,1.5fr);gap:16px;min-width:700px">'''

OLD_INV = '''      ${(invs||[]).length === 0
        ? `<div class="empty-state" style="padding:40px"><i class="ti ti-file-off"></i><p>${t.noInv}</p></div>`
        : `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="width:max-content;min-width:100%"><thead><tr><th>Ref</th><th>Date</th><th style="text-align:right">Total</th><th style="text-align:right">Paid</th><th style="text-align:right">Bal</th><th>Status</th></tr></thead><tbody>
          ${(invs||[]).map(i=>{
            const bal = Math.max(0, Number(i.total||0)-Number(i.paid_amt||0))
            const st = String(i.status||'')
            const badge = st==='paid'?'badge-green':st==='partial'?'badge-yellow':st==='cancelled'?'badge-gray':'badge-red'
            return `<tr style="cursor:pointer" onclick="if(canAccess('sales'))openPage('sales',{view:'inv-detail',id:'${i.id}'});else showToast(APP.language==='bm'?'Akses ditolak.':'Access denied.','warning')">
            <td style="font-size:11px;white-space:nowrap">${i.ref_no||'-'}</td>
            <td style="font-size:12px;white-space:nowrap">${i.issue_date ? new Date(i.issue_date).toLocaleDateString('en-MY') : '-'}</td>
            <td style="text-align:right;white-space:nowrap">${formatRM(i.total)}</td>
            <td style="text-align:right;white-space:nowrap">${formatRM(i.paid_amt)}</td>
            <td style="text-align:right;white-space:nowrap">${formatRM(bal)}</td>
            <td><span class="badge ${badge}">${st||'-'}</span></td>
          </tr>`}).join('')}
          </tbody></table></div>`
      }'''

NEW_INV = '''      ${(invs||[]).length === 0
        ? `<div class="empty-state" style="padding:40px"><i class="ti ti-file-off"></i><p>${t.noInv}</p></div>`
        : `<div class="crm-detail-inv-cards">${(invs||[]).map(i=>{
            const st = String(i.status||'')
            const badge = st==='paid'?'badge-green':st==='partial'?'badge-yellow':st==='cancelled'?'badge-gray':'badge-red'
            return `<div class="crm-detail-inv-card" role="button" tabindex="0" onclick="if(canAccess('sales'))openPage('sales',{view:'inv-detail',id:'${i.id}'});else showToast(APP.language==='bm'?'Akses ditolak.':'Access denied.','warning')">
            <div class="crm-detail-inv-card-main"><span class="crm-detail-inv-ref">${i.ref_no||'-'}</span><span class="badge ${badge}">${st||'-'}</span></div>
            <div class="crm-detail-inv-card-amt">${formatRM(i.total)}</div>
            <div class="crm-detail-inv-card-meta">${i.issue_date ? new Date(i.issue_date).toLocaleDateString('en-MY') : '-'}</div>
          </div>`}).join('')}</div><div class="crm-detail-inv-table-wrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table class="crm-detail-inv-table" style="width:max-content;min-width:100%"><thead><tr><th>Ref</th><th>Date</th><th style="text-align:right">Total</th><th style="text-align:right">Paid</th><th style="text-align:right">Bal</th><th>Status</th></tr></thead><tbody>
          ${(invs||[]).map(i=>{
            const bal = Math.max(0, Number(i.total||0)-Number(i.paid_amt||0))
            const st = String(i.status||'')
            const badge = st==='paid'?'badge-green':st==='partial'?'badge-yellow':st==='cancelled'?'badge-gray':'badge-red'
            return `<tr style="cursor:pointer" onclick="if(canAccess('sales'))openPage('sales',{view:'inv-detail',id:'${i.id}'});else showToast(APP.language==='bm'?'Akses ditolak.':'Access denied.','warning')">
            <td style="font-size:11px;white-space:nowrap">${i.ref_no||'-'}</td>
            <td style="font-size:12px;white-space:nowrap">${i.issue_date ? new Date(i.issue_date).toLocaleDateString('en-MY') : '-'}</td>
            <td style="text-align:right;white-space:nowrap">${formatRM(i.total)}</td>
            <td style="text-align:right;white-space:nowrap">${formatRM(i.paid_amt)}</td>
            <td style="text-align:right;white-space:nowrap">${formatRM(bal)}</td>
            <td><span class="badge ${badge}">${st||'-'}</span></td>
          </tr>`}).join('')}
          </tbody></table></div>`
      }'''

CSS_BASE_MARKER = '.crm-detail-stats .crm-stat-short{display:none}\n.crm-detail-stats .crm-stat-full{display:block}'
CSS_BASE_INSERT = CSS_BASE_MARKER + '\n.crm-detail-inv-cards{display:none}'

CSS_MOBILE_MARKER = '''  .crm-detail-stats .crm-stat-full { display: none !important; }
  .crm-detail-stats .crm-stat-short { display: block !important; }
  /* SOA method/notes: ellipsis + tap to expand */'''

CSS_MOBILE_INSERT = '''  .crm-detail-stats .crm-stat-full { display: none !important; }
  .crm-detail-stats .crm-stat-short { display: block !important; }
  /* Customer detail: stack Info → Invoices; invoice card rows */
  .crm-detail-info-inv-scroll {
    overflow-x: visible !important;
    max-width: 100%;
  }
  .crm-detail-info-inv {
    display: grid !important;
    grid-template-columns: 1fr !important;
    min-width: 0 !important;
    width: 100% !important;
    gap: 12px !important;
  }
  .crm-detail-inv-table-wrap,
  .crm-detail-inv-table { display: none !important; }
  .crm-detail-inv-cards {
    display: flex !important;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }
  .crm-detail-inv-card {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 4px 12px;
    align-items: center;
    padding: 12px;
    min-height: 44px;
    border: 1px solid var(--border);
    border-radius: var(--radius, 10px);
    background: var(--bg);
    cursor: pointer;
    box-sizing: border-box;
  }
  .crm-detail-inv-card:active { opacity: 0.92; }
  .crm-detail-inv-card-main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex-wrap: wrap;
  }
  .crm-detail-inv-ref {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .crm-detail-inv-card-amt {
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    white-space: nowrap;
    justify-self: end;
  }
  .crm-detail-inv-card-meta {
    grid-column: 1 / -1;
    font-size: 11px;
    color: var(--text-3);
  }
  /* SOA method/notes: ellipsis + tap to expand */'''


def patch(html: str) -> str:
    if 'crm-detail-info-inv-scroll' not in html:
        if OLD_GRID_OPEN not in html:
            raise SystemExit('Info/Invoices grid open marker missing')
        html = html.replace(OLD_GRID_OPEN, NEW_GRID_OPEN, 1)

    if 'crm-detail-inv-cards' not in html or 'crm-detail-inv-card-amt' not in html:
        if OLD_INV not in html:
            raise SystemExit('Invoices list block missing')
        html = html.replace(OLD_INV, NEW_INV, 1)

    if '.crm-detail-inv-cards{display:none}' not in html:
        if CSS_BASE_MARKER not in html:
            raise SystemExit('css base marker missing')
        html = html.replace(CSS_BASE_MARKER, CSS_BASE_INSERT, 1)

    if '.crm-detail-info-inv {' not in html:
        if CSS_MOBILE_MARKER not in html:
            raise SystemExit('css mobile marker missing')
        html = html.replace(CSS_MOBILE_MARKER, CSS_MOBILE_INSERT, 1)

    return html


def main():
    paths = [Path('app/index.html'), Path('build/app/index.html')]
    changed = False
    for p in paths:
        if not p.exists():
            print('skip missing', p)
            continue
        raw = p.read_text()
        new = patch(raw)
        if new != raw:
            p.write_text(new)
            print('patched', p)
            changed = True
        else:
            print('unchanged', p)
    if not changed:
        # still OK if already applied
        print('no file content changes (already applied?)')
    # verify markers present
    html = Path('app/index.html').read_text()
    for needle in (
        'crm-detail-info-inv-scroll',
        'crm-detail-info-inv',
        'crm-detail-inv-cards',
        'crm-detail-inv-card',
        'crm-detail-inv-table-wrap',
        '.crm-detail-inv-cards{display:none}',
        'grid-template-columns: 1fr !important;',
    ):
        if needle not in html:
            raise SystemExit(f'verify fail: missing {needle}')
    print('verify OK')


if __name__ == '__main__':
    main()
