#!/usr/bin/env python3
from pathlib import Path
import base64, runpy
d = Path(__file__).resolve().parent / "_v10_b64"
b64 = "".join(p.read_text() for p in sorted(d.glob("*.b64")))
code = base64.b64decode(b64).decode("utf-8")
assembled = Path(__file__).resolve().parent / "_v10_bake_assembled.py"
assembled.write_text(code, encoding="utf-8")
try:
    runpy.run_path(str(assembled), run_name="__main__")
finally:
    try: assembled.unlink()
    except OSError: pass
