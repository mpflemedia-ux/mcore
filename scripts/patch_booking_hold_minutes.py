#!/usr/bin/env python3
"""Bake booking hold-minutes JS + cachebust into app/ (idempotent).

Chunks live on feat/booking-hold-minutes tip; bake may fetch them if missing on main.
"""
from pathlib import Path
import base64
import gzip
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'app'
INDEX = APP / 'index.html'
CHUNKS = Path(__file__).resolve().parent / '_booking_hold_chunks'

# Verified tip containing clean gzip chunks + SQL
CHUNK_REF = 'eaa3663a48ce6c91a3746bbf7a4bf0a0d6bc831c'
CHUNK_BASE = f'https://raw.githubusercontent.com/mpflemedia-ux/mcore/{CHUNK_REF}/scripts/_booking_hold_chunks'

FILES = [
    'booking.js',
    'booking-settings-ui.js',
    'booking-free-confirm.js',
]

BUMPS = {
    'booking.js': '2',
    'booking-settings-ui.js': '2',
    'booking-free-confirm.js': '3',
}

NEEDED = [
    'booking-free-confirm.js.gz.b64',
    'booking-settings-ui.js.gz.b64.n',
    'booking-settings-ui.js.gz.b64.part0',
    'booking-settings-ui.js.gz.b64.part1',
    'booking.js.gz.b64.n',
    'booking.js.gz.b64.part0',
    'booking.js.gz.b64.part1',
]


def ensure_chunks():
    CHUNKS.mkdir(parents=True, exist_ok=True)
    for name in NEEDED:
        path = CHUNKS / name
        if path.exists() and path.stat().st_size > 0:
            continue
        url = f'{CHUNK_BASE}/{name}'
        print('fetch', url)
        with urllib.request.urlopen(url, timeout=60) as resp:
            path.write_bytes(resp.read())


def load_js(name: str) -> str:
    single = CHUNKS / (name + '.gz.b64')
    if single.exists():
        b64 = ''.join(single.read_text(encoding='utf-8').split())
    else:
        n = int((CHUNKS / (name + '.gz.b64.n')).read_text(encoding='utf-8').strip())
        raw = ''.join((CHUNKS / f'{name}.gz.b64.part{i}').read_text(encoding='utf-8') for i in range(n))
        b64 = ''.join(raw.split())
    return gzip.decompress(base64.b64decode(b64.encode())).decode('utf-8')


def main():
    ensure_chunks()
    changed = False
    for name in FILES:
        new = load_js(name)
        path = APP / name
        old = path.read_text(encoding='utf-8') if path.exists() else None
        if old != new:
            path.write_text(new, encoding='utf-8')
            changed = True
            print('wrote', path)
        else:
            print('unchanged', path)
    html = INDEX.read_text(encoding='utf-8')
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
