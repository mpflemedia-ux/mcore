#!/usr/bin/env python3
"""One-shot: Dashboard Card Shortcuts → chip/pill flex-wrap (idempotent)."""
from pathlib import Path

OLD_RETURN = '''  return `<div class="card" style="padding:8px;margin-bottom:14px" id="db-shortcuts">
    <div style="font-size:11px;font-weight:600;color:var(--text-3);margin:0 4px 6px;letter-spacing:.3px">${isBm?'PINTASAN KAD':'CARD SHORTCUTS'}</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm,8px);padding:4px">
      ${items.map(it => `<button type="button" class="btn btn-sm btn-outline" style="border:none;white-space:nowrap" onclick="_dbScrollToSec('${it.id}')"><i class="ti ${it.icon}"></i> ${isBm?it.bm:it.en}</button>`).join('')}
    </div>
  </div>`'''

NEW_RETURN = '''  return `<div class="card" style="padding:8px;margin-bottom:14px" id="db-shortcuts">
    <div style="font-size:11px;font-weight:600;color:var(--text-3);margin:0 4px 6px;letter-spacing:.3px">${isBm?'PINTASAN KAD':'CARD SHORTCUTS'}</div>
    <div class="dash-card-shortcuts">
      ${items.map(it => `<button type="button" class="dash-shortcut-chip" onclick="_dbScrollToSec('${it.id}')"><i class="ti ${it.icon}" aria-hidden="true"></i><span>${isBm?it.bm:it.en}</span></button>`).join('')}
    </div>
  </div>`'''

CSS_MARKER = '.db-btn.primary{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}'
CSS_INSERT = CSS_MARKER + '''
/* Dashboard Card Shortcuts — chip/pill wrap (scoped; do not restyle .btn / nav) */
.dash-card-shortcuts{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:8px;
  background:var(--bg);
  border:1px solid var(--border);
  border-radius:var(--radius-sm,8px);
  padding:8px;
  box-sizing:border-box;
}
.dash-shortcut-chip{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  min-height:40px;
  padding:8px 14px;
  border-radius:999px;
  border:1px solid var(--border);
  background:var(--bg-card);
  color:var(--text);
  font-size:12px;
  font-weight:600;
  line-height:1.2;
  white-space:nowrap;
  cursor:pointer;
  box-sizing:border-box;
  transition:border-color .15s,color .15s,background .15s;
  -webkit-tap-highlight-color:transparent;
}
.dash-shortcut-chip:hover,
.dash-shortcut-chip:focus-visible{
  border-color:var(--primary);
  color:var(--primary);
  background:color-mix(in srgb,var(--primary) 12%,transparent);
  outline:none;
}
.dash-shortcut-chip .ti{
  font-size:15px;
  flex-shrink:0;
  line-height:1;
}
.dash-shortcut-chip span{
  max-width:42vw;
  overflow:hidden;
  text-overflow:ellipsis;
}
@media (min-width:641px){
  .dash-shortcut-chip span{max-width:none}
}
'''


def patch(html: str) -> str:
    if 'dash-card-shortcuts' not in html or 'dash-shortcut-chip' not in html:
        if OLD_RETURN not in html:
            raise SystemExit('shortcuts return markup marker missing')
        html = html.replace(OLD_RETURN, NEW_RETURN, 1)

    if '.dash-card-shortcuts{' not in html:
        if CSS_MARKER not in html:
            raise SystemExit('css marker (.db-btn.primary) missing')
        # Only insert once — avoid double-insert if marker appears elsewhere
        html = html.replace(CSS_MARKER, CSS_INSERT, 1)

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
        print('no file content changes (already applied?)')
    html = Path('app/index.html').read_text()
    for needle in (
        'dash-card-shortcuts',
        'dash-shortcut-chip',
        '.dash-card-shortcuts{',
        'min-height:40px',
        "onclick=\"_dbScrollToSec('${it.id}')\"",
        "id=\"db-shortcuts\"",
    ):
        if needle not in html:
            raise SystemExit(f'verify fail: missing {needle}')
    # Ensure old btn-based shortcut markup is gone from the function return
    if 'btn btn-sm btn-outline" style="border:none;white-space:nowrap" onclick="_dbScrollToSec' in html:
        raise SystemExit('verify fail: old btn shortcut markup still present')
    print('verify OK')


if __name__ == '__main__':
    main()
