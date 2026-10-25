#!/usr/bin/env python3
"""One-shot patch: customer detail metric cards + SOA clip (idempotent)."""
from pathlib import Path
import sys

def patch(html: str) -> str:
    marker_base = '.stat-label{font-size:12px;color:var(--text-2);margin-top:2px}'
    insert_base = marker_base + '\n.crm-detail-stats .crm-stat-short{display:none}\n.crm-detail-stats .crm-stat-full{display:block}'
    if '.crm-detail-stats .crm-stat-short{display:none}' not in html:
        if marker_base not in html:
            raise SystemExit('base .stat-label marker missing')
        html = html.replace(marker_base, insert_base, 1)

    old_btn = '''  .page-header .crm-detail-actions .btn {
    flex: 1 1 calc(50% - 4px);
    min-height: 40px;
    justify-content: center;
    width: auto !important;
  }'''
    new_btn = '''  .page-header .crm-detail-actions .btn {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    min-height: 40px;
    justify-content: center;
    width: auto !important;
  }
  .page-header .crm-detail-actions .btn-primary {
    width: auto !important;
  }
  /* Customer detail metric cards: stack icon → amount → label; RM never wraps */
  .crm-detail-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 10px !important;
  }
  .crm-detail-stats .stat-card {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 8px !important;
    padding: 12px !important;
    min-width: 0 !important;
    overflow: hidden;
  }
  .crm-detail-stats .stat-icon {
    width: 36px !important;
    height: 36px !important;
    font-size: 18px !important;
  }
  .crm-detail-stats .stat-value {
    font-size: 15px !important;
    white-space: nowrap !important;
    line-height: 1.25 !important;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .crm-detail-stats .stat-label {
    font-size: 11px !important;
  }
  .crm-detail-stats .crm-stat-full { display: none !important; }
  .crm-detail-stats .crm-stat-short { display: block !important; }
  /* SOA method/notes: ellipsis + tap to expand */
  #soa-doc td.soa-clip {
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap !important;
    cursor: pointer;
  }
  #soa-doc td.soa-clip.soa-clip-open {
    max-width: none;
    white-space: normal !important;
    overflow: visible;
    text-overflow: unset;
  }'''
    if 'crm-detail-stats .stat-card' not in html:
        if old_btn not in html:
            raise SystemExit('crm-detail-actions .btn block missing')
        html = html.replace(old_btn, new_btn, 1)

    old_t = """  const t = APP.language==='bm' ? { back:'Senarai Pelanggan', edit:'Edit', invoices:'Invois', noInv:'Tiada invois', totalSpent:'Jumlah Dikutip', outstanding:'Tertunggak', lastOrder:'Pesanan Terakhir', created:'Ahli Sejak', subPay:'Bayaran Langganan', noSub:'Tiada bayaran langganan' }
    : { back:'Customer List', edit:'Edit', invoices:'Invoices', noInv:'No invoices', totalSpent:'Total Collected', outstanding:'Outstanding', lastOrder:'Last Order', created:'Member Since', subPay:'Subscription Payments', noSub:'No subscription payments' }"""
    new_t = """  const t = APP.language==='bm' ? { back:'Senarai Pelanggan', edit:'Edit', invoices:'Invois', noInv:'Tiada invois', totalSpent:'Jumlah Dikutip', outstanding:'Tertunggak', lastOrder:'Pesanan Terakhir', created:'Ahli Sejak', subPay:'Bayaran Langganan', noSub:'Tiada bayaran langganan', totalSpentShort:'Kutipan', outstandingShort:'Hutang', invoicesShort:'Invois', lastOrderShort:'Terakhir' }
    : { back:'Customer List', edit:'Edit', invoices:'Invoices', noInv:'No invoices', totalSpent:'Total Collected', outstanding:'Outstanding', lastOrder:'Last Order', created:'Member Since', subPay:'Subscription Payments', noSub:'No subscription payments', totalSpentShort:'Collected', outstandingShort:'Due', invoicesShort:'Invoices', lastOrderShort:'Last' }"""
    if "totalSpentShort:'Kutipan'" not in html:
        if old_t not in html:
            raise SystemExit('renderCustomerDetail i18n block missing')
        html = html.replace(old_t, new_t, 1)

    old_cards = """  <div style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:16px\">
    <div class=\"stat-card\"><div class=\"stat-icon green\"><i class=\"ti ti-cash\"></i></div><div><div class=\"stat-value\">${formatRM(totalSpent)}</div><div class=\"stat-label\">${t.totalSpent}</div></div></div>
    <div class=\"stat-card\"><div class=\"stat-icon red\"><i class=\"ti ti-alert-circle\"></i></div><div><div class=\"stat-value\">${formatRM(outstanding)}</div><div class=\"stat-label\">${t.outstanding}</div></div></div>
    <div class=\"stat-card\"><div class=\"stat-icon blue\"><i class=\"ti ti-file-invoice\"></i></div><div><div class=\"stat-value\">${(invs||[]).length}</div><div class=\"stat-label\">${t.invoices}</div></div></div>
    <div class=\"stat-card\"><div class=\"stat-icon yellow\"><i class=\"ti ti-calendar\"></i></div><div><div class=\"stat-value\" style=\"font-size:16px\">${lastOrder}</div><div class=\"stat-label\">${t.lastOrder}</div></div></div>
  </div>"""
    new_cards = """  <div class=\"crm-detail-stats\" style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:16px\">
    <div class=\"stat-card\"><div class=\"stat-icon green\"><i class=\"ti ti-cash\"></i></div><div style=\"min-width:0;width:100%\"><div class=\"stat-value\">${formatRM(totalSpent)}</div><div class=\"stat-label\"><span class=\"crm-stat-full\">${t.totalSpent}</span><span class=\"crm-stat-short\">${t.totalSpentShort}</span></div></div></div>
    <div class=\"stat-card\"><div class=\"stat-icon red\"><i class=\"ti ti-alert-circle\"></i></div><div style=\"min-width:0;width:100%\"><div class=\"stat-value\">${formatRM(outstanding)}</div><div class=\"stat-label\"><span class=\"crm-stat-full\">${t.outstanding}</span><span class=\"crm-stat-short\">${t.outstandingShort}</span></div></div></div>
    <div class=\"stat-card\"><div class=\"stat-icon blue\"><i class=\"ti ti-file-invoice\"></i></div><div style=\"min-width:0;width:100%\"><div class=\"stat-value\">${(invs||[]).length}</div><div class=\"stat-label\"><span class=\"crm-stat-full\">${t.invoices}</span><span class=\"crm-stat-short\">${t.invoicesShort}</span></div></div></div>
    <div class=\"stat-card\"><div class=\"stat-icon yellow\"><i class=\"ti ti-calendar\"></i></div><div style=\"min-width:0;width:100%\"><div class=\"stat-value\" style=\"font-size:16px\">${lastOrder}</div><div class=\"stat-label\"><span class=\"crm-stat-full\">${t.lastOrder}</span><span class=\"crm-stat-short\">${t.lastOrderShort}</span></div></div></div>
  </div>"""
    if 'crm-stat-short">${t.totalSpentShort}' not in html:
        if old_cards not in html:
            raise SystemExit('metric cards block missing')
        html = html.replace(old_cards, new_cards, 1)

    old_pay = """            <td style=\"padding:9px 10px;white-space:nowrap\">${_aiEscapeHtml(methodLabel(p.payment_method))}</td>
            <td style=\"padding:9px 10px;color:var(--text-3);white-space:nowrap\">${_aiEscapeHtml(p.notes||'')}</td>"""
    new_pay = """            <td class=\"soa-clip\" style=\"padding:9px 10px;white-space:nowrap\" title=\"${_aiEscapeHtml(methodLabel(p.payment_method))}\" onclick=\"this.classList.toggle('soa-clip-open')\">${_aiEscapeHtml(methodLabel(p.payment_method))}</td>
            <td class=\"soa-clip\" style=\"padding:9px 10px;color:var(--text-3);white-space:nowrap\" title=\"${_aiEscapeHtml(p.notes||'')}\" onclick=\"if(this.getAttribute('title'))this.classList.toggle('soa-clip-open')\">${_aiEscapeHtml(p.notes||'')}</td>"""
    if 'td class="soa-clip"' not in html:
        if old_pay not in html:
            raise SystemExit('SOA pay method/notes cells missing')
        html = html.replace(old_pay, new_pay, 1)

    return html

def main():
    paths = [Path('app/index.html'), Path('build/app/index.html')]
    for p in paths:
        if not p.exists():
            raise SystemExit(f'missing {p}')
        before = p.read_text(encoding='utf-8')
        after = patch(before)
        if after == before:
            print(f'{p}: already patched')
        else:
            p.write_text(after, encoding='utf-8')
            print(f'{p}: patched (+{len(after)-len(before)} bytes)')
        for needle in ['crm-detail-stats', "totalSpentShort:'Collected'", 'td class="soa-clip"', 'crm-detail-stats .stat-card']:
            if needle not in after:
                raise SystemExit(f'{p}: missing {needle}')
    print('OK')

if __name__ == '__main__':
    main()
