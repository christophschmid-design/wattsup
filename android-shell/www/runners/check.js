// Läuft im Hintergrund (etwa alle 30 Minuten): meldet neue Strava-Aktivitäten.
function kvGet() {
  try { var r = CapacitorKV.get('cfg'); return JSON.parse((r && r.value) || '{}') || {}; } catch (e) { return {}; }
}
function kvSet(c) { CapacitorKV.set('cfg', JSON.stringify(c)); }

addEventListener('config', function (resolve, reject, args) {
  try {
    var c = kvGet(), a = args || {};
    var keep = c.tok && a.tok && c.tok.x > a.tok.x ? c.tok : (a.tok || c.tok);
    var n = { stId: a.stId, stSec: a.stSec, tok: keep, last: c.last && (!a.last || c.last > a.last) ? c.last : (a.last || c.last || ''), on: a.on !== false };
    kvSet(n);
    resolve({ tok: keep });
  } catch (e) { resolve({}); }
});

addEventListener('check', async function (resolve, reject) {
  try {
    var c = kvGet();
    if (!c.on || !c.stId || !c.tok) { resolve(); return; }
    var t = c.tok;
    if (t.x * 1000 - 120000 < Date.now()) {
      var r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: c.stId, client_secret: c.stSec, refresh_token: t.r, grant_type: 'refresh_token' }) });
      if (!r.ok) { resolve(); return; }
      var j = await r.json();
      t = { a: j.access_token, r: j.refresh_token || t.r, x: j.expires_at, who: t.who };
      c.tok = t; kvSet(c);
    }
    var r2 = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=3', { headers: { Authorization: 'Bearer ' + t.a } });
    if (!r2.ok) { resolve(); return; }
    var arr = await r2.json(), seen = c.last || '';
    var neu = arr.filter(function (a) { return (a.start_date || '') > seen; });
    if (seen && neu.length) {
      var a = neu[0], min = Math.round((a.moving_time || 0) / 60);
      CapacitorNotifications.schedule([{
        id: 3000 + (Math.floor(Date.now() / 1000) % 1000),
        title: 'Neue Aktivität: ' + a.name,
        body: min + ' min' + (a.distance ? ', ' + (a.distance / 1000).toFixed(1).replace('.', ',') + ' km' : '') + '. Kurz in WattsUp bewerten?',
        scheduleAt: new Date(Date.now() + 2000)
      }]);
    }
    arr.forEach(function (a) { if ((a.start_date || '') > (c.last || '')) c.last = a.start_date; });
    kvSet(c);
    resolve();
  } catch (e) { resolve(); }
});
