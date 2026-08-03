#!/usr/bin/env node
// Scans app/index.html's inline <script> for JS Automatic Semicolon
// Insertion (ASI) hazards: a line that doesn't already end in an
// opener/operator (so it looks like a complete statement), immediately
// followed by a line starting with '[', '(', or a backtick. In that shape,
// JS does NOT insert a semicolon — it parses the next line as continuing
// the previous expression (e.g. `foo()\n['a','b'].forEach(...)` becomes
// `foo()['a','b'].forEach(...)`, indexing foo()'s return value with the
// comma operator's last value, and throwing if that return value is
// undefined).
//
// This exact bug hit _sdPreparePrint() TWICE (PR #74, then again in PR #75
// when a new line was added before the array literal without a trailing
// semicolon) — both times it passed a plain syntax check because the code
// IS valid JS, just semantically wrong. Run this before pushing any change
// to app/index.html:
//   node scripts/check-asi-hazards.js
//
// Zero dependencies, no build step — matches this repo's plain-file setup.

const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '..', 'app', 'index.html')
const html = fs.readFileSync(filePath, 'utf8')

const scriptStart = html.search(/<script(?![^>]*\bsrc=)[^>]*>/)
const scriptTagEnd = html.indexOf('>', scriptStart) + 1
const scriptEnd = html.lastIndexOf('</script>')
const js = html.slice(scriptTagEnd, scriptEnd)
const lines = js.split('\n')

let hits = 0
for (let i = 0; i < lines.length - 1; i++) {
  const cur = lines[i].trimEnd()
  const next = lines[i + 1].trimStart()
  if (!cur) continue
  if (/^\/\//.test(cur.trim())) continue
  // Safe if the current line already signals continuation.
  if (/[;{},(\[+\-*/%<>=!&|?:~^]$/.test(cur)) continue
  // The real hazard: next line opens with '[', '(', or a backtick with no
  // leading operator.
  if (/^[[(`]/.test(next)) {
    hits++
    console.log(`app/index.html:${i + 1}: possible ASI hazard`)
    console.log(`  ${cur.slice(-70)}`)
    console.log(`  ${next.slice(0, 70)}`)
    console.log('')
  }
}

if (hits > 0) {
  console.log(`FAIL: ${hits} possible ASI hazard(s) found.`)
  process.exit(1)
} else {
  console.log('OK: no ASI hazards found.')
  process.exit(0)
}
