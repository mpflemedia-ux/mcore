#!/usr/bin/env python3
"""Bake RBAC least-privilege patches into app/index.html (idempotent).

GitHub Actions checks out main, runs this, commits, pushes main.
Never push the full ~2MB index.html via API — use this bake only.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'
RP_VER = '4'


def gate_button(html: str, find_onclick: str, module: str) -> tuple[str, bool]:
    """Wrap the <button>…</button> containing find_onclick with canDelete(module)."""
    idx = 0
    while True:
        idx = html.find(find_onclick, idx)
        if idx < 0:
            return html, False
        start = html.rfind('<button', max(0, idx - 250), idx)
        if start < 0:
            idx += len(find_onclick)
            continue
        pre = html[max(0, start - 100):start]
        if 'canDelete(' in pre:
            return html, False
        end = html.find('</button>', idx)
        if end < 0:
            return html, False
        end += len('</button>')
        line_start = html.rfind('\n', 0, start) + 1
        indent = html[line_start:start]
        btn = html[start:end]
        # Nested template literal: ${expr} inside still evaluates in JS; keep escapes as-is
        gated = f"{indent}${{(typeof canDelete==='function'&&canDelete('{module}'))?`{btn}`:''}}"
        return html[:line_start] + gated + html[end:], True


def main():
    html = INDEX.read_text(encoding='utf-8')
    changed = False
    notes = []

    if "module === 'vouchers' && mods.includes('accounting')" in html:
        html2, n = re.subn(
            r"[ \t]*if \(module === 'vouchers' && mods\.includes\('accounting'\)\) return true\n",
            '',
            html,
            count=1,
        )
        if not n:
            raise SystemExit('vouchers implication present but regex miss; refuse')
        html = html2
        changed = True
        notes.append('removed vouchers←accounting canAccess implication')
    else:
        notes.append('vouchers implication already absent')

    for needle, mod, label in [
        ('onclick="_crmDelete(', 'crm', 'CRM'),
        ('onclick="_invoiceDelete(', 'sales', 'invoice'),
        ('onclick="event.stopPropagation();_quoDelete(', 'sales', 'quotation'),
    ]:
        html2, did = gate_button(html, needle, mod)
        if did:
            html = html2
            changed = True
            notes.append(f'gated {label} delete button')
        else:
            notes.append(f'{label} delete already gated or missing')

    html2, n = re.subn(
        r'(<script src="\./role-permissions-sync\.js\?v=)\d+("><\/script>)',
        rf'\g<1>{RP_VER}\g<2>',
        html,
        count=1,
    )
    if n and html2 != html:
        html = html2
        changed = True
        notes.append(f'bumped role-permissions-sync.js?v={RP_VER}')
    elif f'role-permissions-sync.js?v={RP_VER}' in html:
        notes.append(f'script already v={RP_VER}')
    else:
        notes.append('WARN: role-permissions-sync script tag not found')

    if changed:
        INDEX.write_text(html, encoding='utf-8')
        print('patched', INDEX)
    else:
        print('already patched')
    for n in notes:
        print('-', n)


if __name__ == '__main__':
    main()
