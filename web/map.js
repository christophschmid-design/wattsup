/* WattsUp Karte: echte Karte mit Straße, Satellit und Topo, eingefärbter Strecke,
   Höhenprofil zum Scrubben, automatisch erkannten Anstiegen und Vollbild.
   Wird nur in der Web- und Android-Version geladen (nicht im Claude-Artefakt). */
(function () {
  'use strict';
  var LL = null;
  function loadLeaflet() {
    if (LL) return LL;
    LL = new Promise(function (ok, no) {
      if (window.L && window.L.map) return ok(window.L);
      var c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'vendor/leaflet/leaflet.css'; document.head.appendChild(c);
      var s = document.createElement('script'); s.src = 'vendor/leaflet/leaflet.js';
      s.onload = function () { ok(window.L); }; s.onerror = function () { LL = null; no(new Error('Karte konnte nicht geladen werden')); };
      document.head.appendChild(s);
    });
    return LL;
  }

  var CSS = [
    '.wm{margin:10px 0 4px}',
    '.wm-seg{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 8px}',
    '.wm-seg button{flex:1;min-width:0;border:0;border-radius:10px;padding:7px 4px;font:600 12.5px/1.1 inherit;background:var(--card2,rgba(127,127,127,.14));color:inherit;cursor:pointer}',
    '.wm-seg button.on{background:var(--acc,#1d6fe0);color:#fff}',
    '.wm-box{position:relative;height:300px;border-radius:14px;overflow:hidden;background:#dfe6ee}',
    '.wm-box .leaflet-control-attribution{font-size:9px}',
    '.wm-fs{position:absolute;right:8px;top:8px;z-index:500;border:0;border-radius:10px;width:36px;height:36px;background:rgba(15,34,54,.82);color:#fff;font-size:18px;cursor:pointer}',
    '.wm-hint{position:absolute;left:8px;bottom:8px;z-index:500;background:rgba(15,34,54,.78);color:#fff;font-size:11px;padding:4px 8px;border-radius:8px;pointer-events:none}',
    '.wm.full{position:fixed;inset:0;z-index:99999;margin:0;padding:calc(env(safe-area-inset-top,0px) + 8px) 10px calc(env(safe-area-inset-bottom,0px) + 8px);background:var(--bg,#0b1624);display:flex;flex-direction:column;overflow:auto}',
    '.wm.full>*{flex:none}',
    '.wm.full .wm-box{flex:1 1 auto;min-height:55vh}',
    '.wm-leg{display:flex;align-items:center;gap:8px;font-size:11.5px;margin:6px 2px 0;opacity:.85}',
    '.wm-leg i{flex:1;height:8px;border-radius:4px}',
    '.wm-pro{position:relative;margin-top:10px;touch-action:pan-y;user-select:none;-webkit-user-select:none}',
    '.wm-pro svg{display:block;width:100%;height:110px}',
    '.wm-info{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 10px;font-size:12px;margin-top:6px;min-height:34px}',
    '.wm-info b{font-size:14px}',
    '.wm-cl{margin-top:10px}',
    '.wm-cl h3{margin:6px 0}',
    '.wm-c{display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:12px;background:var(--card2,rgba(127,127,127,.1));margin-bottom:6px;cursor:pointer;font-size:13px}',
    '.wm-c.on{outline:2px solid var(--acc,#1d6fe0)}',
    '.wm-c .n{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-weight:800;color:#fff;flex:none}',
    '.wm-c small{display:block;opacity:.75;font-size:11.5px}',
    '.wm-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px;font-size:11px}',
    '.wm-sum div{background:var(--card2,rgba(127,127,127,.1));border-radius:10px;padding:6px 8px}',
    '.wm-sum b{display:block;font-size:14px}',
    '.wm-ed{position:absolute;right:52px;top:8px;z-index:500;border:0;border-radius:10px;height:36px;padding:0 10px;background:rgba(15,34,54,.82);color:#fff;font:700 12px/1 inherit;cursor:pointer}',
    '.wm-ed.on{background:#2f9e44}',
    '.wm-zw{padding:12px 14px;border-radius:14px;background:var(--card2,rgba(127,127,127,.1));margin:10px 0;font-size:13px}'
  ].join('\n');
  function addCss() { if (document.getElementById('wm-css')) return; var s = document.createElement('style'); s.id = 'wm-css'; s.textContent = CSS; document.head.appendChild(s); }

  var LAYERS = {
    str: { n: 'Straße', u: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', o: { maxZoom: 19, subdomains: 'abc', attribution: '© OpenStreetMap' } },
    sat: { n: 'Satellit', u: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', o: { maxZoom: 19, attribution: 'Bilder © Esri, Maxar, Earthstar Geographics' },
      over: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}' },
    topo: { n: 'Topo', u: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', o: { maxZoom: 17, subdomains: 'abc', attribution: '© OpenStreetMap, SRTM · OpenTopoMap' } }
  };
  var MODES = [['plain', 'Strecke'], ['hr', 'Puls'], ['w', 'Watt'], ['v', 'Tempo'], ['g', 'Steigung']];
  var CLC = ['#e8590c', '#c2255c', '#7048e8', '#1971c2', '#0c8599', '#2f9e44'];

  function pref(k, d) { try { var v = localStorage.getItem('wu_map_' + k); return v || d; } catch (e) { return d; } }
  function setPref(k, v) { try { localStorage.setItem('wu_map_' + k, v); } catch (e) { } }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1).replace('.', ','); }
  function f0(x) { return String(Math.round(x)); }
  function hav(a, b) { var R = 6371000, t = Math.PI / 180, dLa = (b[0] - a[0]) * t, dLo = (b[1] - a[1]) * t, x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return 2 * R * Math.asin(Math.sqrt(x)); }

  /* Farbskala: grün → gelb → orange → rot → violett */
  var STOPS = [[0, [47, 158, 68]], [.35, [250, 200, 40]], [.6, [247, 120, 30]], [.82, [224, 49, 49]], [1, [134, 46, 156]]];
  function col(t) {
    t = Math.max(0, Math.min(1, t));
    for (var i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
      var a = STOPS[i - 1], b = STOPS[i], k = (t - a[0]) / (b[0] - a[0]);
      return 'rgb(' + a[1].map(function (v, j) { return Math.round(v + (b[1][j] - v) * k); }).join(',') + ')';
    }
    return 'rgb(134,46,156)';
  }
  var GRAD = 'linear-gradient(90deg,' + STOPS.map(function (s) { return 'rgb(' + s[1].join(',') + ') ' + (s[0] * 100) + '%'; }).join(',') + ')';

  function prep(p) {
    var loc = p.location || [], n = loc.length, i, d = [], alt = [], g = [];
    var dist = p.distance && p.distance.length === n ? p.distance.slice() : null;
    if (!dist) { dist = [0]; for (i = 1; i < n; i++) dist.push(dist[i - 1] + hav(loc[i - 1], loc[i])); }
    for (i = 0; i < n; i++) { d.push(dist[i] || 0); alt.push(p.altitude && p.altitude[i] != null ? p.altitude[i] : null); }
    // Steigung über ca. 100 m geglättet
    for (i = 0; i < n; i++) {
      var j = i, k = i;
      while (j > 0 && d[i] - d[j] < 50) j--;
      while (k < n - 1 && d[k] - d[i] < 50) k++;
      g.push(alt[j] != null && alt[k] != null && d[k] - d[j] > 20 ? (alt[k] - alt[j]) / (d[k] - d[j]) * 100 : 0);
    }
    var pick = function (a) { return a && a.length === n ? a : null; };
    return { loc: loc, n: n, d: d, alt: alt, g: g, hr: pick(p.heart_rate), w: pick(p.watts), v: pick(p.velocity_smooth), t: pick(p.time) };
  }

  /* Anstiege: mindestens 800 m, Schnitt ab 3 %, mindestens 50 Hm */
  function climbs(r) {
    var out = [], n = r.n, i = 0, alt = r.alt, d = r.d;
    if (!alt[0] && alt[0] !== 0) return out;
    while (i < n - 1) {
      var lo = i, j = i + 1, hi = i, dip = 0;
      while (j < n) {
        if (alt[j] >= alt[hi]) { hi = j; dip = 0; }
        else { dip = alt[hi] - alt[j]; if (dip > 25 || (d[j] - d[hi] > 600 && dip > 8)) break; }
        j++;
      }
      // Fuß des Anstiegs: letzter Punkt vor dem Gipfel, der noch auf Ausgangshöhe liegt
      for (var q = hi; q > lo; q--) if (alt[q] <= alt[lo] + 3) { lo = q; break; }
      var len = d[hi] - d[lo], gain = alt[hi] - alt[lo];
      if (len >= 800 && gain >= 50 && gain / len >= .03) { out.push({ a: lo, b: hi, len: len, gain: gain, grade: gain / len * 100 }); i = hi + 1; }
      else i = Math.max(i + 1, lo === hi ? i + 1 : hi);
    }
    out.forEach(function (c) {
      var s = 0, m = 0, h = 0, k = 0, x;
      for (x = c.a; x <= c.b; x++) { if (r.w && r.w[x] != null) { s += r.w[x]; m++; } if (r.hr && r.hr[x] != null) { h += r.hr[x]; k++; } }
      c.w = m ? s / m : null; c.hr = k ? h / k : null;
      c.sec = r.t ? r.t[c.b] - r.t[c.a] : null;
      c.vam = c.sec ? c.gain / c.sec * 3600 : null;
      var mx = 0; for (x = c.a; x <= c.b; x++) mx = Math.max(mx, r.g[x]); c.max = mx;
    });
    return out;
  }

  function range(arr) {
    var v = arr.filter(function (x) { return x != null && isFinite(x); }).slice().sort(function (a, b) { return a - b; });
    if (!v.length) return null;
    return [v[Math.floor(v.length * .03)], v[Math.floor(v.length * .97)]];
  }

  async function streams(a) {
    var m = await window.claude.use('mcp');
    var keys = ['time', 'distance', 'altitude', 'velocity_smooth', 'heart_rate', 'watts', 'location'];
    var res = Math.min(1500, Math.max(300, Math.round((a.sec || 3600) / 4)));
    var r = await m.callTool('Strava', 'get_activity_streams', { activity_id: String(a.id), resolution: res, streams: keys });
    return r && r.payload || {};
  }

  function zwiftBox(a) {
    var nm = String(a.name || '');
    var w = (nm.match(/Zwift\s*[-–:]\s*(.+)/i) || [])[1] || nm;
    return '<div class="wm-zw">🎮 <b>Zwift</b> · ' + (w.replace(/[<>&]/g, '')) + '<br><span style="opacity:.75">Virtuelle Strecke, deshalb keine echte Karte.</span></div>';
  }

  window.WU_MAP = async function (el, a) {
    if (!el || !a) return;
    addCss();
    if (a.sp === 'VirtualRide' || /zwift/i.test(a.name || '')) { el.innerHTML = zwiftBox(a); return; }
    el.innerHTML = '<p class="mu">Lade Karte …</p>';
    var p, L;
    try { var res = await Promise.all([streams(a), loadLeaflet()]); p = res[0]; L = res[1]; }
    catch (e) { el.innerHTML = '<p class="mu">Karte nicht verfügbar: ' + ((e && e.message) || e) + '</p>'; return; }
    if (!p.location || p.location.length < 3) { el.innerHTML = ''; return; }
    show0(el, p, L);
  };
  /* v52: gleiche Karte für geplante Routen (Strecke, Höhe, geschätzte Zeit) */
  window.WU_MAPP = async function (el, p, opt) {
    if (!el || !p || !p.location || p.location.length < 3) return;
    addCss(); if (!el.firstElementChild) el.innerHTML = '<p class="mu">Lade Karte …</p>';
    var L; try { L = await loadLeaflet(); } catch (e) { el.innerHTML = '<p class="mu">Karte nicht verfügbar: ' + ((e && e.message) || e) + '</p>'; return; }
    show0(el, p, L, opt || {});
  };
  /* v53: Punkte-Karte (z. B. gelernte Vorlieben: gemieden rot, bevorzugt grün) */
  window.WU_MAPPTS = async function (el, pts, h, fit) {
    if (!el) return; addCss();
    var L; try { L = await loadLeaflet(); } catch (e) { el.innerHTML = '<p class="mu">Karte nicht verfügbar.</p>'; return; }
    el.innerHTML = '<div class="wm"><div class="wm-box" style="height:' + (h || 260) + 'px"></div></div>';
    var box = el.querySelector('.wm-box'), map = L.map(box, { scrollWheelZoom: false }), d = LAYERS[pref('lay', 'str')] || LAYERS.str;
    L.tileLayer(d.u, d.o).addTo(map);
    var ren = L.canvas({ padding: .5 }), ll = [];
    pts.forEach(function (q) { ll.push([q[0], q[1]]); L.circleMarker([q[0], q[1]], { renderer: ren, radius: q[3] || 4, weight: q[3] ? 2 : 0, color: '#fff', fillColor: q[2], fillOpacity: q[4] != null ? q[4] : .75, interactive: false }).addTo(map); });
    var fb = fit && fit.length ? fit : ll;
    if (fb.length) map.fitBounds(L.latLngBounds(fb), { padding: [24, 24], maxZoom: 15 }); else map.setView([47.8, 13.04], 10);
    setTimeout(function () { map.invalidateSize(); }, 200);
  };
  /* v58: mehrere Linien (z. B. Anstiegs-Sammlung), antippbar; optional Klick auf die Karte */
  window.WU_MAPLINES = async function (el, lines, opt) {
    if (!el) return; addCss(); opt = opt || {};
    var L; try { L = await loadLeaflet(); } catch (e) { el.innerHTML = '<p class="mu">Karte nicht verfügbar.</p>'; return; }
    var key = pref('lay', 'str');
    el.innerHTML = '<div class="wm"><div class="wm-seg" data-g="lay">' + Object.keys(LAYERS).map(function (k) { return '<button data-v="' + k + '"' + (k === key ? ' class="on"' : '') + '>' + LAYERS[k].n + '</button>'; }).join('') + '</div><div class="wm-box" style="height:' + (opt.h || 320) + 'px"></div>' + (opt.hint ? '<p class="mu" style="font-size:.78rem;margin:4px 0">' + opt.hint + '</p>' : '') + '</div>';
    var box = el.querySelector('.wm-box'), map = L.map(box, { scrollWheelZoom: true }), tl = null;
    function lay(k) { if (tl) map.removeLayer(tl); var d = LAYERS[k] || LAYERS.str; tl = L.tileLayer(d.u, d.o).addTo(map); }
    lay(key);
    el.querySelector('[data-g="lay"]').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); setPref('lay', b.getAttribute('data-v')); lay(b.getAttribute('data-v')); });
    var all = [];
    lines.forEach(function (ln) {
      if (!ln.lat || ln.lat.length < 2) return; ln.lat.forEach(function (q) { all.push(q); });
      L.polyline(ln.lat, { color: '#ffffff', weight: (ln.w || 4) + 4, opacity: .8 }).addTo(map);
      var pl = L.polyline(ln.lat, { color: ln.c, weight: ln.w || 4, opacity: ln.o != null ? ln.o : .95 }).addTo(map);
      if (opt.onLine && ln.k != null) pl.on('click', function (e) { L.DomEvent.stopPropagation(e); opt.onLine(ln.k); });
      if (ln.lab) L.marker(ln.lat[ln.lat.length - 1], { interactive: false, icon: L.divIcon({ className: '', html: '<div style="background:' + ln.c + ';color:#fff;font:700 10px/1 sans-serif;padding:3px 5px;border-radius:6px;border:1px solid #fff;white-space:nowrap">' + ln.lab + '</div>', iconSize: [10, 10], iconAnchor: [0, 16] }) }).addTo(map);
    });
    (opt.pins || []).forEach(function (q) { L.circleMarker(q, { radius: 7, color: '#fff', weight: 3, fillColor: '#e03131', fillOpacity: 1 }).addTo(map); });
    if (opt.onClick) map.on('click', function (e) { opt.onClick(e.latlng.lat, e.latlng.lng); });
    var fb = opt.fit && opt.fit.length ? opt.fit : all;
    if (opt.view) map.setView(opt.view.c, opt.view.z); else if (fb.length) map.fitBounds(L.latLngBounds(fb), { padding: [20, 20], maxZoom: 15 }); else map.setView([47.8, 13.04], 10);
    setTimeout(function () { map.invalidateSize(); }, 200);
    el._wmView = function () { return { c: map.getCenter(), z: map.getZoom() }; };
  };
  /* Straßenart und Untergrund: Klassen je Punkt */
  var RCL = { r: ['Radweg', '#2f9e44'], n: ['Nebenstraße', '#4dabf7'], l: ['Landesstraße', '#f59f00'], b: ['Bundesstraße', '#e03131'], s: ['Sonstiges', '#adb5bd'] };
  var SCL = { a: ['Asphalt', '#1d6fe0'], p: ['Beton/Pflaster', '#be4bdb'], u: ['Unbekannt', '#adb5bd'], g: ['Schotter', '#a0522d'] };
  window.WU_RCL = RCL; window.WU_SCL = SCL;
  function show0(el, p, L, opt) {
    opt = opt || {};
    var r = prep(p), cls = opt.ivs ? [] : climbs(r), mob = matchMedia('(pointer:coarse)').matches, IVC = '#ff2d55';
    var modes = MODES.concat([['road', 'Straßenart'], ['surf', 'Untergrund']]).filter(function (m) { return m[0] === 'plain' || m[0] === 'g' && r.alt[0] != null || m[0] === 'hr' && r.hr || m[0] === 'w' && r.w || m[0] === 'v' && r.v || m[0] === 'road' && p.road || m[0] === 'surf' && p.surf; });
    var lay = pref('lay', 'str'), mode = pref('mode', 'plain'); if (!modes.some(function (m) { return m[0] === mode; })) mode = 'plain';
    var up = 0, top = -1e9; for (var i = 1; i < r.n; i++) { if (r.alt[i] != null && r.alt[i - 1] != null && r.alt[i] > r.alt[i - 1]) up += r.alt[i] - r.alt[i - 1]; if (r.alt[i] != null) top = Math.max(top, r.alt[i]); }
    var gs = r.g.slice().sort(function (a, b) { return a - b; }), gmax = gs[Math.floor(gs.length * .99)] || 0;

    el.innerHTML = '<div class="wm">' +
      '<div class="wm-seg" data-g="lay">' + Object.keys(LAYERS).map(function (k) { return '<button data-v="' + k + '"' + (k === lay ? ' class="on"' : '') + '>' + LAYERS[k].n + '</button>'; }).join('') + '</div>' +
      '<div class="wm-seg" data-g="mode">' + modes.map(function (m) { return '<button data-v="' + m[0] + '"' + (m[0] === mode ? ' class="on"' : '') + '>' + m[1] + '</button>'; }).join('') + '</div>' +
      (opt.pick ? '<div class="wm-seg wm-pk" data-g="pick">' + opt.pick.map(function (x, k) { return '<button data-v="' + k + '"' + (k === opt.sel ? ' class="on"' : '') + ' style="' + (k === opt.sel ? 'background:' + x.c : 'box-shadow:inset 0 -3px 0 ' + x.c) + '">' + x.n + '</button>'; }).join('') + '</div>' : '') +
      '<div class="wm-box"' + (opt.h ? ' style="height:' + opt.h + 'px"' : '') + '><button class="wm-fs" title="Vollbild">⤢</button>' + (opt.onEdit ? '<button class="wm-ed" title="Route anpassen">✎ Anpassen</button>' : '') + (mob ? '<span class="wm-hint">Vollbild zum Verschieben</span>' : '') + '</div>' +
      '<div class="wm-leg"></div>' +
      (r.alt[0] != null ? '<div class="wm-pro"><svg></svg></div>' : '') +
      '<div class="wm-info"></div>' +
      '<div class="wm-sum"><div>Strecke<b>' + f1(r.d[r.n - 1] / 1000) + ' km</b></div><div>Anstieg<b>' + f0(up) + ' m</b></div><div>Höchster Punkt<b>' + (top > -1e9 ? f0(top) + ' m' : '–') + '</b></div><div>Max. Steigung<b>' + f0(gmax) + ' %</b></div></div>' +
      (cls.length ? '<div class="wm-cl"><h3>Anstiege</h3>' + cls.map(function (c, k) {
        return '<div class="wm-c" data-c="' + k + '"><span class="n" style="background:' + CLC[k % CLC.length] + '">' + (k + 1) + '</span><div><b>' + f1(c.len / 1000) + ' km · ' + f1(c.grade) + ' % · ' + f0(c.gain) + ' Hm</b><small>ab km ' + f1(r.d[c.a] / 1000) +
          (c.w ? ' · Ø ' + f0(c.w) + ' W' : '') + (c.hr ? ' · Ø ' + f0(c.hr) + ' bpm' : '') + (c.vam ? ' · VAM ' + f0(c.vam) : '') + (c.sec ? ' · ' + Math.floor(c.sec / 60) + ':' + ('0' + Math.round(c.sec % 60)).slice(-2) + ' min' : '') + ' · max. ' + f0(c.max) + ' %</small></div></div>';
      }).join('') + '</div>' : '') +
      '</div>';
    var root = el.firstElementChild, box = root.querySelector('.wm-box');

    var map = L.map(box, { zoomControl: true, attributionControl: true, preferCanvas: true, dragging: !mob, tap: true, scrollWheelZoom: false, touchZoom: true });
    var base = null, over = null;
    function setLayer(k) {
      if (base) map.removeLayer(base); if (over) { map.removeLayer(over); over = null; }
      var d = LAYERS[k]; base = L.tileLayer(d.u, d.o).addTo(map);
      if (d.over) over = L.tileLayer(d.over, { maxZoom: 19 }).addTo(map);
      lay = k; setPref('lay', k);
    }
    setLayer(lay);
    var ren = L.canvas({ padding: .5 }), track = L.layerGroup().addTo(map), hl = null, dot = null;
    var lat = r.loc.map(function (q) { return [q[0], q[1]]; });
    var bounds = L.latLngBounds(lat);

    function val(i) { return mode === 'hr' ? r.hr[i] : mode === 'w' ? r.w[i] : mode === 'v' ? r.v[i] * 3.6 : mode === 'g' ? r.g[i] : null; }
    function draw() {
      track.clearLayers();
      var leg = root.querySelector('.wm-leg');
      (opt.alts || []).forEach(function (a) {
        L.polyline(a.lat, { renderer: ren, color: '#ffffff', weight: 6, opacity: .6 }).addTo(track);
        var pl = L.polyline(a.lat, { renderer: ren, color: a.c, weight: 4, opacity: .6 }).addTo(track);
        if (a.k != null && opt.onPick) pl.on('click', function (e) { L.DomEvent.stopPropagation(e); opt.onPick(a.k, view()); });
      });
      if (mode === 'plain') {
        L.polyline(lat, { renderer: ren, color: '#ffffff', weight: 8, opacity: .9 }).addTo(track);
        L.polyline(lat, { renderer: ren, color: opt.color || '#1d6fe0', weight: 5 }).addTo(track);
        leg.innerHTML = '';
      } else if (mode === 'road' || mode === 'surf') {
        var cs = mode === 'road' ? p.road : p.surf, CM = mode === 'road' ? RCL : SCL, sh = {}, tl = 0;
        L.polyline(lat, { renderer: ren, color: '#ffffff', weight: 8, opacity: .85 }).addTo(track);
        var st0 = 0;
        for (var q = 1; q <= r.n; q++) if (q === r.n || cs[q] !== cs[st0]) {
          var k0 = cs[st0] || 's'; L.polyline(lat.slice(st0, q + 1 > r.n ? r.n : q + 1), { renderer: ren, color: (CM[k0] || CM.s || CM.u)[1], weight: 5, interactive: false }).addTo(track);
          var dd0 = r.d[Math.min(q, r.n - 1)] - r.d[st0]; sh[k0] = (sh[k0] || 0) + dd0; tl += dd0; st0 = q;
        }
        leg.innerHTML = Object.keys(CM).filter(function (k) { return sh[k] > 0; }).map(function (k) { return '<span style="display:flex;align-items:center;gap:4px"><b style="width:10px;height:10px;border-radius:3px;background:' + CM[k][1] + ';display:inline-block"></b>' + CM[k][0] + ' ' + f1(sh[k] / 1000) + ' km · ' + f0(sh[k] / (tl || 1) * 100) + ' %</span>'; }).join('');
        leg.style.flexWrap = 'wrap';
      } else {
        var vs = []; for (var i = 0; i < r.n; i++) vs.push(val(i));
        var rg = mode === 'g' ? [-2, 10] : range(vs) || [0, 1];
        L.polyline(lat, { renderer: ren, color: '#ffffff', weight: 8, opacity: .85 }).addTo(track);
        for (i = 1; i < r.n; i++) {
          var v = vs[i] != null ? vs[i] : vs[i - 1];
          L.polyline([lat[i - 1], lat[i]], { renderer: ren, color: v == null ? '#888' : col((v - rg[0]) / (rg[1] - rg[0] || 1)), weight: 5, interactive: false }).addTo(track);
        }
        var u = mode === 'hr' ? ' bpm' : mode === 'w' ? ' W' : mode === 'v' ? ' km/h' : ' %';
        leg.innerHTML = '<span>' + f0(rg[0]) + u + '</span><i style="background:' + GRAD + '"></i><span>' + f0(rg[1]) + u + '</span>';
      }
      // Start, Ziel, Kilometer
      var ico = function (bg, t) { return L.divIcon({ className: '', html: '<div style="width:22px;height:22px;border-radius:50%;background:' + bg + ';border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);color:#fff;font:800 10px/16px sans-serif;text-align:center">' + t + '</div>', iconSize: [22, 22], iconAnchor: [11, 11] }); };
      var tot = r.d[r.n - 1], step = tot > 80000 ? 20000 : tot > 30000 ? 10000 : 5000, nx = step;
      for (var k = 1; k < r.n; k++) if (r.d[k] >= nx) {
        L.marker(lat[k], { interactive: false, icon: L.divIcon({ className: '', html: '<div style="background:rgba(15,34,54,.85);color:#fff;font:700 10px/1 sans-serif;padding:3px 5px;border-radius:6px;white-space:nowrap">' + (nx / 1000) + ' km</div>', iconSize: [34, 16], iconAnchor: [17, 8] }) }).addTo(track);
        nx += step;
      }
      var loop = hav(lat[0], lat[r.n - 1]) < 150;
      L.marker(lat[r.n - 1], { icon: ico('#e03131', '■'), interactive: false }).addTo(track);
      L.marker(lat[0], { icon: ico('#2f9e44', loop ? '⟳' : '▶'), interactive: false }).addTo(track);
      cls.forEach(function (c, k) {
        L.marker(lat[c.b], { icon: ico(CLC[k % CLC.length], String(k + 1)) }).on('click', function () { pickClimb(k); }).addTo(track);
      });
      /* v55: Intervallstrecken (von wo bis wo) */
      (opt.ivs || []).forEach(function (v) {
        var a0 = Math.max(0, Math.min(r.n - 1, v[0])), b0 = Math.max(a0, Math.min(r.n - 1, v[1]));
        L.polyline(lat.slice(a0, b0 + 1), { renderer: ren, color: '#ffffff', weight: 12, opacity: .95, interactive: false }).addTo(track);
        L.polyline(lat.slice(a0, b0 + 1), { renderer: ren, color: IVC, weight: 7, opacity: .95, interactive: false }).addTo(track);
        L.marker(lat[a0], { interactive: false, icon: L.divIcon({ className: '', html: '<div style="background:' + IVC + ';color:#fff;font:800 11px/1 sans-serif;padding:4px 6px;border-radius:8px;border:2px solid #fff;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.4)">▶ ' + v[2] + '</div>', iconSize: [40, 20], iconAnchor: [8, 10] }) }).addTo(track);
        L.marker(lat[b0], { interactive: false, icon: L.divIcon({ className: '', html: '<div style="width:14px;height:14px;background:#fff;border:3px solid ' + IVC + ';border-radius:3px"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }) }).addTo(track);
      });
    }
    function view() { try { return { c: map.getCenter(), z: map.getZoom(), full: root.classList.contains('full') }; } catch (e) { return null; } }
    draw();
    var fit0 = function () { if (opt.view && opt.view.c) map.setView(opt.view.c, opt.view.z, { animate: false }); else map.fitBounds(opt.fitAll || bounds, { padding: [18, 18] }); };
    fit0();
    setTimeout(function () { map.invalidateSize(); fit0(); }, 250);
    /* Wegpunkte verschieben: Ziehen verschiebt, Tippen auf einen Wegpunkt entfernt ihn, Tippen auf die Karte fügt einen hinzu */
    var edOn = false, edL = L.layerGroup().addTo(map), wps = (opt.wps || []).map(function (q) { return [q[0], q[1]]; });
    function edDraw() {
      edL.clearLayers(); if (!edOn) return;
      wps.forEach(function (q, k) {
        var m = L.marker(q, { draggable: true, icon: L.divIcon({ className: '', html: '<div style="width:26px;height:26px;border-radius:50%;background:#fff;border:3px solid ' + (opt.color || '#1d6fe0') + ';box-shadow:0 1px 5px rgba(0,0,0,.45);font:800 11px/20px sans-serif;text-align:center;color:#123">' + (k + 1) + '</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(edL);
        m.on('dragend', function () { var x = m.getLatLng(); wps[k] = [x.lat, x.lng]; opt.onEdit(wps.slice(), view()); });
        m.on('click', function (e) { L.DomEvent.stopPropagation(e); if (wps.length < 2) return; wps.splice(k, 1); opt.onEdit(wps.slice(), view()); });
      });
    }
    var edb = root.querySelector('.wm-ed');
    if (edb) edb.addEventListener('click', function () { edOn = !edOn; edb.classList.toggle('on', edOn); edb.textContent = edOn ? '✓ Fertig' : '✎ Anpassen'; if (edOn) map.dragging.enable(); else if (mob && !root.classList.contains('full')) map.dragging.disable(); edDraw(); var h = root.querySelector('.wm-hint'); if (h) h.textContent = edOn ? 'Punkte ziehen · antippen entfernt · Karte antippen fügt hinzu' : 'Vollbild zum Verschieben'; });
    if (opt.editing && edb) edb.click();

    // Höhenprofil mit Scrubben
    var svg = root.querySelector('.wm-pro svg'), info = root.querySelector('.wm-info'), W = 340, Hh = 110, sel = null;
    var amin = 1e9, amax = -1e9; r.alt.forEach(function (v) { if (v != null) { amin = Math.min(amin, v); amax = Math.max(amax, v); } });
    if (amax - amin < 20) amax = amin + 20;
    var tot = r.d[r.n - 1] || 1, X = function (d) { return d / tot * W; }, Y = function (v) { return 8 + (amax - v) / (amax - amin) * (Hh - 26); };
    function prof() {
      if (!svg) return;
      if (svg.clientWidth > 60) { W = Math.round(svg.clientWidth); Hh = Math.max(70, Math.round(svg.clientHeight || 110)); }
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
      var path = '', i;
      for (i = 0; i < r.n; i++) if (r.alt[i] != null) path += (path ? 'L' : 'M') + X(r.d[i]).toFixed(1) + ' ' + Y(r.alt[i]).toFixed(1);
      var area = path + 'L' + W + ' ' + (Hh - 18) + 'L0 ' + (Hh - 18) + 'Z', segs = '';
      if (mode !== 'plain') {
        var vs = []; for (i = 0; i < r.n; i++) vs.push(val(i));
        var rg = mode === 'g' ? [-2, 10] : range(vs) || [0, 1], step = Math.max(1, Math.floor(r.n / 170));
        for (i = step; i < r.n; i += step) if (r.alt[i] != null && vs[i] != null) segs += '<rect x="' + X(r.d[i - step]).toFixed(1) + '" y="' + Y(r.alt[i]).toFixed(1) + '" width="' + (X(r.d[i]) - X(r.d[i - step]) + .6).toFixed(1) + '" height="' + (Hh - 18 - Y(r.alt[i])).toFixed(1) + '" fill="' + col((vs[i] - rg[0]) / (rg[1] - rg[0] || 1)) + '" opacity=".55"/>';
      }
      var ivr = (opt.ivs || []).map(function (v) { var a0 = Math.max(0, Math.min(r.n - 1, v[0])), b0 = Math.max(a0, Math.min(r.n - 1, v[1])); return '<rect x="' + X(r.d[a0]).toFixed(1) + '" y="0" width="' + Math.max(1, X(r.d[b0]) - X(r.d[a0])).toFixed(1) + '" height="' + (Hh - 18) + '" fill="' + IVC + '" opacity=".2"/><text x="' + (X(r.d[a0]) + 2).toFixed(1) + '" y="22" font-size="9" font-weight="700" fill="' + IVC + '">' + v[2] + '</text>'; }).join('');
      var cl = ivr + cls.map(function (c, k) { return '<rect class="wm-cr" data-c="' + k + '" x="' + X(r.d[c.a]).toFixed(1) + '" y="0" width="' + (X(r.d[c.b]) - X(r.d[c.a])).toFixed(1) + '" height="' + (Hh - 18) + '" fill="' + CLC[k % CLC.length] + '" opacity="' + (sel === k ? .22 : .08) + '"/>'; }).join('');
      var ticks = '', st = tot > 80000 ? 20000 : tot > 30000 ? 10000 : 5000;
      for (var t = st; t < tot; t += st) ticks += '<text x="' + X(t).toFixed(1) + '" y="' + (Hh - 5) + '" text-anchor="middle" font-size="9" fill="currentColor" opacity=".6">' + t / 1000 + '</text>';
      svg.innerHTML = cl + (segs || '<path d="' + area + '" fill="#1d6fe0" opacity=".18"/>') + '<path d="' + path + '" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".8"/>' + ticks +
        '<text x="2" y="12" font-size="9" fill="currentColor" opacity=".6">' + f0(amax) + ' m</text><text x="2" y="' + (Hh - 21) + '" font-size="9" fill="currentColor" opacity=".6">' + f0(amin) + ' m</text>' +
        '<line class="wm-cur" x1="-10" x2="-10" y1="0" y2="' + (Hh - 18) + '" stroke="currentColor" stroke-width="1.2"/>';
    }
    prof();
    if (window.ResizeObserver) {
      var rw = 0, rh = 0;
      if (svg) new ResizeObserver(function () { if (Math.abs(svg.clientWidth - rw) > 4 || Math.abs(svg.clientHeight - rh) > 4) { rw = svg.clientWidth; rh = svg.clientHeight; prof(); } }).observe(svg);
      var bx = root.querySelector('.wm-box'); if (bx) new ResizeObserver(function () { try { map.invalidateSize(); } catch (e) {} }).observe(bx);
    }
    function show(i) {
      i = Math.max(0, Math.min(r.n - 1, i));
      if (!dot) dot = L.circleMarker(lat[i], { radius: 7, color: '#fff', weight: 3, fillColor: '#1d6fe0', fillOpacity: 1, interactive: false }).addTo(map);
      dot.setLatLng(lat[i]);
      var c = svg && svg.querySelector('.wm-cur'); if (c) { c.setAttribute('x1', X(r.d[i])); c.setAttribute('x2', X(r.d[i])); }
      var tm = r.t ? r.t[i] : null;
      info.innerHTML = '<div>km<br><b>' + f1(r.d[i] / 1000) + '</b></div>' +
        '<div>Höhe · Steigung<br><b>' + (r.alt[i] != null ? f0(r.alt[i]) + ' m' : '–') + ' · ' + f0(r.g[i]) + ' %</b></div>' +
        '<div>Zeit<br><b>' + (tm != null ? Math.floor(tm / 3600) + ':' + ('0' + Math.floor(tm % 3600 / 60)).slice(-2) : '–') + '</b></div>' +
        (r.hr ? '<div>Puls<br><b>' + (r.hr[i] != null ? f0(r.hr[i]) : '–') + ' bpm</b></div>' : '') +
        (r.w ? '<div>Leistung<br><b>' + (r.w[i] != null ? f0(r.w[i]) : '–') + ' W</b></div>' : '') +
        (r.v ? '<div>Tempo<br><b>' + (r.v[i] != null ? f1(r.v[i] * 3.6) : '–') + ' km/h</b></div>' : '');
    }
    function idxAtDist(d) { var lo = 0, hi = r.n - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (r.d[m] < d) lo = m + 1; else hi = m; } return lo; }
    info.innerHTML = '<div style="grid-column:1/-1;opacity:.7">' + (svg ? 'Über das Höhenprofil wischen oder auf die Strecke tippen.' : 'Auf die Strecke tippen für Werte an dieser Stelle.') + '</div>';
    if (svg) {
      var scrub = function (e) { var b = svg.getBoundingClientRect(), x = (e.touches ? e.touches[0].clientX : e.clientX) - b.left; show(idxAtDist(x / b.width * tot)); };
      svg.addEventListener('pointerdown', scrub); svg.addEventListener('pointermove', function (e) { if (e.buttons || e.pointerType !== 'mouse' || true) scrub(e); });
      svg.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('.wm-cr'); if (t) pickClimb(+t.getAttribute('data-c')); });
    }
    map.on('click', function (e) {
      if (edOn) {
        var q0 = [e.latlng.lat, e.latlng.lng], ins = wps.length, bc = 1e18, pts = [opt.home || lat[0]].concat(wps).concat([opt.home || lat[r.n - 1]]);
        for (var z = 0; z < pts.length - 1; z++) { var cc = hav(pts[z], q0) + hav(q0, pts[z + 1]) - hav(pts[z], pts[z + 1]); if (cc < bc) { bc = cc; ins = z; } }
        wps.splice(ins, 0, q0); opt.onEdit(wps.slice(), view()); return;
      }
      var best = 0, bd = 1e18, q = [e.latlng.lat, e.latlng.lng];
      for (var i = 0; i < r.n; i++) { var dd = (lat[i][0] - q[0]) * (lat[i][0] - q[0]) + (lat[i][1] - q[1]) * (lat[i][1] - q[1]); if (dd < bd) { bd = dd; best = i; } }
      show(best);
    });
    function pickClimb(k) {
      sel = sel === k ? null : k;
      if (hl) { map.removeLayer(hl); hl = null; }
      root.querySelectorAll('.wm-c').forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-c') === sel); });
      prof();
      if (sel == null) { map.fitBounds(bounds, { padding: [18, 18] }); return; }
      var c = cls[k], seg = lat.slice(c.a, c.b + 1);
      hl = L.polyline(seg, { color: CLC[k % CLC.length], weight: 9, opacity: .55 }).addTo(map);
      map.fitBounds(L.latLngBounds(seg), { padding: [30, 30] });
      show(c.b);
    }
    root.querySelectorAll('.wm-c').forEach(function (x) { x.addEventListener('click', function () { pickClimb(+x.getAttribute('data-c')); }); });

    root.querySelectorAll('.wm-seg').forEach(function (g) {
      g.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        g.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
        if (g.getAttribute('data-g') === 'pick') { if (opt.onPick) opt.onPick(+b.getAttribute('data-v'), view()); return; }
        if (g.getAttribute('data-g') === 'lay') setLayer(b.getAttribute('data-v'));
        else { mode = b.getAttribute('data-v'); setPref('mode', mode); draw(); prof(); }
      });
    });
    // Vollbild
    var ph = null;
    root.querySelector('.wm-fs').addEventListener('click', function () {
      var on = !root.classList.contains('full');
      if (on) { ph = document.createComment('wm'); root.parentNode.insertBefore(ph, root); document.body.appendChild(root); root.classList.add('full'); map.dragging.enable(); }
      else { root.classList.remove('full'); if (ph) { ph.parentNode.insertBefore(root, ph); ph.remove(); } if (mob) map.dragging.disable(); }
      this.textContent = on ? '✕' : '⤢';
      var h = root.querySelector('.wm-hint'); if (h) h.style.display = on ? 'none' : '';
      setTimeout(function () { map.invalidateSize(); map.fitBounds(hl ? hl.getBounds() : bounds, { padding: [24, 24] }); }, 60);
    });
    // Vollbild schließen, wenn der Dialog zugeht
    var mo = new MutationObserver(function () { if (ph && !ph.isConnected && root.isConnected) { root.remove(); mo.disconnect(); } });
    mo.observe(document.body, { childList: true, subtree: true });
    if (opt.view && opt.view.full) root.querySelector('.wm-fs').click();
    el._wmView = view;
  }
})();
