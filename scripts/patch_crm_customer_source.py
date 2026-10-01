#!/usr/bin/env python3
"""Bake CRM Customer Source/Sumber into app/index.html.

Idempotent. Edits ONLY:
  - renderCustomerForm (i18n + #cf-source field)
  - _crmSave (payload.source)
  - _crmLoad (select + table column + i18n)
No detail/SOA, public form, crm-scan, global CSS, overlay JS.
"""
from pathlib import Path

INDEX = Path('app/index.html')

REPLACEMENTS = [
    # Form i18n BM
    (
        "    notes:'Nota', saving:'Menyimpan...'",
        "    notes:'Nota', source:'Sumber', saving:'Menyimpan...'",
    ),
    # Form i18n EN
    (
        "    notes:'Notes', saving:'Saving...'",
        "    notes:'Notes', source:'Source', saving:'Saving...'",
    ),
    # Form field before notes
    (
        """      <div class=\"form-group\" style=\"grid-column:1/-1\">
        <label class=\"form-label\">${t.notes}</label>
        <textarea id=\"cf-notes\" class=\"form-input\" rows=\"3\" style=\"resize:vertical\">${cust.notes||''}</textarea>
      </div>""",
        """      <div class=\"form-group\" style=\"grid-column:1/-1\">
        <label class=\"form-label\">${t.source||(APP.language==='bm'?'Sumber':'Source')}</label>
        <input id=\"cf-source\" type=\"text\" class=\"form-input\" value=\"${cust.source||''}\" placeholder=\"Ceonita, MIHAS, TikTok, meetup...\">
      </div>
      <div class=\"form-group\" style=\"grid-column:1/-1\">
        <label class=\"form-label\">${t.notes}</label>
        <textarea id=\"cf-notes\" class=\"form-input\" rows=\"3\" style=\"resize:vertical\">${cust.notes||''}</textarea>
      </div>""",
    ),
    # Save payload
    (
        "    notes: document.getElementById('cf-notes').value.trim()||null,",
        "    notes: document.getElementById('cf-notes').value.trim()||null,\n"
        "    source: document.getElementById('cf-source').value.trim()||null,",
    ),
    # List select
    (
        "sb.from('customers').select('id,name,email,phone,city,created_at', {count:'exact'})",
        "sb.from('customers').select('id,name,email,phone,city,source,created_at', {count:'exact'})",
    ),
    # List i18n BM (inside _crmLoad)
    (
        "{ add:'Tambah Pelanggan', noData:'Tiada pelanggan lagi', noResult:'Tiada hasil carian', name:'Nama', email:'Emel', phone:'Telefon', city:'Bandar', created:'Dicipta', edit:'Edit', view:'Lihat', del:'Padam', delConfirm:'Padam pelanggan ini?', prev:'Sebelum', next:'Seterusnya', of:'dari', records:'rekod' }",
        "{ add:'Tambah Pelanggan', noData:'Tiada pelanggan lagi', noResult:'Tiada hasil carian', name:'Nama', email:'Emel', phone:'Telefon', city:'Bandar', source:'Sumber', created:'Dicipta', edit:'Edit', view:'Lihat', del:'Padam', delConfirm:'Padam pelanggan ini?', prev:'Sebelum', next:'Seterusnya', of:'dari', records:'rekod' }",
    ),
    # List i18n EN (inside _crmLoad)
    (
        "{ add:'Add Customer', noData:'No customers yet', noResult:'No results found', name:'Name', email:'Email', phone:'Phone', city:'City', created:'Created', edit:'Edit', view:'View', del:'Delete', delConfirm:'Delete this customer?', prev:'Prev', next:'Next', of:'of', records:'records' }",
        "{ add:'Add Customer', noData:'No customers yet', noResult:'No results found', name:'Name', email:'Email', phone:'Phone', city:'City', source:'Source', created:'Created', edit:'Edit', view:'View', del:'Delete', delConfirm:'Delete this customer?', prev:'Prev', next:'Next', of:'of', records:'records' }",
    ),
    # Table header
    (
        "<th>${t.name}</th><th>${t.email}</th><th>${t.phone}</th><th>${t.city}</th><th>${t.created}</th><th style=\"width:120px\"></th>",
        "<th>${t.name}</th><th>${t.email}</th><th>${t.phone}</th><th>${t.city}</th><th>${t.source||(APP.language==='bm'?'Sumber':'Source')}</th><th>${t.created}</th><th style=\"width:120px\"></th>",
    ),
    # Table row cell (after city)
    (
        """        <td style=\"color:var(--text-2)\">${c.city||'-'}</td>
        <td style=\"color:var(--text-3);font-size:12px\">${c.created_at?new Date(c.created_at).toLocaleDateString('en-MY'):'-'}</td>""",
        """        <td style=\"color:var(--text-2)\">${c.city||'-'}</td>
        <td style=\"color:var(--text-2)\">${c.source||'-'}</td>
        <td style=\"color:var(--text-3);font-size:12px\">${c.created_at?new Date(c.created_at).toLocaleDateString('en-MY'):'-'}</td>""",
    ),
]


def main():
    html = INDEX.read_text(encoding='utf-8')
    if "id=\"cf-source\"" in html and "source,created_at" in html and "payload already" not in html:
        # Idempotent: all key markers present
        if all(
            (
                "source:'Sumber', saving:'Menyimpan...'" in html,
                "source:'Source', saving:'Saving...'" in html,
                "source: document.getElementById('cf-source')" in html,
                "${c.source||'-'}" in html,
            )
        ):
            print('already patched')
            return

    html2 = html
    applied = 0
    for old, new in REPLACEMENTS:
        if new in html2 and old not in html2:
            # this step already applied
            continue
        if old not in html2:
            raise SystemExit(f'marker not found:\n{old[:120]}...')
        html2 = html2.replace(old, new, 1)
        applied += 1

    if html2 == html:
        raise SystemExit('no changes applied')
    INDEX.write_text(html2, encoding='utf-8')
    print(f'patched CRM customer source ({applied} replacements)')


if __name__ == '__main__':
    main()
