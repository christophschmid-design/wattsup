// Selbsttest vor jeder Veröffentlichung.
// 1. Statisch: doppelte Funktionen und widersprüchliche Variablen im selben Gültigkeitsbereich
//    (so ist z. B. der NaN-Fehler bei den Wochenzielen entstanden).
// 2. Im Browser: App mit Testdaten starten, alle Bereiche öffnen und auf Skriptfehler,
//    „NaN“, „undefined“ und „[object Object]“ im sichtbaren Text prüfen.
// Aufruf: node tools/selftest.mjs [pfad/zu/dist/index.html]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src/app.html');
const DIST = path.resolve(process.argv[2] || path.join(ROOT, 'dist/index.html'));
const fails = [];
const fail = (m) => { fails.push(m); console.log('✗ ' + m); };

/* ---------- 1. statische Prüfung ---------- */
function staticCheck(file) {
  const html = fs.readFileSync(file, 'utf8');
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, n = 0;
  while ((m = re.exec(html))) {
    const code = m[1], off = m.index + m[0].indexOf(m[1]);
    const line = (p) => html.slice(0, off + p).split('\n').length;
    const sf = ts.createSourceFile('a.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (sf.parseDiagnostics && sf.parseDiagnostics.length) fail('Syntaxfehler in Skript ' + (n + 1) + ': ' + sf.parseDiagnostics[0].messageText + ' (Zeile ' + line(sf.parseDiagnostics[0].start) + ')');
    const scopes = new Map();
    const scopeOf = (x) => { let p = x.parent; while (p && !(ts.isFunctionLike(p) || ts.isSourceFile(p))) p = p.parent; return p; };
    const reg = (sc, k, node) => { if (!scopes.has(sc)) scopes.set(sc, {}); const o = scopes.get(sc); (o[k] = o[k] || []).push(node); };
    (function visit(x) {
      if (ts.isFunctionDeclaration(x) && x.name) reg(scopeOf(x), 'f:' + x.name.text, x);
      if (ts.isVariableDeclaration(x) && ts.isIdentifier(x.name) && x.parent && !(x.parent.flags & ts.NodeFlags.BlockScoped)) reg(scopeOf(x), 'v:' + x.name.text, x);
      ts.forEachChild(x, visit);
    })(sf);
    for (const [, o] of scopes) {
      for (const k of Object.keys(o)) {
        const nm = k.slice(2), L = o[k];
        if (k[0] === 'f' && L.length > 1) fail('Funktion „' + nm + '“ ist mehrfach definiert (Zeilen ' + L.map((x) => line(x.getStart())).join(', ') + '), nur die letzte gilt');
        if (k[0] === 'f' && o['v:' + nm] && o['v:' + nm].some((x) => x.initializer)) fail('„' + nm + '“ ist Funktion und Variable zugleich (Zeilen ' + line(L[0].getStart()) + ', ' + line(o['v:' + nm][0].getStart()) + ')');
        if (k[0] === 'v') {
          const ini = L.filter((x) => x.initializer);
          const kinds = new Set(ini.map((x) => ts.SyntaxKind[x.initializer.kind]));
          if (ini.length > 1 && kinds.size > 1) fail('Variable „' + nm + '“ wird im selben Bereich unterschiedlich belegt (Zeilen ' + ini.map((x) => line(x.getStart()) + ': ' + x.initializer.getText().slice(0, 24)).join(' / ') + ')');
        }
      }
    }
    n++;
  }
  console.log('Statische Prüfung: ' + n + ' Skripte');
}

/* ---------- 2. Laufzeit mit Testdaten ---------- */
function acts() {
  const out = [], base = new Date(Date.UTC(2026, 0, 3));
  for (let i = 0; i < 300; i += 3) {
    const d = new Date(base.getTime() + i * 864e5);
    if (d > new Date(Date.UTC(2026, 10, 15))) break;
    out.push({ id: 1000 + i, name: 'Fahrt ' + i, sport_type: i % 2 ? 'Ride' : 'VirtualRide', type: 'Ride', start_date_local: d.toISOString().slice(0, 10) + 'T17:00:00Z', trainer: i % 2 === 0, distance: 40000, moving_time: 5400, elapsed_time: 5600, total_elevation_gain: 500, average_speed: 7.4, max_speed: 15, suffer_score: 60, kilojoules: 900, average_heartrate: 138.4, average_watts: 180, weighted_average_watts: 195, device_watts: true });
  }
  return out;
}
function streams() {
  const n = 3000, o = { time: [], distance: [], watts: [], heartrate: [], latlng: [], altitude: [], velocity_smooth: [] };
  let d = 0;
  for (let k = 0; k < n; k++) {
    const a = k / n * 2 * Math.PI, la = 47.8 + 0.06 * Math.sin(a), lo = 13.05 + 0.09 * Math.cos(a);
    if (k) { const p = o.latlng[k - 1]; d += Math.hypot((la - p[0]) * 111320, (lo - p[1]) * 74500); }
    o.time.push(k * 2); o.distance.push(d); o.latlng.push([la, lo]); o.altitude.push(420 + 300 * Math.max(0, Math.sin(a * 2)));
    o.watts.push(180 + 40 * Math.sin(k / 50)); o.heartrate.push(135 + 10 * Math.sin(k / 80)); o.velocity_smooth.push(8);
  }
  const r = {}; for (const k in o) r[k] = { data: o[k] }; return r;
}
async function runtimeCheck() {
  const A = acts(), b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e && e.message || e)));
  await pg.clock.setFixedTime(new Date('2026-11-17T08:00:00'));
  await pg.route(/https:\/\/(www\.strava\.com|api\.open-meteo\.com|www\.googleapis\.com|oauth2\.googleapis\.com|api\.anthropic\.com|[\w.-]*workers\.dev|intervals\.icu)\/.*/, (route) => {
    const u = route.request().url(), m = route.request().method();
    const J = (o, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('/athlete/activities')) { const pgN = +(u.match(/[?&]page=(\d+)/) || [0, 1])[1], per = +(u.match(/per_page=(\d+)/) || [0, 100])[1]; return J(A.slice((pgN - 1) * per, pgN * per)); }
    if (u.includes('/athlete/zones')) return J({ heart_rate: { custom_zones: false, zones: [{ min: 0, max: 120 }, { min: 121, max: 150 }, { min: 151, max: 165 }, { min: 166, max: 179 }, { min: 180, max: -1 }] }, power: { zones: [{ min: 0, max: 138 }, { min: 139, max: -1 }] } });
    if (u.includes('/api/v3/athlete')) return J({ id: 1, firstname: 'Test', weight: 78, ftp: 250 });
    if (u.includes('/streams')) return J(streams());
    if (u.includes('open-meteo')) { const days = [...Array(10)].map((_, k) => new Date(Date.UTC(2026, 10, 16 + k)).toISOString().slice(0, 10)); return J({ daily: { time: days, weather_code: days.map(() => 61), temperature_2m_max: days.map(() => 8), temperature_2m_min: days.map(() => 1), precipitation_probability_max: days.map(() => 70), snowfall_sum: days.map(() => 0), rain_sum: days.map(() => 3), wind_gusts_10m_max: days.map(() => 30) } }); }
    if (u.includes('calendar/v3')) return J(m === 'GET' ? { summary: 'Training', items: [] } : { id: 'x' });
    if (u.includes('drive/v3/files') && m === 'GET' && !u.includes('alt=media')) return J({ files: [] });
    if (u.includes('upload/drive')) return J({ id: 'f1' });
    if (u.includes('api.anthropic.com')) return J({ content: [{ type: 'text', text: '{"antwort":"Test","sessions":[]}' }], usage: { input_tokens: 10, output_tokens: 10 } });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    return J({});
  });
  await pg.addInitScript(() => {
    localStorage.setItem('wu_cfg', JSON.stringify({ stId: '1', stSec: 's', gId: 'g', gSec: 'gs', aKey: 'sk-ant-test', limit: 3, pushUrl: 'https://wattsup-push.test.workers.dev' }));
    localStorage.setItem('wu_strava', JSON.stringify({ a: 'A', r: 'R', x: 4102444800, who: 'Test' }));
    localStorage.setItem('wu_google', JSON.stringify({ a: 'G', r: 'GR', x: 4102444800000 }));
  });
  await pg.goto('file://' + DIST);
  await pg.waitForTimeout(12000);
  const bad = /\bNaN\b|\bundefined\b|\[object Object\]|Infinity/;
  const look = async (where) => {
    const t = await pg.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && (r.width > 0 || r.height > 0); };
      const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) { const p = n.parentElement; if (p && !p.closest('script,style,template') && n.nodeValue.trim() && vis(p)) out.push(n.nodeValue.trim()); }
      return out;
    });
    const hits = t.filter((x) => bad.test(x));
    if (hits.length) fail(where + ': ' + hits.slice(0, 3).map((x) => '„' + x.slice(0, 80) + '“').join(', '));
    else console.log('✓ ' + where);
  };
  for (const tab of ['heute', 'plan', 'weg', 'analyse', 'einheiten', 'saison']) {
    await pg.evaluate((t) => { location.hash = '#' + t; }, tab); await pg.waitForTimeout(900);
    await look('Bereich „' + tab + '“');
  }
  const open = async (k, label) => {
    const ok = await pg.evaluate((k) => { if (!window.WU_OPEN) return false; window.WU_OPEN(k); return true; }, k);
    if (!ok) { fail('WU_OPEN fehlt'); return; }
    await pg.waitForTimeout(1200); await look(label);
    await pg.evaluate(() => { const x = document.getElementById('shx'); if (x && !document.getElementById('sh').hidden) x.click(); const c = document.getElementById('co-x'); if (c) c.click(); });
    await pg.waitForTimeout(300);
  };
  await open('w:2026-11-16', 'Woche planen (aktuelle Woche)');
  await open('w:2026-11-23', 'Woche planen (nächste Woche)');
  await open('a:' + A[A.length - 1].id, 'Einheit im Detail');
  await open('coach', 'Coach');
  await open('cfg', 'Einstellungen Training und Ziele');
  await open('jr', 'Jahresrückblick');
  await open('rb1', 'Rennblatt Mondsee');
  await open('rb2', 'Rennblatt Ötztaler');
  for (const k of ['leist', 'trn', 'koerp', 'abz', 'einh']) {
    await pg.evaluate((k) => { location.hash = '#analyse'; const b = document.querySelector('#analyse [data-atop="' + k + '"]'); if (b) b.click(); }, k); await pg.waitForTimeout(600);
    await look('Fortschritt „' + k + '“');
  }
  await pg.evaluate(() => { location.hash = '#weg'; }); await pg.waitForTimeout(500);
  await pg.evaluate(() => { const b = document.querySelector('[data-s1p]'); if (b) b.click(); }); await pg.waitForTimeout(600);
  await look('Saison → Phase');
  // Tablet-Dashboard
  await pg.setViewportSize({ width: 1280, height: 800 });
  await pg.evaluate(() => { location.hash = '#dash'; }); await pg.waitForTimeout(1500);
  await look('Tablet-Dashboard');
  if (errs.length) for (const e of [...new Set(errs)].slice(0, 5)) fail('Skriptfehler: ' + e.slice(0, 200));
  if (process.env.SHOTS) { await pg.setViewportSize({ width: 390, height: 844 }); for (const [h, f, k] of [['weg', 'saison'], ['saison', 'phasen'], ['analyse', 'f_leist', 'leist'], ['analyse', 'f_trn', 'trn'], ['analyse', 'f_koerp', 'koerp'], ['analyse', 'f_abz', 'abz'], ['einheiten', 'f_einh']]) { await pg.evaluate(([h, k]) => { location.hash = '#' + h; if (k) { const b = document.querySelector('#analyse [data-atop="' + k + '"]'); if (b) b.click(); } }, [h, k]); await pg.waitForTimeout(900); await pg.evaluate(() => window.scrollTo(0, 0)); await pg.screenshot({ path: process.env.SHOTS + '/' + f + '.png' }); } for (const k of ['rb1', 'rb2']) { await pg.setViewportSize({ width: 390, height: 3400 }); await pg.evaluate((k) => window.WU_OPEN(k), k); await pg.waitForTimeout(1000); await pg.evaluate(() => document.querySelectorAll('#sh details').forEach((d) => d.open = true)); await pg.waitForTimeout(300); await pg.screenshot({ path: process.env.SHOTS + '/' + k + '.png' }); await pg.evaluate(() => document.getElementById('shx').click()); } }
  await b.close();
}

staticCheck(SRC);
await runtimeCheck();
if (fails.length) { console.log('\nSelbsttest fehlgeschlagen: ' + fails.length + ' Problem(e)'); process.exit(1); }
console.log('\nSelbsttest bestanden');
