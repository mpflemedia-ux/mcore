#!/usr/bin/env python3
"""Bump app/crm-scan.js cache-bust query in app/index.html to v=2."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
ov = root / "app" / "crm-scan.js"
body = ov.read_text(encoding="utf-8")
if "CRM_SCAN_DOCUMENT_V2" not in body:
    print("ERROR: missing CRM_SCAN_DOCUMENT_V2 marker in app/crm-scan.js", file=sys.stderr)
    sys.exit(1)

idx_p = root / "app" / "index.html"
text = idx_p.read_text(encoding="utf-8")
tag = '<script src="./crm-scan.js?v=2"></script>'
new_text, n = re.subn(
    r'<script src="\./crm-scan\.js\?v=\d+"></script>',
    tag,
    text,
    count=1,
)
if n == 0:
    if "crm-scan.js" not in text:
        # inject before closing body if somehow missing
        anchor = "</body>"
        if anchor not in text:
            print("ERROR: no crm-scan.js tag and no </body>", file=sys.stderr)
            sys.exit(1)
        new_text = text.replace(anchor, tag + "\n" + anchor, 1)
        print("injected before </body>")
    else:
        print("ERROR: crm-scan.js present but tag pattern not matched", file=sys.stderr)
        sys.exit(1)
elif tag in text and n == 1 and text == new_text:
    print("already v=2")
    sys.exit(0)
else:
    print("bumped crm-scan.js cache-bust to v=2")

if new_text != text:
    idx_p.write_text(new_text, encoding="utf-8")
    print("wrote index.html")
else:
    print("no change")
