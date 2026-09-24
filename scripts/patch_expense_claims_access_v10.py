#!/usr/bin/env python3
from pathlib import Path
import runpy
d = Path(__file__).resolve().parent / "_v10_chunks"
code = "".join(p.read_text(encoding="utf-8") for p in sorted(d.glob("*.txt")))
assembled = Path(__file__).resolve().parent / "_v10_bake_assembled.py"
assembled.write_text(code, encoding="utf-8")
try:
    runpy.run_path(str(assembled), run_name="__main__")
finally:
    try: assembled.unlink()
    except OSError: pass
