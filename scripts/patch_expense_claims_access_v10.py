#!/usr/bin/env python3
"""v10 Expense Claims bake orchestrator — assembles scripts/v10_bake_parts then runs."""
from pathlib import Path
import runpy
parts_dir = Path(__file__).resolve().parent / "v10_bake_parts"
parts = sorted(parts_dir.glob("part_*.txt"))
if not parts:
    raise SystemExit("missing scripts/v10_bake_parts/part_*.txt")
code = "".join(p.read_text(encoding="utf-8") for p in parts)
assembled = Path(__file__).resolve().parent / "_v10_bake_assembled.py"
assembled.write_text(code, encoding="utf-8")
try:
    runpy.run_path(str(assembled), run_name="__main__")
finally:
    try:
        assembled.unlink()
    except OSError:
        pass
