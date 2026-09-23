#!/usr/bin/env python3
"""Bake Settings Public booking shortcut into app/index.html (idempotent)."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'

OLD_ITEMS = """        {id:'stg-audit', en:'Audit Log', bm:'Log Audit'},
        {id:'stg-roles', en:'Role Permissions', bm:'Kebenaran Peranan'}"""
NEW_ITEMS = """        {id:'stg-audit', en:'Audit Log', bm:'Log Audit'},
        {id:'bk-settings-box', en:'Public booking', bm:'Booking awam'},
        {id:'stg-roles', en:'Role Permissions', bm:'Kebenaran Peranan'}"""

OLD_ICONS = """      'stg-backup':'ti-cloud-download', 'stg-fraud':'ti-shield-search', 'stg-audit':'ti-list-details',
      'stg-roles':'ti-user-shield'"""
NEW_ICONS = """      'stg-backup':'ti-cloud-download', 'stg-fraud':'ti-shield-search', 'stg-audit':'ti-list-details',
      'bk-settings-box':'ti-calendar-plus', 'stg-roles':'ti-user-shield'"""


def main():
    html = INDEX.read_text(encoding='utf-8')
    changed = False
    if "id:'bk-settings-box'" not in html and OLD_ITEMS in html:
        html = html.replace(OLD_ITEMS, NEW_ITEMS, 1)
        changed = True
    if "'bk-settings-box':'ti-calendar-plus'" not in html and OLD_ICONS in html:
        html = html.replace(OLD_ICONS, NEW_ICONS, 1)
        changed = True
    for path, ver in [('booking.js', '2'), ('booking-settings-ui.js', '2'), ('employee-probation.js', '3')]:
        html2, n = re.subn(
            rf'(<script src="\./{re.escape(path)}\?v=)\d+(">\</script>)',
            rf'\g<1>{ver}\g<2>',
            html,
            count=1,
        )
        if n and html2 != html:
            html = html2
            changed = True
    if changed:
        INDEX.write_text(html, encoding='utf-8')
        print('patched', INDEX)
    else:
        print('already patched')


if __name__ == '__main__':
    main()
