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


def web():
    s = SRC
    head = ('<link rel="manifest" href="manifest.webmanifest">\n'
            '<script src="shim.js"></script>\n')
    s = rep(s, '<title>WattsUp</title>', '<title>WattsUp</title>\n' + head)
    s = rep(s, MENU_ANCHOR, '<li data-k="wu" role="button" tabindex="0"><b>Verbindungen und Kosten</b>'
            '<span>Strava, Google, Claude-Schlüssel und Kosten der Planung</span></li>' + MENU_ANCHOR)
    s = s.replace('in den claude.ai-Einstellungen unter Connectors', 'im Menü unter Verbindungen und Kosten')
    s = s.replace('in claude.ai unter Connectors', 'im Menü unter Verbindungen und Kosten')
    s = s.replace('AccuWeather für Salzburg, Stand ', 'Open-Meteo für Salzburg, Stand ')
    s = s.replace('AccuWeather, Stand ', 'Open-Meteo, Stand ')
    s = re.sub(r'WattsUp, Version (\d+)\.', r'WattsUp, Version \1, eigenständig.', s)
    s = s.replace('</head>', '<script>if("serviceWorker"in navigator)addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})</script>\n</head>', 1)
    d = R / 'dist'
    if d.exists():
        shutil.rmtree(d)
    d.mkdir()
    (d / 'index.html').write_text(s, encoding='utf-8')
    for f in ['shim.js', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png']:
        shutil.copy(R / 'web' / f, d / f)
    (d / 'manifest.webmanifest').write_text(json.dumps({
        'name': 'WattsUp', 'short_name': 'WattsUp', 'start_url': './', 'scope': './',
        'display': 'standalone', 'background_color': '#0f2236', 'theme_color': '#0f2236', 'lang': 'de',
        'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                  {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                  {'src': 'icon.svg', 'sizes': 'any', 'type': 'image/svg+xml'}]}, ensure_ascii=False, indent=1), encoding='utf-8')
    (d / 'sw.js').write_text("self.addEventListener('install',e=>self.skipWaiting());"
                             "self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));"
                             "self.addEventListener('fetch',()=>{});\n", encoding='utf-8')
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
