#!/usr/bin/env python3
"""Patch app/index.html for OT approve→payroll resync (idempotent)."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'

SCRIPT_MARK = 'ot-payroll-resync.js?v=1'
SCRIPT_TAG = '<script src="./ot-payroll-resync.js?v=1"></script>'
# Insert after payslip-pay-date so we wrap after statutory + pay-date wraps
ANCHOR_SCRIPT = '<script src="./payslip-pay-date.js?v=1"></script>'

OLD_GRAND = """  const grandTotal = data.reduce((s,r) => {
    const totalAllowance = Number(r.allowance_1||0)+Number(r.allowance_2||0)+Number(r.allowance_3||0)
    const totalDeduction = Number(r.advance||0)+Number(r.deduction_1||0)+Number(r.deduction_2||0)
    return s + Number(r.basic_salary||0) + totalAllowance + Number(r.commission||0) - Number(r.epf_employee||0) - Number(r.socso_employee||0) - Number(r.eis_employee||0) - Number(r.pcb||0) - Number(r.zakat||0) - totalDeduction
  }, 0)"""

NEW_GRAND = """  const grandTotal = data.reduce((s,r) => {
    const totalAllowance = Number(r.allowance_1||0)+Number(r.allowance_2||0)+Number(r.allowance_3||0)
    const totalDeduction = Number(r.advance||0)+Number(r.deduction_1||0)+Number(r.deduction_2||0)
    return s + Number(r.basic_salary||0) + totalAllowance + Number(r.commission||0) + Number(r.ot_amount||0) - Number(r.epf_employee||0) - Number(r.socso_employee||0) - Number(r.eis_employee||0) - Number(r.pcb||0) - Number(r.zakat||0) - totalDeduction
  }, 0)"""

OLD_MONTH_END = "    const monthEnd = new Date(year, month, 0).toISOString().slice(0,10)"
NEW_MONTH_END = "    const monthEnd = (typeof _dbFmtYMD === 'function') ? _dbFmtYMD(new Date(year, month, 0)) : (year + '-' + String(month).padStart(2,'0') + '-' + String(new Date(year, month, 0).getDate()).padStart(2,'0'))"

# Always persist ot_amount (0 when none) — was only set when > 0
OLD_OT_APPLY = "    if(otAmount > 0) { calc.ot_amount = otAmount; calc.net_pay = Math.round((calc.net_pay + otAmount) * 100) / 100; otTotal += otAmount }"
NEW_OT_APPLY = "    calc.ot_amount = otAmount; if(otAmount > 0) { calc.net_pay = Math.round((calc.net_pay + otAmount) * 100) / 100; otTotal += otAmount }"

def main():
    if not INDEX.exists():
        print('ERROR: missing', INDEX, file=sys.stderr); sys.exit(1)
    html = INDEX.read_text(encoding='utf-8')
    changed = []

    if SCRIPT_MARK not in html:
        if ANCHOR_SCRIPT not in html:
            print('ERROR: script anchor missing', file=sys.stderr); sys.exit(1)
        html = html.replace(ANCHOR_SCRIPT, ANCHOR_SCRIPT + '\n' + SCRIPT_TAG, 1)
        changed.append('script')
    else:
        print('script already present')

    if '+ Number(r.ot_amount||0) - Number(r.epf_employee||0)' in html and 'grandTotal = data.reduce' in html:
        # already has ot in grandTotal near SD — check the specific SD block
        if OLD_GRAND in html:
            html = html.replace(OLD_GRAND, NEW_GRAND, 1)
            changed.append('grandTotal')
        else:
            print('grandTotal already patched or pattern drifted')
    elif OLD_GRAND in html:
        html = html.replace(OLD_GRAND, NEW_GRAND, 1)
        changed.append('grandTotal')
    else:
        print('WARN: grandTotal pattern not found', file=sys.stderr)

    if OLD_MONTH_END in html:
        html = html.replace(OLD_MONTH_END, NEW_MONTH_END, 1)
        changed.append('monthEnd')
    elif 'monthEnd = (typeof _dbFmtYMD' in html:
        print('monthEnd already patched')
    else:
        print('WARN: monthEnd pattern not found', file=sys.stderr)

    if OLD_OT_APPLY in html:
        html = html.replace(OLD_OT_APPLY, NEW_OT_APPLY, 1)
        changed.append('ot_amount always')
    elif 'calc.ot_amount = otAmount; if(otAmount > 0)' in html:
        print('ot_amount always already patched')
    else:
        print('WARN: ot apply pattern not found', file=sys.stderr)

    INDEX.write_text(html, encoding='utf-8')
    print('patched:', changed or ['noop checks only'])

if __name__ == '__main__':
    main()
