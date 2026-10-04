#!/usr/bin/env python3
"""Patch only refreshCurrentPage() in app/index.html. Fail closed."""
from pathlib import Path

p = Path("app/index.html")
data = p.read_bytes()
if len(data) < 1000000:
    raise SystemExit("refusing: app/index.html is only %d bytes" % len(data))
text = data.decode("utf-8")
fn = "function refreshCurrentPage() {"
if text.count(fn) != 1:
    raise SystemExit("refusing: refreshCurrentPage() count is not 1")
fn_at = text.index(fn)
comment_start = fn_at
# Consume only the contiguous // comment lines directly above the function.
while True:
    prev_nl = text.rfind("\n", 0, comment_start - 1)
    prev = 0 if prev_nl < 0 else prev_nl + 1
    line = text[prev:comment_start].rstrip("\n")
    if line.startswith("//"):
        comment_start = prev
        if prev_nl < 0:
            break
        continue
    break
header = text[comment_start:fn_at]
if not header.startswith("// Header refresh button"):
    raise SystemExit("refusing: header comment missing above refreshCurrentPage")
if header.count("\n") != 3:
    raise SystemExit("refusing: unexpected comment line count above refreshCurrentPage: %d" % header.count("\n"))
end_marker = "\nfunction closeUserDropdown()"
end_at = text.find(end_marker, fn_at)
if end_at < 0:
    raise SystemExit("refusing: closeUserDropdown marker missing")
old = text[comment_start:end_at + 1]
if "openPage(APP.currentPage||'dashboard', lastParams)" not in old:
    raise SystemExit("refusing: expected openPage body not in refreshCurrentPage")
if "showToast(" not in old:
    raise SystemExit("refusing: expected toast body not in refreshCurrentPage")
new = """// Header refresh button - hard-reload this document so a new index.html
// (and its ?v= scripts) load. GitHub Pages caches HTML max-age=600, so
// location.reload() alone can still be stale. A cache-busting query is a
// different cache key. Keep path + hash; stay on this origin (relative URL).
function refreshCurrentPage() {
  const url = new URL(location.href)
  url.searchParams.set('_', String(Date.now()))
  location.replace(url.pathname + url.search + url.hash)
}
"""
if text.count(old) != 1:
    raise SystemExit("refusing: origin block not unique")
text2 = text.replace(old, new, 1)
body = text2.split(fn, 1)[1].split("function closeUserDropdown()", 1)[0]
if "openPage(" in body or "showToast(" in body or "reload(true)" in body:
    raise SystemExit("refusing: refreshCurrentPage body still re-renders or uses reload(true)")
if "location.replace(url.pathname + url.search + url.hash)" not in body:
    raise SystemExit("refusing: cache-bust reload line missing")
if text.replace(old, "", 1) != text2.replace(new, "", 1):
    raise SystemExit("refusing: patch changed bytes outside the function block")
out = text2.encode("utf-8")
if len(out) < 1000000:
    raise SystemExit("refusing: patched file is only %d bytes" % len(out))
p.write_bytes(out)
print("patched app/index.html %d -> %d bytes" % (len(data), len(out)))
