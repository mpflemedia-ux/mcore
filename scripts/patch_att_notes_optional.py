#!/usr/bin/env python3
"""Bake: attendance Notes never required (idempotent).

Removes the _attendanceSave field-notes validation gate so Save never fails
for empty notes, even if tenant policy.require_field_notes is still true.
Also flips _attLoadPolicy default require_field_notes to false.

GitHub Actions checks out main, runs this, commits, pushes main.
Never push the full ~2MB index.html via API — use this bake only.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'

# Current main toast gate
OLD_GATE = (
    "  if(workMode === 'field' && policy.require_field_notes !== false && notes.length < 3) {\n"
    "    showToast(isBm?'Field: catatan pelanggan/lokasi/tujuan wajib':'Field: customer/location/purpose notes required', 'error')\n"
    "    return\n"
    "  }\n"
)

# If UX bake already ran, toast text differs — still remove entire gate
OLD_GATE_UX = (
    "  if(workMode === 'field' && policy.require_field_notes !== false && notes.length < 3) {\n"
    "    if(typeof _attSyncNotesUi === 'function') _attSyncNotesUi('field')\n"
    "    try { document.getElementById('att-notes')?.focus() } catch(_fnE) {}\n"
    "    showToast(isBm?'Field / WFH: isi catatan pelanggan, lokasi atau tujuan (min 3 aksara)':'Field / WFH: enter customer, location or purpose notes (min 3 characters)', 'error')\n"
    "    return\n"
    "  }\n"
)

OLD_DEFAULT = 'require_field_notes: true,'
NEW_DEFAULT = 'require_field_notes: false,'

# Regex fallback: any require_field_notes + notes.length < 3 gate block
GATE_RE = re.compile(
    r"  if\(workMode === 'field' && policy\.require_field_notes !== false && notes\.length < 3\) \{.*?\n  \}\n",
    re.DOTALL,
)


def main():
    if not INDEX.exists():
        print('ERROR: missing', INDEX, file=sys.stderr)
        sys.exit(1)
    html = INDEX.read_text(encoding='utf-8')
    changed = False

    # 1) Remove validation gate (exact then regex)
    if OLD_GATE in html:
        html = html.replace(OLD_GATE, '', 1)
        changed = True
        print('removed field-notes gate (legacy toast)')
    elif OLD_GATE_UX in html:
        html = html.replace(OLD_GATE_UX, '', 1)
        changed = True
        print('removed field-notes gate (UX toast)')
    else:
        m = GATE_RE.search(html)
        if m:
            html = html[:m.start()] + html[m.end():]
            changed = True
            print('removed field-notes gate (regex fallback)')
        elif 'notes.length < 3' not in html and 'customer/location/purpose notes required' not in html:
            print('gate already absent')
        else:
            print('ERROR: gate pattern not matched but notes.length < 3 still present', file=sys.stderr)
            sys.exit(1)

    # 2) Flip default require_field_notes
    if OLD_DEFAULT in html:
        # Only flip the policy defaults object occurrence(s)
        html = html.replace(OLD_DEFAULT, NEW_DEFAULT)
        changed = True
        print('default require_field_notes -> false')
    elif NEW_DEFAULT in html:
        print('default already false')
    else:
        print('WARNING: require_field_notes default literal not found', file=sys.stderr)

    # Sanity: Save must not still block on notes length
    if 'notes.length < 3' in html:
        print('ERROR: notes.length < 3 still present after patch', file=sys.stderr)
        sys.exit(1)
    if 'customer/location/purpose notes required' in html:
        print('ERROR: required-notes toast string still present', file=sys.stderr)
        sys.exit(1)

    if not changed:
        print('already applied')
        sys.exit(0)

    INDEX.write_text(html, encoding='utf-8')
    print('OK: wrote', INDEX)


if __name__ == '__main__':
    main()
