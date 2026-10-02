#!/usr/bin/env python3
"""Bake PVD table column widths into _pvdDocHtml thead. Idempotent.

Scope ONLY: app/index.html function _pvdDocHtml — thead <th> widths for
No / Payee / Method / Bank-Ref / Purpose / Amount.

Mirrors Salary Disbursement _sdThead explicit % under .pdoc-sd-table
{ table-layout:fixed } so Bank/Ref and Purpose do not eat empty space.

Does NOT touch: .pdoc-sd-table CSS, sd-print-fit.js, sd-table-fit.js,
_pvdRenderLines, _pvdRefreshSigPrint / sigs, single PV, Salary Disbursement,
orphan pvd-four-roles.js, sidebar, openPage, global/print CSS, wrap/overlay.
"""
from pathlib import Path

INDEX = Path("app/index.html")

OLD = """        <th style=\"width:36px\">No</th>
        <th>${isBm?'Penerima':'Payee'}</th>
        <th>${isBm?'Kaedah':'Method'}</th>
        <th>${isBm?'Bank / Ruj':'Bank / Ref'}</th>
        <th>${isBm?'Tujuan':'Purpose'}</th>
        <th style=\"text-align:right\">${isBm?'Jumlah':'Amount'}</th>"""

NEW = """        <th style=\"width:36px\">No</th>
        <th style=\"width:30%\">${isBm?'Penerima':'Payee'}</th>
        <th style=\"width:11%\">${isBm?'Kaedah':'Method'}</th>
        <th style=\"width:17%\">${isBm?'Bank / Ruj':'Bank / Ref'}</th>
        <th style=\"width:24%\">${isBm?'Tujuan':'Purpose'}</th>
        <th style=\"width:13%;text-align:right\">${isBm?'Jumlah':'Amount'}</th>"""


def main():
    html = INDEX.read_text(encoding="utf-8")
    if NEW in html and OLD not in html:
        print("already patched")
        return
    if OLD not in html:
        raise SystemExit("marker not found: PVD thead th block")
    # Guard: only one occurrence, inside _pvdDocHtml
    if html.count(OLD) != 1:
        raise SystemExit("expected exactly one OLD thead marker, got %d" % html.count(OLD))
    idx = html.find(OLD)
    fn = html.find("function _pvdDocHtml")
    if fn < 0 or idx < fn or idx > fn + 8000:
        raise SystemExit("OLD marker not inside _pvdDocHtml")
    # Guard: never touch _sdThead
    if "function _sdThead" in html[fn:idx] or "_sdThead" in OLD:
        raise SystemExit("refused: would touch _sdThead")
    html2 = html.replace(OLD, NEW, 1)
    if "pvd-four-roles.js" in html2 and "pvd-four-roles.js" not in html:
        raise SystemExit("refused: would introduce pvd-four-roles.js load")
    INDEX.write_text(html2, encoding="utf-8")
    print("patched PVD col widths (No 36px / Payee 30% / Method 11% / Bank-Ref 17% / Purpose 24% / Amount 13%)")


if __name__ == "__main__":
    main()
