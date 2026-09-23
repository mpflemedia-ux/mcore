#!/usr/bin/env python3
"""Bake SW register: no controllerchange auto-reload; bump sw.js?v= (idempotent)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'app' / 'index.html'

OLD = """if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    // When a new SW takes control, reload once so invite/register fixes apply without Incognito
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if(refreshing) return
      refreshing = true
      try { location.reload() } catch(e) {}
    })
    navigator.serviceWorker.register('./sw.js?v=12').then(reg=>{
      try { reg.update() } catch(e) {}
      caches.keys().then(keys =>
        keys.filter(k => k.startsWith('nexerp-shell-') && k !== 'nexerp-shell-v4')
            .forEach(k => caches.delete(k))
      ).catch(()=>{})
      // Force check for updates periodically while tab open
      try { setInterval(() => { try { reg.update() } catch(e) {} }, 60 * 1000) } catch(e) {}
    }).catch(err=>console.warn('SW register failed',err))
  })
}"""

NEW = """if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    // No auto-reload on SW claim (that forced a second full load / blank first paint).
    // Pass-through SW (v38+) streams index.html; no HTML re-buffer needed.
    navigator.serviceWorker.register('./sw.js?v=13').then(reg=>{
      try { reg.update() } catch(e) {}
      caches.keys().then(keys =>
        keys.filter(k => k.startsWith('nexerp-shell-') && k !== 'nexerp-shell-v4')
            .forEach(k => caches.delete(k))
      ).catch(()=>{})
      try { setInterval(() => { try { reg.update() } catch(e) {} }, 60 * 1000) } catch(e) {}
    }).catch(err=>console.warn('SW register failed',err))
  })
}"""


def main():
    html = INDEX.read_text(encoding='utf-8')
    if "./sw.js?v=13" in html and "addEventListener('controllerchange'" not in html:
        print('already patched')
        return
    if OLD not in html:
        if "./sw.js?v=13" in html:
            print('already patched (variant)')
            return
        raise SystemExit('SW register block not found; refuse to bake')
    INDEX.write_text(html.replace(OLD, NEW, 1), encoding='utf-8')
    print('patched', INDEX)


if __name__ == '__main__':
    main()
