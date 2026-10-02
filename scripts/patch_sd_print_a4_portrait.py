#!/usr/bin/env python3
"""Bake SD print A4-portrait compact _sdRowHtml. Idempotent.

Scope ONLY: app/index.html — const _sdRowHtml inside renderSalaryDisbursement,
plus cache-bust bumps for sd-employer-edit.js / sd-print-fit.js.

Does NOT touch: global/print CSS unrelated, sidebar, openPage, PVD,
wrap/overlay, CREATE OR REPLACE SQL, sd-table-fit.js.
"""
from pathlib import Path
import re
import base64
import gzip

INDEX = Path("app/index.html")
FRAG = Path("scripts/sd_print_a4_rowhtml.fragment.js")
FRAG_B64 = Path("scripts/sd_print_a4_rowhtml.fragment.js.gz.b64")

MARKER_START = "const _sdRowHtml = (r, i) => {"
MARKER_END = "let _sdTables = ''"


def load_fragment():
    if FRAG.exists():
        return FRAG.read_text(encoding="utf-8")
    if FRAG_B64.exists():
        raw = base64.b64decode(FRAG_B64.read_text(encoding="ascii").strip())
        return gzip.decompress(raw).decode("utf-8")
    raise SystemExit("fragment not found")


def main():
    html = INDEX.read_text(encoding="utf-8")
    if "sd-print-allow-dense-" in html and "sd-print-fit.js?v=2" in html and "sd-employer-edit.js?v=7" in html:
        print("already patched")
        return
    start = html.find(MARKER_START)
    if start < 0:
        raise SystemExit("marker not found: _sdRowHtml")
    fn = html.rfind("async function renderSalaryDisbursement", 0, start)
    if fn < 0:
        raise SystemExit("refused: _sdRowHtml not under renderSalaryDisbursement")
    end = html.find(MARKER_END, start)
    if end < 0:
        raise SystemExit("marker not found: let _sdTables")
    between = html[start:end]
    if between.count("const _sdRowHtml") != 1:
        raise SystemExit("expected exactly one _sdRowHtml in span")
    if "_pvdDocHtml" in between or "pvd-four-roles" in between:
        raise SystemExit("refused: PVD markers in span")
    new_body = load_fragment()
    if not new_body.startswith("const _sdRowHtml"):
        raise SystemExit("fragment missing _sdRowHtml header")
    html2 = html[:start] + new_body + "\n      " + html[end:]
    html2, n1 = re.subn(r'(sd-employer-edit\.js\?v=)\d+', r'\g<1>7', html2, count=1)
    html2, n2 = re.subn(r'(sd-print-fit\.js\?v=)\d+', r'\g<1>2', html2, count=1)
    if n1 != 1:
        raise SystemExit("failed to bump sd-employer-edit.js version")
    if n2 != 1:
        raise SystemExit("failed to bump sd-print-fit.js version")
    if "pvd-four-roles.js" in html2 and "pvd-four-roles.js" not in html:
        raise SystemExit("refused: would introduce pvd-four-roles.js load")
    INDEX.write_text(html2, encoding="utf-8")
    print("patched _sdRowHtml (dense print + hide empty) and bumped sd-employer-edit?v=7 sd-print-fit?v=2")


if __name__ == "__main__":
    main()
