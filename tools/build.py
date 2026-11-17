#!/usr/bin/env python3
"""Baut aus src/app.html zwei Varianten:
   dist/         eigenständige Web-Version (GitHub Pages, Android-App, Surface)
   dist-claude/  Claude-Artefakt mit Export-Funktion
Aufruf: python3 tools/build.py
"""
import json, pathlib, re, shutil

R = pathlib.Path(__file__).resolve().parent.parent
SRC = (R / 'src' / 'app.html').read_text(encoding='utf-8')
MENU_ANCHOR = '<li data-k="src" role="button" tabindex="0"><b>Datenquellen und Fehlerprotokoll</b>'


def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'{n}x statt {count}x: {old[:70]}'
    return s.replace(old, new)


SW = r"""/* WattsUp Offline: Netz zuerst, bei Funkloch die zuletzt geladene Fassung */
const C = 'wattsup-__BID__';
const CORE = ['./', 'index.html', 'shim.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(CORE).catch(() => {}))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('wattsup-') && k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('build.json')) return;
  e.respondWith((async () => {
    try {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 6000);
      const res = await fetch(r, { signal: ctl.signal, cache: 'no-cache' }); clearTimeout(tm);
      if (res.ok) { const c = await caches.open(C); c.put(r.mode === 'navigate' ? 'index.html' : r, res.clone()); }
      return res;
    } catch (err) {
      const c = await caches.open(C);
      const hit = r.mode === 'navigate' ? (await c.match('index.html')) || (await c.match('./')) : await c.match(r, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
"""


def web():
    s = SRC
    import hashlib
    hv = hashlib.sha1((R / 'web' / 'shim.js').read_bytes()).hexdigest()[:10]
    head = ('<meta http-equiv="Cache-Control" content="no-cache">\n<link rel="manifest" href="manifest.webmanifest">\n'
            f'<script src="shim.js?v={hv}"></script>\n')
    s = rep(s, '<title>WattsUp</title>', '<title>WattsUp</title>\n' + head)
    # Menü: Morgengefühl, Gewicht, Einstellungen (alles Weitere im Einstellungs-Hub)
    i0 = s.index('<li data-k="zon" role="button" tabindex="0">')
    i1 = s.index('</ul><p class="mu" style="margin-top:14px">WattsUp, Version', i0)
    s = s[:i0] + ('<li data-k="wt" role="button" tabindex="0"><b>Gewicht eintragen</b><span>Kommt sonst automatisch von der Waage</span></li>'
                  '<li data-k="ski" role="button" tabindex="0"><b>Skitouren</b><span>Vorschläge fürs Wochenende</span></li>'
                  '<li data-k="wu" role="button" tabindex="0"><b>Einstellungen</b><span>Training, Verbindungen, Kosten, Benachrichtigungen</span></li>') + s[i1:]
    s = s.replace('in den claude.ai-Einstellungen unter Connectors', 'im Menü unter Einstellungen')
    s = s.replace('in claude.ai unter Connectors', 'im Menü unter Einstellungen')
    s = s.replace('AccuWeather für Salzburg, Stand ', 'Open-Meteo für Salzburg, Stand ')
    s = s.replace('AccuWeather, Stand ', 'Open-Meteo, Stand ')
    s = re.sub(r'WattsUp, Version (\d+)\.', r'WattsUp, Version \1, eigenständig.', s)
    s = s.replace('</head>', '<script>if("serviceWorker"in navigator)addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})</script>\n</head>', 1)
    d = R / 'dist'
    if d.exists():
        shutil.rmtree(d)
    d.mkdir()
    bid = hashlib.sha1(s.encode('utf-8')).hexdigest()[:12]
    s = s.replace('<meta http-equiv="Cache-Control" content="no-cache">', f'<meta http-equiv="Cache-Control" content="no-cache">\n<meta name="wu-build" content="{bid}">', 1)
    (d / 'build.json').write_text(json.dumps({'b': bid}), encoding='utf-8')
    (d / 'index.html').write_text(s, encoding='utf-8')
    for f in ['shim.js', 'datenschutz.html', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png']:
        shutil.copy(R / 'web' / f, d / f)
    (d / 'manifest.webmanifest').write_text(json.dumps({
        'name': 'WattsUp', 'short_name': 'WattsUp', 'start_url': './', 'scope': './',
        'display': 'standalone', 'background_color': '#0f2236', 'theme_color': '#0f2236', 'lang': 'de',
        'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                  {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                  {'src': 'icon.svg', 'sizes': 'any', 'type': 'image/svg+xml'}]}, ensure_ascii=False, indent=1), encoding='utf-8')
    (d / 'sw.js').write_text(SW.replace('__BID__', bid), encoding='utf-8')
    (d / '.nojekyll').write_text('')
    print('dist/ fertig', len(s))


def claude():
    s = SRC
    s = rep(s, MENU_ANCHOR, '<li data-k="wux" role="button" tabindex="0"><b>Daten für WattsUp exportieren</b>'
            '<span>Für die Android- und Browser-Version</span></li>' + MENU_ANCHOR)
    js = (R / 'web' / 'export-claude.js').read_text(encoding='utf-8')
    i = s.rfind('</body>')
    s = s[:i] + '<script>' + js + '</script>\n' + s[i:]
    d = R / 'dist-claude'
    d.mkdir(exist_ok=True)
    (d / 'index.html').write_text(s, encoding='utf-8')
    print('dist-claude/ fertig', len(s))


if __name__ == '__main__':
    web()
    claude()
