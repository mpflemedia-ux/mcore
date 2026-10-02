#!/usr/bin/env python3
"""Bake booking hold-minutes script cachebust into app/index.html (idempotent)."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'

# path -> desired ?v=
BUMPS = {
    'booking.js': '2',
    'booking-settings-ui.js': '2',
    'booking-free-confirm.js': '3',
}


def main():
    html = INDEX.read_text(encoding='utf-8')
    changed = False
    for path, ver in BUMPS.items():
        html2, n = re.subn(
            rf'(<script src="\./{re.escape(path)}\?v=)\d+(">)',
            rf'\g<1>{ver}\2',
            html,
            count=1,
        )
        if n and html2 != html:
            html = html2
            changed = True
            print(f'bumped {path} -> v={ver}')
    if changed:
        INDEX.write_text(html, encoding='utf-8')
        print('patched', INDEX)
    else:
        print('already patched')


if __name__ == '__main__':
    main()
