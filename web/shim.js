/* WattsUp, eigenständige Laufzeit.
   Ersetzt die Claude-Laufzeit (window.claude.use) durch direkte Zugriffe auf
   Strava, Google Kalender und Drive, Open-Meteo und die Claude-Schnittstelle.
   Die App selbst bleibt unverändert. */
(function () {
  'use strict';
  var VER = 'web-2';
  var HOME = location.origin + location.pathname.replace(/index\.html$/, '');
  var CAPN = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var PL = (window.Capacitor && window.Capacitor.Plugins) || {};
  var CAL0 = 'to0nbho9j5d91ac0mref1bh804@group.calendar.google.com';
  var GEO = { lat: 47.796, lon: 13.046, name: 'Salzburg' };
  var MODELS = {
    'claude-sonnet-5-5': { n: 'Sonnet 5.5', i: 2, o: 10 },
    'claude-opus-5-5': { n: 'Opus 5.5', i: 4, o: 20 },
    'claude-haiku-5-5': { n: 'Haiku 5.5', i: 0.1, o: 0.5 },
    'claude-fable-5-2': { n: 'Fable 5.2', i: 8, o: 40 }
  };

  /* ---------- Speicher ---------- */
  function lg(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function ls(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function cfg() { return lg('wu_cfg', {}) || {}; }
  function setCfg(p) { var c = cfg(); Object.keys(p).forEach(function (k) { c[k] = p[k]; }); ls('wu_cfg', c); return c; }
  function fail(code, msg, extra) { var e = new Error(msg); e.code = code; if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; }); return e; }
  function qs(o) { return Object.keys(o).filter(function (k) { return o[k] != null && o[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
  function now() { return Date.now(); }

  async function http(url, opt) {
    opt = opt || {};
    var r;
    try { r = await fetch(url, opt); } catch (e) { throw fail('network', 'Keine Verbindung (' + (e && e.message || e) + ')', { retryable: true }); }
    var txt = await r.text(), js = null;
    try { js = txt ? JSON.parse(txt) : null; } catch (e) { }
    if (!r.ok) {
      var m = (js && (js.message || (js.error && (js.error.message || js.error)) || js.error_description)) || txt || ('HTTP ' + r.status);
      if (typeof m !== 'string') m = JSON.stringify(m);
      if (r.status === 429) throw fail('rate_limited', 'Too Many Requests', { retryable: true, status: 429 });
      if (r.status === 401) throw fail('needs_reauth', m, { status: 401 });
      throw fail('tool_error', m, { status: r.status, retryable: r.status >= 500 });
    }
    return js;
  }

  /* ---------- Strava ---------- */
  var SV = 'https://www.strava.com';
  function stTok() { return lg('wu_strava', null); }
  /* Darf die App Einheiten hochladen? sc = beim Verbinden erteilte Rechte; w = Ergebnis des letzten Hochladens */
  function stWr() {
    var t = stTok() || {};
    if (t.w === 0) return st(false, 'Hochladen nicht erlaubt') + ' <span class="wu-mu">Strava hat das letzte Hochladen abgelehnt. Bitte neu verbinden und alle Häkchen setzen.</span>';
    if (/activity:write/.test(t.sc || '') || t.w === 1) return st(true, 'Hochladen erlaubt') + (t.at ? ' <span class="wu-mu">seit ' + new Date(t.at).toLocaleDateString('de-AT') + '</span>' : '');
    return st(false, 'Hochladen noch nicht erlaubt') + ' <span class="wu-mu">Die Verbindung stammt von vor der Umstellung. Einmal „Neu verbinden“ und alle Häkchen setzen.</span>';
  }
  function stMark(ok) { var t = stTok(); if (t) { t.w = ok ? 1 : 0; ls('wu_strava', t); } }
  function stOk() { var c = cfg(); return !!(c.stId && c.stSec && stTok()); }
  function stConnect() {
    var c = cfg();
    if (!c.stId || !c.stSec) { WU.open('Bitte zuerst Client-ID und Client-Secret von Strava eintragen.'); return; }
    location.href = SV + '/oauth/authorize?' + qs({ client_id: c.stId, redirect_uri: HOME, response_type: 'code', approval_prompt: 'auto', scope: 'read,activity:read_all,activity:write,profile:read_all', state: 'strava' });
  }
  async function stExchange(code, sc) {
    var c = cfg();
    var j = await http(SV + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: c.stId, client_secret: c.stSec, code: code, grant_type: 'authorization_code' }) });
    ls('wu_strava', { a: j.access_token, r: j.refresh_token, x: j.expires_at, who: j.athlete && (j.athlete.firstname || ''), sc: sc || '', at: now() });
  }
  async function stToken() {
    var t = stTok(), c = cfg();
    if (!t || !c.stId) throw fail('server_not_connected', 'Strava ist nicht verbunden');
    if (t.x * 1000 - 120000 > now()) return t.a;
    var j = await http(SV + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: c.stId, client_secret: c.stSec, refresh_token: t.r, grant_type: 'refresh_token' }) });
    t.a = j.access_token; t.r = j.refresh_token || t.r; t.x = j.expires_at; ls('wu_strava', t);
    return t.a;
  }
  async function sv(path) {
    var tk = await stToken();
    try { return await http(SV + '/api/v3' + path, { headers: { Authorization: 'Bearer ' + tk } }); }
    catch (e) { if (e.code === 'needs_reauth') { ls('wu_strava', null); } throw e; }
  }
  /* Manuelle Aktivität anlegen (z. B. Krafttraining); braucht activity:write */
  window.WU_STRAVA_ADD = async function (o) {
    var tk = await stToken(), d = o.start, p2 = function (n) { return ('0' + n).slice(-2); };
    var loc = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':00';
    var body = qs({ name: o.name, sport_type: o.sport_type || 'WeightTraining', type: 'Workout', start_date_local: loc, elapsed_time: Math.round(o.sec), description: o.desc || '' });
    var r;
    try { r = await http(SV + '/api/v3/activities', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/x-www-form-urlencoded' }, body: body }); }
    catch (e) { if (e && (e.status === 401 || e.status === 403)) { stMark(false); throw new Error('Berechtigung activity:write fehlt (' + e.status + ')'); } throw e; }
    stMark(true);
    /* Für Follower ausblenden (nicht im Feed, im Profil weiter sichtbar) */
    if (r && r.id) {
      try { await http(SV + '/api/v3/activities/' + r.id, { method: 'PUT', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs({ hide_from_home: 'true' }) }); r.hidden = true; }
      catch (e2) { r.hidden = false; }
    }
    return r;
  };
  var athP = null;
  function athlete() { if (!athP) { athP = sv('/athlete').catch(function (e) { athP = null; throw e; }); } return athP; }
  function locSec(s) { /* lokale Zeit ohne Zone als Unix-Sekunden */ var d = new Date(String(s).replace(/Z$/, '')); return Math.floor(d.getTime() / 1000); }
  var SKEY = { heart_rate: 'heartrate', location: 'latlng' };
  function bucket(arr, n, mode) {
    if (!arr || !arr.length || !n || arr.length <= n) return arr;
    var out = [], L = arr.length;
    for (var i = 0; i < n; i++) {
      var a = Math.floor(i * L / n), b = Math.max(a + 1, Math.floor((i + 1) * L / n));
      if (mode === 'last') out.push(arr[b - 1]);
      else if (mode === 'first') out.push(arr[a]);
      else { var s = 0, c = 0; for (var j = a; j < b; j++) { var v = arr[j]; if (typeof v === 'number') { s += v; c++; } } out.push(c ? Math.round(s / c * 10) / 10 : null); }
    }
    return out;
  }
  var STRAVA = {
    list_activities: async function (q) {
      var per = Math.min(100, q.first || 30), page = Number(q.after || 1);
      var p = { per_page: per, page: page };
      if (q.range_start) p.after = locSec(q.range_start) - 86400;
      if (q.range_end) p.before = locSec(q.range_end) + 86400;
      var arr = await sv('/athlete/activities?' + qs(p)) || [];
      var lo = q.range_start ? String(q.range_start).slice(0, 19) : null, hi = q.range_end ? String(q.range_end).slice(0, 19) : null;
      var acts = arr.map(function (a) {
        var st = String(a.start_date_local || '').replace(/Z$/, '');
        return {
          id: String(a.id), name: a.name, sport_type: a.sport_type || a.type, start_local: st, is_trainer: !!a.trainer,
          summary: {
            distance: a.distance != null ? a.distance / 1000 : null, moving_time: a.moving_time, elapsed_time: a.elapsed_time,
            elevation_gain: a.total_elevation_gain, avg_speed: a.average_speed != null ? a.average_speed * 3.6 : null, max_speed: a.max_speed != null ? a.max_speed * 3.6 : null,
            relative_effort: a.suffer_score != null ? Math.round(a.suffer_score) : null,
            total_calories: a.calories != null ? Math.round(a.calories) : (a.kilojoules != null ? Math.round(a.kilojoules) : null),
            avg_heartrate: a.average_heartrate, avg_watts: a.average_watts, weighted_avg_watts: a.weighted_average_watts
          }
        };
      }).filter(function (a) { return (!lo || a.start_local >= lo) && (!hi || a.start_local <= hi); });
      if (q.ordering !== 'StartDateLocalDesc') acts.sort(function (a, b) { return a.start_local < b.start_local ? -1 : 1; });
      else acts.sort(function (a, b) { return a.start_local < b.start_local ? 1 : -1; });
      var more = arr.length === per;
      return { activities: acts, has_next_page: more, end_cursor: more ? String(page + 1) : null, value_units: { distance: 'kilometers', avg_speed: 'kilometers/hour' } };
    },
    get_activity_streams: async function (q) {
      var keys = (q.streams || []).map(function (s) { return SKEY[s] || s; });
      if (keys.indexOf('time') < 0) keys.push('time');
      var j = await sv('/activities/' + encodeURIComponent(q.activity_id) + '/streams?' + qs({ keys: keys.join(','), key_by_type: 'true' })) || {};
      var out = {}, n = q.resolution || 0;
      (q.streams || []).concat(['time']).forEach(function (s) {
        var k = SKEY[s] || s, st = j[k];
        if (!st || !st.data) return;
        out[s] = bucket(st.data, n, s === 'time' ? 'last' : s === 'location' || s === 'moving' ? 'first' : 'avg');
      });
      return out;
    },
    get_athlete_zones: async function () {
      var a = await athlete(), z = await sv('/athlete/zones').catch(function () { return {}; });
      var hz = z.heart_rate && z.heart_rate.zones, pz = z.power && z.power.zones;
      function mz(l) { return (l || []).map(function (x) { var o = { min: x.min }; if (x.max > 0) o.max = x.max; return o; }); }
      return { heart_rate_zones: mz(hz), power_zones: mz(pz), ftp: a.ftp || null, ftp_is_estimated: false, heart_rate_zone_source: z.heart_rate && z.heart_rate.custom_zones ? 'Custom' : 'MaxHeartRateFromAge' };
    },
    get_athlete_profile: async function () {
      var a = await athlete();
      return { id: a.id, first_name: a.firstname, last_name: a.lastname, weight: a.weight, measurement_preference: a.measurement_preference === 'feet' ? 'Imperial' : 'Metric' };
    },
    get_athlete_best_efforts: async function () { return { efforts: [] }; },
    get_active_streak: async function () { return []; }
  };

  /* ---------- Wetter (Open-Meteo im Format der bisherigen Vorhersage) ---------- */
  var WMO = { 0: 'Sonnig', 1: 'Überwiegend sonnig', 2: 'Teils bewölkt', 3: 'Bewölkt', 45: 'Nebel', 48: 'Raureifnebel', 51: 'Leichter Nieselregen', 53: 'Nieselregen', 55: 'Starker Nieselregen', 56: 'Gefrierender Nieselregen', 57: 'Gefrierender Nieselregen', 61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen', 66: 'Gefrierender Regen', 67: 'Gefrierender Regen', 71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall', 77: 'Schneegriesel', 80: 'Regenschauer', 81: 'Regenschauer', 82: 'Starke Regenschauer', 85: 'Schneeschauer', 86: 'Starke Schneeschauer', 95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Gewitter mit Hagel' };
  async function weather() {
    var u = 'https://api.open-meteo.com/v1/forecast?' + qs({ latitude: GEO.lat, longitude: GEO.lon, daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum,rain_sum,wind_gusts_10m_max', timezone: 'Europe/Vienna', forecast_days: 10 });
    var j = await http(u), d = j.daily || {};
    var out = (d.time || []).map(function (t, i) {
      var pp = d.precipitation_probability_max[i] || 0, sn = d.snowfall_sum[i] || 0, rn = d.rain_sum[i] || 0, wc = d.weather_code[i];
      var snowy = sn > 0 && (rn === 0 || sn * 7 > rn);
      return {
        date: t + 'T07:00:00+01:00',
        day: { temperature: d.temperature_2m_max[i], iconPhrase: WMO[wc] || '', rainProbabilityValue: snowy ? Math.round(pp / 3) : pp, snowProbabilityValue: sn > 0 ? pp : 0, extended: { gusts: Math.round(d.wind_gusts_10m_max[i] || 0) + ' km/h' } },
        night: { temperature: d.temperature_2m_min[i] }
      };
    });
    return { dailyForecast: out, location: { localizedName: GEO.name } };
  }

  /* ---------- Google (Kalender und Sync über Drive) ---------- */
  var GSC = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.appdata';
  function gTok() { return lg('wu_google', null); }
  function gOk() { var c = cfg(); return !!(c.gId && c.gSec && gTok()); }
  function gAuthUrl(state) {
    var c = cfg();
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + qs({ client_id: c.gId, redirect_uri: HOME, response_type: 'code', scope: GSC, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: state });
  }
  async function gConnect() {
    var c = cfg();
    if (!c.gId || !c.gSec) { WU.open('Bitte zuerst Client-ID und Client-Secret von Google eintragen.'); return; }
    if (CAPN && PL.Browser) { await PL.Browser.open({ url: gAuthUrl('google_app') }); }
    else location.href = gAuthUrl('google');
  }
  async function gExchange(code) {
    var c = cfg();
    var j = await http('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs({ code: code, client_id: c.gId, client_secret: c.gSec, redirect_uri: HOME, grant_type: 'authorization_code' }) });
    var old = gTok() || {};
    ls('wu_google', { a: j.access_token, r: j.refresh_token || old.r, x: now() + (j.expires_in || 3500) * 1000 });
  }
  async function gToken() {
    var t = gTok(), c = cfg();
    if (!t || !c.gId) throw fail('server_not_connected', 'Google ist nicht verbunden');
    if (t.x - 120000 > now()) return t.a;
    if (!t.r) throw fail('needs_reauth', 'Google neu verbinden');
    try {
      var j = await http('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs({ client_id: c.gId, client_secret: c.gSec, refresh_token: t.r, grant_type: 'refresh_token' }) });
      t.a = j.access_token; t.x = now() + (j.expires_in || 3500) * 1000; ls('wu_google', t); return t.a;
    } catch (e) { if (e.status === 400 || e.status === 401) { ls('wu_google', null); throw fail('needs_reauth', 'Google neu verbinden'); } throw e; }
  }
  async function gApi(url, opt) {
    opt = opt || {}; var tk = await gToken();
    opt.headers = Object.assign({ Authorization: 'Bearer ' + tk }, opt.headers || {});
    return http(url, opt);
  }
  function rfc(local) { /* 2026-11-16T19:00:00 in lokaler Zeit -> mit Zone */ var d = new Date(String(local)); return isNaN(d) ? local : d.toISOString(); }
  var GC = 'https://www.googleapis.com/calendar/v3/calendars/';
  var GCAL = {
    list_events: async function (q) {
      var cal = q.calendarId || cfg().cal || CAL0;
      var j = await gApi(GC + encodeURIComponent(cal) + '/events?' + qs({ timeMin: q.startTime ? rfc(q.startTime) : null, timeMax: q.endTime ? rfc(q.endTime) : null, singleEvents: 'true', orderBy: q.orderBy === 'startTime' ? 'startTime' : null, maxResults: q.pageSize || 100, pageToken: q.pageToken, timeZone: 'Europe/Vienna' }));
      return { summary: j.summary, timeZone: j.timeZone, nextPageToken: j.nextPageToken, events: j.items || [] };
    },
    create_event: async function (q) {
      var cal = q.calendarId || cfg().cal || CAL0;
      var b = { summary: q.summary, description: q.description, location: q.location, start: { dateTime: q.startTime, timeZone: 'Europe/Vienna' }, end: { dateTime: q.endTime, timeZone: 'Europe/Vienna' } };
      return gApi(GC + encodeURIComponent(cal) + '/events?sendUpdates=none', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    },
    delete_event: async function (q) {
      var cal = q.calendarId || cfg().cal || CAL0;
      await gApi(GC + encodeURIComponent(cal) + '/events/' + encodeURIComponent(q.eventId) + '?sendUpdates=none', { method: 'DELETE' });
      return {};
    }
  };

  /* ---------- Datenbank: lokal, Abgleich über Google Drive ---------- */
  var DBK = 'wu_db', DFN = 'wattsup-daten.json';
  function dbAll() { return lg(DBK, {}) || {}; }
  var syncP = null, pushT = null, SYNC = lg('wu_sync', { st: 'aus', ts: 0, msg: '' });
  function syncSt(st, msg) { SYNC = { st: st, ts: now(), msg: msg || '' }; ls('wu_sync', SYNC); }
  async function dFind() {
    var j = await gApi('https://www.googleapis.com/drive/v3/files?' + qs({ spaces: 'appDataFolder', q: "name='" + DFN + "'", fields: 'files(id,modifiedTime)' }));
    return j.files && j.files[0] ? j.files[0].id : null;
  }
  function merge(a, b) { var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; }); Object.keys(b).forEach(function (k) { if (!o[k] || (b[k].ts || 0) > (o[k].ts || 0)) o[k] = b[k]; }); return o; }
  async function pull() {
    if (!gOk()) { syncSt('aus'); return; }
    try {
      var id = await dFind(); ls('wu_dfid', id);
      if (id) { var tk = await gToken(); var r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media', { headers: { Authorization: 'Bearer ' + tk } }); if (r.ok) { var rem = await r.json(), before = JSON.stringify(dbAll()), mg = merge(dbAll(), (rem && rem.docs) || {}); ls(DBK, mg); lastPull = now(); if (JSON.stringify(mg) !== before) { try { window.dispatchEvent(new Event('wu-db-pulled')); } catch (e) { } } } }
      syncSt('ok');
    } catch (e) { syncSt('err', e.message); }
  }
  async function push() {
    if (!gOk()) return;
    try {
      var body = JSON.stringify({ v: 1, ts: now(), docs: dbAll() }), id = lg('wu_dfid', null) || await dFind();
      if (id) await gApi('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: body });
      else {
        var bd = 'wu' + now(), mp = '--' + bd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: DFN, parents: ['appDataFolder'] }) + '\r\n--' + bd + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + bd + '--';
        var j = await gApi('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + bd }, body: mp });
        ls('wu_dfid', j.id);
      }
      syncSt('ok');
    } catch (e) { syncSt('err', e.message); }
  }
  var lastPull = 0;
  /* Laufender Abgleich: alle 10 Minuten und beim Zurückkehren ins Fenster neue Daten anderer Geräte holen */
  setInterval(function () { if (document.visibilityState === 'visible' && syncP) pull(); }, 10 * 60000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && syncP && now() - lastPull > 2 * 60000) pull(); });
  function schedulePush() { clearTimeout(pushT); pushT = setTimeout(push, 2500); }
  function ready() { if (!syncP) syncP = Promise.race([pull(), new Promise(function (r) { setTimeout(r, 6000); })]); return syncP; }
  function snap(path, rec) { return { id: path.split('/').pop(), exists: !!rec, data: function () { return rec ? JSON.parse(JSON.stringify(rec.d)) : undefined; } }; }
  var DB = {
    doc: function (path) {
      return {
        id: path.split('/').pop(),
        get: async function () { await ready(); return snap(path, dbAll()[path]); },
        set: async function (data, opt) { var a = dbAll(), cur = a[path]; var d = opt && opt.merge && cur ? Object.assign({}, cur.d, data) : data; a[path] = { d: JSON.parse(JSON.stringify(d)), ts: now() }; ls(DBK, a); schedulePush(); },
        update: async function (data) { var a = dbAll(), cur = a[path]; a[path] = { d: Object.assign({}, cur ? cur.d : {}, data), ts: now() }; ls(DBK, a); schedulePush(); },
        delete: async function () { var a = dbAll(); a[path] = { d: null, ts: now(), del: 1 }; ls(DBK, a); schedulePush(); }
      };
    },
    collection: function (path) {
      var pre = path.replace(/\/$/, '') + '/';
      return {
        doc: function (k) { return DB.doc(pre + k); },
        get: async function () {
          await ready(); var a = dbAll();
          var docs = Object.keys(a).filter(function (k) { return k.indexOf(pre) === 0 && k.slice(pre.length).indexOf('/') < 0 && !a[k].del && a[k].d != null; }).sort().map(function (k) { return snap(k, a[k]); });
          return { docs: docs, empty: !docs.length, size: docs.length, forEach: function (f) { docs.forEach(f); } };
        }
      };
    }
  };

  /* ---------- Claude-Schnittstelle mit Kostenkontrolle ---------- */
  function costs() { return lg('wu_cost', []) || []; }
  function monthKey(t) { var d = new Date(t); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function monthSum() { var m = monthKey(now()); return costs().filter(function (c) { return monthKey(c.ts) === m; }).reduce(function (s, c) { return s + c.usd; }, 0); }
  window.WU_LIMIT = function () { return Number(cfg().limit || 0); };
  function usd(v) { return v.toFixed(v < 1 ? 3 : 2).replace('.', ',') + ' $'; }
  /* Guthaben in der Anthropic Console aufgebraucht: klare Meldung, Hinweis im Coach und einmal am Tag eine Push-Nachricht */
  function noCredit() {
    var t = now(), last = Number(lg('wu_nocredit', 0)) || 0;
    ls('wu_nocredit', t);
    try { window.dispatchEvent(new Event('wu-credit')); } catch (e) { }
    if (t - last > 20 * 3600 * 1000 && window.WU_NOTIFY) { try { window.WU_NOTIFY('Claude-Guthaben aufgebraucht', 'Coach und Wochenplanung pausieren, bis du in der Anthropic Console unter Billing aufgeladen hast.', 'coach'); } catch (e) { } }
    return fail('no_credit', 'Dein Guthaben in der Anthropic Console ist aufgebraucht. Coach und Wochenplanung gehen wieder, sobald du unter platform.claude.com → Billing aufgeladen hast.');
  }
  window.WU_NOCREDIT = function () { return Number(lg('wu_nocredit', 0)) || 0; };
  async function ask(input, opts) {
    var c = cfg(); opts = opts || {};
    if (!c.aKey) throw fail('not_granted', 'Kein Schlüssel für die Claude-Schnittstelle eingetragen');
    var model = c.once || c.model || 'claude-sonnet-5-5', M = MODELS[model] || MODELS['claude-sonnet-5-5'];
    var lim = Number(c.limit || 0), ms = monthSum();
    if (lim > 0 && ms >= lim && !c.over) throw fail('rate_limited', 'Monatsgrenze von ' + usd(lim) + ' erreicht. Unter Einstellungen → Claude und Kosten anpassen.');
    var msgs = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
    var body = { model: model, max_tokens: opts.maxTokens || 16000, messages: msgs };
    var jsys = 'Antworte ausschließlich mit einem einzigen gültigen JSON-Objekt. Kein Markdown, keine Codeblöcke, kein Text davor oder danach.';
    if (opts.system) body.system = typeof opts.system === 'string' ? (opts.json ? opts.system + '\n' + jsys : opts.system) : (opts.json ? opts.system.concat([{ type: 'text', text: jsys }]) : opts.system);
    else if (opts.json) body.system = jsys;
    var rq = { method: 'POST', signal: opts.signal, headers: { 'Content-Type': 'application/json', 'x-api-key': c.aKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) }, j;
    try { j = await http('https://api.anthropic.com/v1/messages', rq); }
    catch (e) {
      if (e && e.status === 400 && /credit balance/i.test(e.message || '')) throw noCredit();
      /* Verbindung abgerissen (z. B. App kurz im Hintergrund, Funkloch): einmal still wiederholen */
      if (!e || e.code !== 'network' || (opts.signal && opts.signal.aborted)) throw e;
      await new Promise(function (r) { setTimeout(r, 2500); });
      try { j = await http('https://api.anthropic.com/v1/messages', rq); }
      catch (e2) { if (e2 && e2.status === 400 && /credit balance/i.test(e2.message || '')) throw noCredit(); if (e2 && e2.code === 'network') e2.message = 'Keine Verbindung zu Claude (zweimal versucht). Bitte Internet prüfen und die App während der Planung im Vordergrund lassen.'; throw e2; }
    }
    if (lg('wu_nocredit', 0)) { ls('wu_nocredit', 0); try { window.dispatchEvent(new Event('wu-credit')); } catch (e) { } }
    var u = j.usage || {}, inp = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1, out = u.output_tokens || 0;
    var cost = (inp * M.i + out * M.o) / 1e6, list = costs();
    list.push({ ts: now(), model: model, i: u.input_tokens || 0, o: out, usd: cost }); if (list.length > 400) list = list.slice(-400); ls('wu_cost', list);
    if (c.once) setCfg({ once: null });
    try { window.dispatchEvent(new CustomEvent('wu-cost', { detail: { usd: cost, tag: opts.tag || 'plan', model: model } })); } catch (e) { }
    if (!opts.quiet) toast('Planung mit ' + M.n + ': ' + usd(cost) + (lim > 0 ? ', Monat ' + usd(monthSum()) + ' von ' + usd(lim) : ', Monat ' + usd(monthSum())));
    if (lim > 0 && monthSum() >= lim * 0.8 && monthSum() < lim) setTimeout(function () { toast('Achtung: 80 % der Monatsgrenze erreicht.'); }, 4200);
    return (j.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  }
  function parseJson(t) {
    t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(t); } catch (e) { }
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { } }
    var a2 = t.indexOf('['), b2 = t.lastIndexOf(']');
    if (a2 >= 0 && b2 > a2) { try { return JSON.parse(t.slice(a2, b2 + 1)); } catch (e) { } }
    throw fail('tool_error', 'Die Antwort von Claude war kein gültiges JSON');
  }
  var SAMPLE = function (input, opts) {
    return ask(input, opts).then(function (t) { if (opts && opts.onText) try { opts.onText({ text: t, delta: t }); } catch (e) { } return { text: t, truncated: false }; });
  };
  SAMPLE.json = function (input, opts) { return ask(input, Object.assign({}, opts || {}, { json: true })).then(parseJson); };
  SAMPLE.limits = async function () { return { images: false }; };

  /* ---------- Werkzeug-Aufrufe ---------- */
  var CACHE = {};
  async function callTool(server, tool, input, opt) {
    input = input || {}; opt = opt || {};
    var fn = null;
    if (server === 'Strava') fn = STRAVA[tool];
    else if (/AccuWeather/.test(server)) fn = weather;
    else if (server === 'Google Calendar') fn = GCAL[tool];
    if (!fn) throw fail('not_in_manifest', 'Unbekanntes Werkzeug ' + server + '/' + tool);
    var ck = server + '|' + tool + '|' + JSON.stringify(input), c = opt.cache, hit = CACHE[ck];
    if (c && typeof c === 'object' && !c.refresh && hit && now() - hit.t < (c.staleTime || 0)) return { payload: hit.p, cache: { storedAt: hit.t } };
    var p = await fn(input);
    if (c !== false) CACHE[ck] = { p: p, t: now() };
    return { payload: p, cache: { storedAt: now() } };
  }
  var MCP = { callTool: callTool, server: async function (name) { var o = {}; ['list_activities', 'get_activity_streams', 'get_athlete_zones', 'get_athlete_profile', 'get_athlete_best_efforts', 'get_active_streak', 'list_events', 'create_event', 'delete_event', 'widgets-daily-claude'].forEach(function (t) { o[t] = function (i) { return callTool(name, t, i).then(function (r) { return r.payload; }); }; }); return o; } };

  /* ---------- Dateien speichern ---------- */
  function b64(u8) { var s = '', i, ch = 0x8000; for (i = 0; i < u8.length; i += ch) s += String.fromCharCode.apply(null, u8.subarray(i, i + ch)); return btoa(s); }
  var DL = {
    save: async function (o) {
      var data = o.data, name = o.filename || 'wattsup.txt';
      if (CAPN && PL.Filesystem && PL.Share) {
        var u8 = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(await new Blob([data]).arrayBuffer());
        var w = await PL.Filesystem.writeFile({ path: name, data: b64(u8), directory: 'CACHE' });
        await PL.Share.share({ title: name, files: [w.uri] });
        return;
      }
      var blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }
  };

  /* ---------- Laufzeit-Ersatz ---------- */
  var PERM = { state: async function (n) { var m = { mcp: stOk() ? 'granted' : 'denied', sample: cfg().aKey ? 'granted' : 'denied', db: 'granted', downloads: 'granted', user: 'granted' }; return n ? m[n] : m; }, request: async function () { return PERM.state(); }, manage: async function () { WU.open(); } };
  var USER = { id: async function () { return 'me'; }, me: async function () { return { id: 'me', name: (stTok() || {}).who || '' }; }, isOwner: function () { return true; }, canEdit: function () { return true; }, can: function () { return true; }, profiles: async function () { return {}; } };
  var NS = { mcp: MCP, sample: SAMPLE, db: DB, user: USER, downloads: DL, permissions: PERM };
  window.claude = { use: function (n) { return Promise.resolve(NS[n] || null); } };

  /* ---------- Anmelde-Rückkehr ---------- */
  var RET = (function () {
    var p = new URLSearchParams(location.search), code = p.get('code'), st = p.get('state'), er = p.get('error'), sc = p.get('scope');
    if (!st || (!code && !er)) return null;
    history.replaceState(null, '', HOME);
    return { code: code, st: st, err: er, sc: sc };
  })();
  async function handleReturn(r) {
    if (r.err) { toast('Anmeldung abgebrochen: ' + r.err); return; }
    if (r.st === 'google_app') {
      /* Im System-Browser gelandet: zurück in die App */
      var back = 'wattsup://oauth?' + qs({ code: r.code, state: 'google' });
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () { document.body.innerHTML = '<div style="font:17px system-ui;padding:40px 24px;text-align:center;color:#0f2236"><p>Google ist bestätigt.</p><p><a href="' + back + '" style="display:inline-block;background:#1a6be0;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:600">Zurück zu WattsUp</a></p></div>'; }, 50);
      });
      try { location.href = back; } catch (e) { }
      return 'stop';
    }
    try {
      if (r.st === 'strava') { await stExchange(r.code, r.sc); toast(/activity:write/.test(r.sc || '') ? 'Strava ist verbunden, Hochladen ist erlaubt.' : 'Strava ist verbunden, aber ohne Erlaubnis zum Hochladen. Bitte beim Verbinden alle Häkchen setzen.'); }
      if (r.st === 'google') { await gExchange(r.code); syncP = null; await pull(); schedulePush(); toast('Google ist verbunden.'); }
    } catch (e) { toast('Verbinden fehlgeschlagen: ' + e.message); }
  }
  if (CAPN && PL.App) {
    PL.App.addListener('appUrlOpen', async function (ev) {
      try {
        var u = new URL(ev.url), code = u.searchParams.get('code');
        if (code) { if (PL.Browser) try { await PL.Browser.close(); } catch (e) { } await gExchange(code); syncP = null; await pull(); schedulePush(); toast('Google ist verbunden. WattsUp lädt neu …'); setTimeout(function () { location.reload(); }, 1200); }
      } catch (e) { toast('Google-Anmeldung fehlgeschlagen: ' + e.message); }
    });
  }

  /* ---------- Oberfläche: Einstellungen ---------- */
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var CSS = '.wu-ov[hidden],.wu-t[hidden]{display:none!important}.wu-ov{position:fixed;inset:0;z-index:9999;background:rgba(8,18,30,.55);display:flex;align-items:flex-end;justify-content:center}' +
    '.wu-sh{background:var(--bg,#f3f5f8);color:var(--ink,#0f2236);width:100%;max-width:640px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:18px 16px 28px;box-sizing:border-box;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    '@media(min-width:700px){.wu-ov{align-items:center}.wu-sh{border-radius:22px}}' +
    '.wu-sh h2{margin:0 0 4px;font-size:1.25rem}.wu-sh h3{margin:18px 0 8px;font-size:1rem}.wu-mu{color:var(--mu,#5b6b7b);font-size:.88rem;margin:4px 0}' +
    '.wu-c{background:var(--card,#fff);color:var(--ink,#0f2236);border-radius:16px;padding:12px 14px;margin:10px 0;box-shadow:0 1px 4px rgba(15,34,54,.08)}' +
    '.wu-sh label{display:block;font-size:.82rem;color:var(--mu,#5b6b7b);margin:8px 0 3px}.wu-sh a{color:var(--ac,#1a6be0)}.wu-sh input,.wu-sh select{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--ln,#cfd8e2);border-radius:10px;font:inherit;background:var(--bg2,#fff);color:var(--ink,#0f2236)}.wu-sh select option{background:var(--card,#fff);color:var(--ink,#0f2236)}' +
    '.wu-b{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:10px 16px;font:600 .92rem system-ui;background:var(--ac,#1a6be0);color:var(--onac,#fff);margin:10px 8px 0 0;cursor:pointer}.wu-b.alt{background:var(--bg2,#e3ebf5);color:var(--ink,#0f2236);box-shadow:inset 0 0 0 1px var(--ln,#d5dee8)}' +
    '.wu-st{display:inline-block;font-size:.78rem;font-weight:700;padding:3px 9px;border-radius:999px;margin-left:6px}.wu-ok{background:rgba(61,220,151,.18);color:var(--ok,#0b7a4b)}.wu-no{background:rgba(255,107,87,.16);color:var(--bad,#b2361f)}.wu-wa{background:rgba(245,176,74,.2);color:var(--warn,#9a6200)}' +
    '.wu-x{float:right;border:0;background:var(--bg2,#e3ebf5);border-radius:50%;width:34px;height:34px;font-size:18px;cursor:pointer;color:var(--ink,#0f2236)}.wu-cp{font:12px ui-monospace,monospace;background:var(--bg2,#e9eef4);color:var(--ink,#0f2236);padding:6px 8px;border-radius:8px;word-break:break-all;display:block;margin-top:4px}' +
    '.wu-t{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translateX(-50%);background:#0f2236;color:#fff;padding:10px 16px;border-radius:12px;font:14px system-ui;z-index:10000;max-width:88vw;box-shadow:0 6px 18px rgba(0,0,0,.3)}' +
    '.wu-upd{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:9998;background:#0f2236;color:#fff;border-radius:16px;padding:12px 12px 12px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);font:14px system-ui}.wu-upd>div{flex:1}.wu-upd b{display:block}.wu-upd span{color:#9fb3c8;font-size:12px}.wu-upd .wu-b{margin:0;background:#3ddc97;color:#0f2236}.wu-upd .wu-x{background:#1d3550;color:#fff;width:30px;height:30px;font-size:16px}.wu-note{background:rgba(245,176,74,.18)!important}.wu-top{display:flex;align-items:center;gap:8px;margin-bottom:4px}.wu-top h2{flex:1;margin:0}.wu-bk{border:0;background:var(--bg2,#e3ebf5);color:var(--ink,#0f2236);border-radius:50%;width:34px;height:34px;font-size:22px;line-height:1;cursor:pointer}.wu-top .wu-x{float:none}.wu-gh{margin:18px 4px 6px;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mu,#5b6b7b)}.wu-grp{background:var(--card,#fff);border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(15,34,54,.08)}.wu-row{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;color:inherit;font:inherit;text-align:left;padding:13px 14px;cursor:pointer;border-bottom:1px solid var(--ln,#e3e9f0)}.wu-row:last-child{border-bottom:0}.wu-row:active{background:var(--bg2,#eef2f6)}.wu-rt{flex:1;min-width:0}.wu-rt b{display:block;font-weight:600}.wu-rt small{display:block;color:var(--mu,#5b6b7b);font-size:.82rem;margin-top:2px}.wu-chev{color:var(--mu,#5b6b7b);font-size:20px}.wu-sh details>summary{cursor:pointer;font-weight:600;padding:2px 0}.wu-sh details[open]>summary{margin-bottom:6px}.wu-tb{width:100%;border-collapse:collapse;font-size:.86rem}.wu-tb td{padding:4px 0;border-bottom:1px solid var(--ln,#e3e9f0)}.wu-tb td:last-child{text-align:right}';
  function addCss() { if (document.getElementById('wu-css')) return; var s = document.createElement('style'); s.id = 'wu-css'; s.textContent = CSS; document.head.appendChild(s); }
  var tT = null;
  function toast(m) { addCss(); var t = document.querySelector('.wu-t'); if (!t) { t = document.createElement('div'); t.className = 'wu-t'; document.body.appendChild(t); } if (!t.onclick) t.onclick = function () { t.hidden = true; }; t.textContent = m; t.hidden = false; clearTimeout(tT); tT = setTimeout(function () { t.hidden = true; }, Math.max(8000, String(m).length * 90)); }
  function st(ok, txt) { return '<span class="wu-st ' + (ok === true ? 'wu-ok' : ok === 'w' ? 'wu-wa' : 'wu-no') + '">' + txt + '</span>'; }
  function chk(id, lab, on) { return '<label style="display:flex;align-items:center;gap:10px;font-size:.95rem;color:inherit;margin:10px 0"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + ' style="width:22px;height:22px;flex:none">' + lab + '</label>'; }
  function fld(id, lab, val, type, ph) { return '<label for="' + id + '">' + lab + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + E(val || '') + '" placeholder="' + E(ph || '') + '" autocomplete="off" autocapitalize="off" spellcheck="false">'; }
  var PG = 'home';
  function hdr(t, sub) { return '<div class="wu-top">' + (PG !== 'home' ? '<button class="wu-bk" data-wu="pg:home" aria-label="Zurück">‹</button>' : '') + '<h2>' + t + '</h2>' + (PG === 'home' ? '<button class="wu-x" data-wu="close" aria-label="Schließen">×</button>' : '') + '</div>' + (sub ? '<p class="wu-mu">' + sub + '</p>' : ''); }
  function row(go, title, sub, chip) { return '<button class="wu-row" data-wu="' + go + '"><span class="wu-rt"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + (chip || '') + '<span class="wu-chev" aria-hidden="true">›</span></button>'; }
  function grp(t, rows) { return '<h3 class="wu-gh">' + t + '</h3><div class="wu-grp">' + rows.join('') + '</div>'; }
  function syncChip() { return SYNC.st === 'ok' ? st(true, 'abgeglichen') : SYNC.st === 'err' ? st(false, 'Fehler') : st('w', 'aus'); }
  function pageHome(note) {
    var c = cfg(), zs = window.WU_ZSUG ? window.WU_ZSUG() : 0, se = window.WU_SRCERR ? window.WU_SRCERR() : [], lim = Number(c.limit || 0), sum = monthSum();
    var nOnN = ['nMood', 'nAct', 'nPlan', 'nWeigh'].filter(function (k) { return c[k] !== false; }).length;
    return hdr('Einstellungen') + (note ? '<p class="wu-c wu-note">' + E(note) + '</p>' : '') +
      grp('Training', [
        row('app:cfg', 'Training und Ziele', 'FTP, Puls, Startzeiten, Renndaten, Zielwerte'),
        row('app:ftp', 'FTP-Test', 'Ablauf, Zwift-Datei und Auswertung'),
        row('app:zon', 'Zonen und Schwellenwerte', zs ? zs + (zs > 1 ? ' neue Vorschläge' : ' neuer Vorschlag') : 'Leistungs- und Pulszonen', zs ? st('w', 'neu') : '')
      ]) +
      grp('Verbindungen', [
        row('pg:strava', 'Strava', stOk() ? 'Aktivitäten und Leistungsdaten' : 'Noch nicht verbunden', stOk() ? st(true, 'verbunden') : st(false, 'aus')),
        row('pg:google', 'Google Kalender und Abgleich', gOk() ? 'Kalender „Training“, Abgleich über Google Drive' : 'Noch nicht verbunden', gOk() ? syncChip() : st(false, 'aus')),
        row('pg:intervals', 'Zwift über intervals.icu', c.ivKey ? (c.ivErr ? c.ivErr : 'Zwift-Einheiten automatisch in Zwift') : 'Noch nicht verbunden', c.ivKey && c.ivOn !== false ? (c.ivErr ? st(false, 'Fehler') : st(true, 'aktiv')) : st('w', 'aus'))
      ].concat(CAPN ? [row('pg:health', 'Gesundheitsdaten', 'Waage, Schlaf, Ruhepuls und HRV über Health Connect', c.hcOk && c.hcOn !== false ? st(true, 'verbunden') : st('w', 'aus'))] : [])) +
      grp('Planung', [
        row('pg:claude', 'Claude und Kosten', c.aKey ? (MODELS[c.model || 'claude-sonnet-5-5'] || {}).n + ', diesen Monat ' + usd(sum) + (lim > 0 ? ' von ' + usd(lim) : '') : 'Noch kein Schlüssel', c.aKey ? (lim > 0 && sum >= lim ? st(false, 'Grenze') : lim > 0 && sum >= lim * .8 ? st('w', '80 %') : st(true, 'bereit')) : st(false, 'aus'))
      ]) +
      grp('Zusatzfunktionen', [row('pg:ski', 'Skitouren', 'Vorschläge fürs Wochenende mit Lawinenlage', c.skiOn !== false ? st(true, 'an') : st('w', 'aus'))]) +
      grp('App', (CAPN ? [
        row('pg:notif', 'Benachrichtigungen', nOnN + ' von 4 aktiv' + (c.pushOk ? ', Push aktiv' : ''), c.pushOk ? '' : st('w', 'Push aus')),
        row('pg:app', 'App-Version', UPD ? '1.' + UPD.cur + (UPD.newer ? ', neu: 1.' + UPD.latest : ', aktuell') : 'Version und Updates', UPD && UPD.newer ? st('w', 'Update') : '')
      ] : []).concat([
        row('pg:data', 'Daten sichern und übernehmen', 'Sicherung, Import aus der Claude-Version'),
        row('app:src', 'Datenquellen und Fehlerprotokoll', se.length ? 'Problem bei ' + se.join(', ') : 'Status aller Dienste', se.length ? st(false, 'Fehler') : '')
      ])) +
      '<p class="wu-mu" style="margin-top:16px">Alle Schlüssel bleiben nur auf diesem Gerät. <a href="https://github.com/christophschmid-design/wattsup/blob/main/docs/EINRICHTUNG.md" target="_blank" rel="noopener">Anleitung zur Einrichtung</a><br>WattsUp ' + VER + (CAPN ? ', Android' : ', Browser') + '</p>';
  }
  function pageStrava() {
    var c = cfg();
    return hdr('Strava', 'Liefert Aktivitäten, Leistung und Puls.') + '<div class="wu-c">' + '<p style="margin:0 0 4px">' + (stOk() ? st(true, 'verbunden') + ((stTok() || {}).who ? ' als ' + E(stTok().who) : '') : st(false, 'nicht verbunden')) + '</p>' + (stOk() ? '<p style="margin:0 0 8px">' + stWr() + '</p>' : '') +
      fld('wu-stId', 'Client-ID', c.stId) + fld('wu-stSec', 'Client-Secret', c.stSec, 'password') +
      '<button class="wu-b" data-wu="st">' + (stOk() ? 'Neu verbinden' : 'Mit Strava verbinden') + '</button>' + (stOk() ? '<button class="wu-b alt" data-wu="stx">Trennen</button>' : '') + '</div>' +
      '<details class="wu-c"><summary>Einstellungen bei Strava</summary><p class="wu-mu">Als „Authorization Callback Domain“ eintragen:<code class="wu-cp">' + E(location.host) + '</code></p></details>' + saveBtn();
  }
  function pageGoogle() {
    var c = cfg();
    return hdr('Google Kalender und Abgleich', 'Trägt Einheiten in den Kalender ein und gleicht Einträge zwischen deinen Geräten über einen versteckten Ordner in Google Drive ab.') +
      '<div class="wu-c"><p style="margin:0 0 4px">' + (gOk() ? st(true, 'verbunden') : st(false, 'nicht verbunden')) + (gOk() ? ' Abgleich: ' + syncChip() + (SYNC.st === 'ok' ? ' ' + new Date(SYNC.ts).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) : '') : '') + '</p>' + (SYNC.st === 'err' ? '<p class="wu-mu">' + E(SYNC.msg) + '</p>' : '') +
      fld('wu-cal', 'Kalender-ID', c.cal || CAL0) +
      '<button class="wu-b" data-wu="g">' + (gOk() ? 'Neu verbinden' : 'Mit Google verbinden') + '</button>' + (gOk() ? '<button class="wu-b alt" data-wu="sync">Jetzt abgleichen</button><button class="wu-b alt" data-wu="gx">Trennen</button>' : '') + '</div>' +
      '<details class="wu-c"' + (c.gId ? '' : ' open') + '><summary>Zugangsdaten</summary>' + fld('wu-gId', 'Client-ID', c.gId) + fld('wu-gSec', 'Client-Secret', c.gSec, 'password') +
      '<p class="wu-mu">Bei Google als „Autorisierte Weiterleitungs-URI“ eintragen:<code class="wu-cp">' + E(HOME) + '</code></p></details>' + saveBtn();
  }
  function pageHealth() {
    var c = cfg();
    return hdr('Gesundheitsdaten', 'Übernimmt Gewicht und Körperfett der Renpho-Waage sowie Schlaf, Ruhepuls und HRV der Uhr automatisch über Health Connect.') +
      '<div class="wu-c"><p style="margin:0 0 4px">' + (c.hcOk && c.hcOn !== false ? st(true, 'verbunden') : st('w', 'aus')) + (c.hcLast ? ' zuletzt abgeglichen ' + new Date(c.hcLast).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '') + '</p>' +
      (c.hcVal ? '<p class="wu-mu">Letztes Gewicht: ' + String(c.hcVal.kg).replace('.', ',') + ' kg am ' + c.hcVal.d.slice(8, 10) + '.' + c.hcVal.d.slice(5, 7) + '.</p>' : '') +
      (c.hcOk && c.hcScope !== 2 ? '<p class="wu-c wu-note">Neu: Schlaf, Ruhepuls und HRV. Bitte einmal „Verbinden“ tippen und alles erlauben.</p>' : '') +
      '<button class="wu-b" data-wu="hc">' + (c.hcOk && c.hcScope === 2 ? 'Jetzt abgleichen' : 'Verbinden') + '</button>' + (c.hcOk ? '<button class="wu-b alt" data-wu="hcx">' + (c.hcOn === false ? 'Einschalten' : 'Ausschalten') + '</button>' : '') + '</div>' +
      '<details class="wu-c"><summary>Fehlersuche</summary><p class="wu-mu">Zeigt, welche Werte Health Connect gerade liefert.</p><button class="wu-b alt" data-wu="hcd">Prüfen</button><div id="wu-hcd"></div></details>';
  }
  function pageClaude() {
    var c = cfg(), m = monthKey(now()), lst = costs().filter(function (x) { return monthKey(x.ts) === m; }), sum = monthSum(), lim = Number(c.limit || 0);
    return hdr('Claude und Kosten', 'Claude erstellt die Wochenplanung. Abgerechnet wird pro Planung über dein Anthropic-Konto.') +
      '<div class="wu-c"><h3 style="margin-top:0">Diesen Monat</h3><p style="margin:0"><b style="font-size:1.4rem">' + usd(sum) + '</b> für ' + lst.length + (lst.length === 1 ? ' Planung' : ' Planungen') + (lim > 0 ? ', Grenze ' + usd(lim) + (sum >= lim ? ' ' + st(false, 'erreicht') : sum >= lim * .8 ? ' ' + st('w', 'über 80 %') : '') : '') + '</p>' +
      (lst.length ? '<table class="wu-tb">' + lst.slice(-6).reverse().map(function (x) { return '<tr><td>' + new Date(x.ts).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ', ' + (MODELS[x.model] ? MODELS[x.model].n : x.model) + '<br><small class="wu-mu">Anfrage ' + (x.i || 0).toLocaleString('de-AT') + ', Antwort ' + (x.o || 0).toLocaleString('de-AT') + ' Tokens</small></td><td>' + usd(x.usd) + '<br><small class="wu-mu">' + usd(((x.i || 0) * (MODELS[x.model] || MODELS['claude-sonnet-5-5']).i) / 1e6) + ' + ' + usd(((x.o || 0) * (MODELS[x.model] || MODELS['claude-sonnet-5-5']).o) / 1e6) + '</small></td></tr>'; }).join('') + '</table>' : '') +
      fld('wu-limit', 'Monatsgrenze in $ (0 = keine)', c.limit != null ? c.limit : 3, 'text', '3') +
      '<p class="wu-mu">Berechnet aus dem gemeldeten Verbrauch und der Preisliste. Maßgeblich ist die Abrechnung in der Anthropic Console.</p></div>' +
      '<div class="wu-c"><h3 style="margin-top:0">Modell</h3><label for="wu-model">Für jede Planung</label><select id="wu-model">' + Object.keys(MODELS).map(function (k) { var M = MODELS[k]; return '<option value="' + k + '"' + ((c.model || 'claude-sonnet-5-5') === k ? ' selected' : '') + '>' + M.n + ' (' + String(M.i).replace('.', ',') + ' $ / ' + String(M.o).replace('.', ',') + ' $ pro Mio. Tokens)</option>'; }).join('') + '</select>' +
      '<label for="wu-once">Nur die nächste Planung gründlicher</label><select id="wu-once"><option value="">Nein, Standardmodell</option><option value="claude-opus-5-5"' + (c.once === 'claude-opus-5-5' ? ' selected' : '') + '>Ja, mit Opus 5.5</option><option value="claude-fable-5-2"' + (c.once === 'claude-fable-5-2' ? ' selected' : '') + '>Ja, mit Fable 5.2</option></select></div>' +
      '<details class="wu-c"' + (c.aKey ? '' : ' open') + '><summary>API-Schlüssel ' + (c.aKey ? st(true, 'hinterlegt') : st(false, 'fehlt')) + '</summary>' + fld('wu-aKey', 'Beginnt mit sk-ant-', c.aKey, 'password') + '</details>' + saveBtn();
  }
  function pageNotif() {
    var c = cfg(), mf = (window.WU_STATE && WU_STATE.mFrom) || 5;
    return hdr('Benachrichtigungen') + '<div class="wu-c"><h3 style="margin-top:0">Erinnerungen</h3>' + chk('wu-nMood', 'Morgengefühl ab ' + mf + ' Uhr', c.nMood !== false) + chk('wu-nWeigh', 'Freitag 7 Uhr: Waage', c.nWeigh !== false) + chk('wu-nPlan', 'Sonntag 19 Uhr: Wochenplanung', c.nPlan !== false) + chk('wu-nAct', 'Neue Strava-Aktivität bewerten', c.nAct !== false) + '</div>' +
      '<div class="wu-c"><h3 style="margin-top:0">Push für neue Aktivitäten ' + (c.pushOk ? st(true, 'aktiv') : st('w', 'aus')) + '</h3><p class="wu-mu">Sofortige Meldung, sobald eine Aktivität auf Strava landet.</p>' + (c.pushOk ? '<button class="wu-b alt" data-wu="pusht">Test senden</button>' : '') +
      '<details' + (c.pushOk ? '' : ' open') + '><summary>Einrichtung</summary>' + fld('wu-pushUrl', 'Adresse des Push-Dienstes', c.pushUrl, 'text', 'https://wattsup-push.….workers.dev') + '<button class="wu-b" data-wu="push">' + (c.pushOk ? 'Neu einrichten' : 'Push aktivieren') + '</button></details></div>' +
      '<p class="wu-mu">Widget: Startbildschirm lange drücken → Widgets → WattsUp.</p>';
  }
  function pageApp() {
    return hdr('App-Version') + '<div class="wu-c"><p style="margin:0" id="wu-ver">' + (UPD ? 'Installiert: 1.' + UPD.cur + (UPD.newer ? '<br>Neu verfügbar: 1.' + UPD.latest : ', aktuell') : 'wird geprüft …') + '</p>' + (UPD && UPD.newer ? '<button class="wu-b" data-wu="upd">Jetzt aktualisieren</button>' : '') + '<button class="wu-b alt" data-wu="updchk">Nach Update suchen</button></div>' +
      '<p class="wu-mu">Inhalt und Funktionen kommen automatisch beim nächsten Start. Ein Update ist nur für Widget, Benachrichtigungen und Berechtigungen nötig.</p>';
  }
  function pageData() {
    return hdr('Daten sichern und übernehmen') + '<div class="wu-c"><h3 style="margin-top:0">Sicherung</h3><p class="wu-mu">Bewertungen, Pläne, Morgengefühl, Gewicht und Einstellungen als Datei. Schlüssel sind nicht enthalten.</p><button class="wu-b alt" data-wu="exp">Sicherung exportieren</button></div>' +
      '<div class="wu-c"><h3 style="margin-top:0">Übernehmen</h3><p class="wu-mu">Eine Sicherung oder den Export aus der Claude-Version („Daten für WattsUp exportieren“) wählen.</p><input type="file" id="wu-imp" accept=".json,.txt,application/json,text/plain"></div>';
  }
  function pageSki() {
    var c = cfg();
    return hdr('Skitouren', 'Eine Zusatzfunktion abseits der Trainingsplanung.') + '<div class="wu-c">' + chk('wu-skiOn', 'Skitouren-Vorschläge verwenden', c.skiOn !== false) +
      '<p class="wu-mu">Schaltet die Vorschläge im Menü, den Hinweis am Freitag um 18 Uhr und die Berücksichtigung in der Wochenplanung gemeinsam ein oder aus. Geprüft werden 37 Touren in Salzburg, Bayern, Tirol und der Steiermark nach Lawinenlage, Schnee und Wetter, mit Link zu Skitourenguru.</p></div>' +
      '<button class="wu-b alt" data-wu="app:ski">Vorschläge ansehen</button>';
  }
  function pageIntervals() {
    var c = cfg(), ftp = window.WU_IV ? (window.WU_IV(false) || {}).ftp : null;
    return hdr('Zwift über intervals.icu', 'Überträgt die geplanten Zwift-Einheiten der nächsten 7 Tage an intervals.icu. Von dort erscheinen sie in Zwift unter Workouts → Eigene → Intervals.icu, die Einheit von heute direkt auf dem Startbildschirm.') +
      '<div class="wu-c"><p style="margin:0 0 4px">' + (c.ivKey && c.ivOn !== false ? (c.ivErr ? st(false, 'Fehler') : st(true, 'aktiv')) : st('w', 'aus')) + (c.ivLast ? ' zuletzt übertragen ' + new Date(c.ivLast).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ', ' + (c.ivN || 0) + (c.ivN === 1 ? ' Einheit' : ' Einheiten') : '') + '</p>' +
      (c.ivErr ? '<p class="wu-mu">' + E(c.ivErr) + '</p>' : '') + (c.ivAdjNow ? '<p class="wu-mu">Heute angepasst: ' + E(c.ivAdjNow) + '</p>' : '') + (c.zwFtp ? '<p class="wu-c wu-note">Offen: FTP ' + c.zwFtp + ' W in Zwift eintragen und unten am Bildschirm bestätigen.</p>' : '') +
      chk('wu-ivOn', 'Automatisch übertragen', c.ivOn !== false) +
      chk('wu-ivSetOn', 'FTP, Schwellenpuls und Maximalpuls aus WattsUp in intervals.icu übernehmen', c.ivSetOn !== false) + (c.ivSetMsg ? '<p class="wu-mu" style="margin:-4px 0 8px 34px">Zuletzt: ' + E(c.ivSetMsg === 'unverändert' ? 'Werte stimmen schon überein' : c.ivSetMsg) + '</p>' : '') +
      chk('wu-ivAdj', 'Einheit von heute nach dem Morgengefühl an die Tagesform anpassen (gelb −5 %, rot −10 %)', c.ivAdj !== false) +
      (c.ivKey ? '<button class="wu-b alt" data-wu="ivs">Jetzt übertragen</button>' : '') + '</div>' +
      '<div class="wu-c"><p class="wu-mu" style="margin-top:0">Wichtig: Die FTP in Zwift muss mit WattsUp übereinstimmen' + (ftp ? ', aktuell ' + ftp + ' W' : '') + '. Zwift lässt sich von außen nicht ändern, das bitte nach jeder FTP-Änderung in Zwift selbst nachziehen. intervals.icu übernimmt WattsUp automatisch.</p>' +
      '<p class="wu-mu">Nur Workouts gehen hin, nichts kommt zurück. Damit dort keine Fahrten landen: Strava bei intervals.icu nicht verbinden und bei Zwift den Download von Aktivitäten abschalten.</p></div>' +
      '<details class="wu-c"' + (c.ivKey ? '' : ' open') + '><summary>API-Schlüssel ' + (c.ivKey ? st(true, 'hinterlegt') : st(false, 'fehlt')) + '</summary>' + fld('wu-ivKey', 'intervals.icu → Settings → ganz unten „Developer Settings“ → API Key', c.ivKey, 'password') + '</details>' + saveBtn();
  }
  function saveBtn() { return '<button class="wu-b" data-wu="save">Speichern</button>'; }
  function render(note) {
    var f = { intervals: pageIntervals, ski: pageSki, home: pageHome, strava: pageStrava, google: pageGoogle, health: pageHealth, claude: pageClaude, notif: pageNotif, app: pageApp, data: pageData }[PG] || pageHome;
    return f(note);
  }
  function saveForm() {
    function v(id) { var e = document.getElementById(id); return e ? e.value.trim() : undefined; }
    function cb(id) { var e = document.getElementById(id); return e ? e.checked : undefined; }
    var p = {};
    [['wu-stId', 'stId'], ['wu-stSec', 'stSec'], ['wu-gId', 'gId'], ['wu-gSec', 'gSec'], ['wu-aKey', 'aKey'], ['wu-model', 'model'], ['wu-pushUrl', 'pushUrl'], ['wu-ivKey', 'ivKey']].forEach(function (x) { var val = v(x[0]); if (val !== undefined) p[x[1]] = val; });
    if (v('wu-cal') !== undefined) p.cal = v('wu-cal') || CAL0;
    if (v('wu-once') !== undefined) p.once = v('wu-once') || null;
    if (document.getElementById('wu-skiOn')) { var was = cfg().skiOn !== false, now2 = cb('wu-skiOn'); p.skiOn = now2; if (was !== now2 && FM && cfg().pushTopic) { try { if (now2) FM.subscribeToTopic({ topic: cfg().pushTopic + '_ski' }); else FM.unsubscribeFromTopic({ topic: cfg().pushTopic + '_ski' }); } catch (e) { } } }
    if (document.getElementById('wu-ivOn')) { p.ivOn = cb('wu-ivOn'); p.ivAdj = cb('wu-ivAdj'); p.ivSetOn = cb('wu-ivSetOn'); if (p.ivSetOn !== (cfg().ivSetOn !== false)) p.ivSetSig = ''; if (p.ivAdj !== (cfg().ivAdj !== false) || p.ivOn !== (cfg().ivOn !== false)) p.ivSig = ''; }
    if (v('wu-ivKey') !== undefined && v('wu-ivKey') !== (cfg().ivKey || '')) p.ivSig = '';
    if (v('wu-limit') !== undefined) { var lim = parseFloat(String(v('wu-limit') || '0').replace(',', '.')); p.limit = isNaN(lim) ? 0 : lim; }
    if (document.getElementById('wu-nMood')) { var wasAct = cfg().nAct !== false; p.nMood = cb('wu-nMood'); p.nAct = cb('wu-nAct'); p.nPlan = cb('wu-nPlan'); p.nWeigh = cb('wu-nWeigh'); setCfg(p); if (wasAct !== (cfg().nAct !== false)) pushTopic(cfg().nAct !== false); }
    else setCfg(p);
    lastSig = ''; if (window.WU_STATE && window.WU_SYNC) window.WU_SYNC(window.WU_STATE);
  }
  var WU = {
    open: function (note, page) { if (page) PG = page; else if (note || !document.getElementById('wu-ov') || document.getElementById('wu-ov').hidden) PG = PG && document.getElementById('wu-ov') && !document.getElementById('wu-ov').hidden ? PG : 'home'; var sh = document.getElementById('sh'), sx = document.getElementById('shx'); if (sh && !sh.hidden && sx) sx.click(); addCss(); var o = document.getElementById('wu-ov'); if (!o) { o = document.createElement('div'); o.id = 'wu-ov'; o.className = 'wu-ov'; document.body.appendChild(o); o.addEventListener('click', onClick); o.addEventListener('change', onChange); } o.innerHTML = '<div class="wu-sh" role="dialog" aria-modal="true">' + render(note) + '</div>'; o.hidden = false; },
    close: function () { var o = document.getElementById('wu-ov'); if (o) o.hidden = true; },
    toast: toast, exportData: exportData
  };
  window.WU = WU;
  /* Aus Einstellungen geöffnete App-Dialoge kehren beim Schließen in die Einstellungen zurück */
  var RET_HUB = false;
  function watchSheet() {
    var sh = document.getElementById('sh'); if (!sh || sh.__wuw) return; sh.__wuw = true;
    new MutationObserver(function () { if (RET_HUB && sh.hidden) { RET_HUB = false; setTimeout(function () { WU.open(null, 'home'); }, 60); } }).observe(sh, { attributes: true, attributeFilter: ['hidden'] });
  }
  document.addEventListener('DOMContentLoaded', watchSheet); setTimeout(watchSheet, 1500);
  /* Android: Zurück-Taste bzw. -Geste */
  if (CAPN && PL.App) {
    PL.App.addListener('backButton', function (ev) {
      var o = document.getElementById('wu-ov'), sh = document.getElementById('sh'), sx = document.getElementById('shx');
      if (o && !o.hidden) { saveForm(); if (PG !== 'home') WU.open(null, 'home'); else WU.close(); return; }
      if (sh && !sh.hidden && sx) { sx.click(); return; }
      if (ev && ev.canGoBack) history.back(); else if (PL.App.minimizeApp) PL.App.minimizeApp(); else PL.App.exitApp();
    });
  }
  async function onClick(e) {
    if (e.target.id === 'wu-ov') { if (PG !== 'home') { saveForm(); WU.open(null, 'home'); } else { saveForm(); WU.close(); } return; }
    var b = e.target.closest('[data-wu]'); if (!b) return; var k = b.getAttribute('data-wu');
    if (k === 'close') { saveForm(); WU.close(); return; }
    if (k.indexOf('pg:') === 0) { saveForm(); PG = k.slice(3); WU.open(null, PG); var sh0 = document.querySelector('.wu-sh'); if (sh0) sh0.scrollTop = 0; return; }
    if (k.indexOf('app:') === 0) { saveForm(); WU.close(); PG = 'home'; RET_HUB = true; if (window.WU_OPEN) window.WU_OPEN(k.slice(4)); return; }
    saveForm();
    if (k === 'save') { toast('Gespeichert. WattsUp lädt neu …'); setTimeout(function () { location.reload(); }, 900); return; }
    if (k === 'st') stConnect();
    if (k === 'stx') { ls('wu_strava', null); WU.open(); }
    if (k === 'g') gConnect();
    if (k === 'gx') { ls('wu_google', null); syncSt('aus'); WU.open(); }
    if (k === 'sync') { await pull(); await push(); WU.open(); toast(SYNC.st === 'ok' ? 'Abgeglichen.' : 'Abgleich fehlgeschlagen.'); }
    if (k === 'exp') exportData();
    if (k === 'hc') { await hcSync(true); WU.open(); }
    if (k === 'hcd') { hcDiag(); return; }
    if (k === 'ivs') { await ivSync(true); WU.open(); }
    if (k === 'hcx') { setCfg({ hcOn: cfg().hcOn === false }); WU.open(); }
    if (k === 'push') { try { await pushActivate(); } catch (x) { toast('Push einrichten fehlgeschlagen: ' + (x.message || x)); } WU.open(); }
    if (k === 'pusht') { try { await pushTest(); } catch (x) { toast('Test fehlgeschlagen: ' + (x.message || x)); } }
    if (k === 'updchk') { await checkUpdate(true); WU.open(); if (UPD && !UPD.newer) toast('WattsUp ist aktuell.'); }
    if (k === 'upd') { WU.close(); doUpdate(document.getElementById('wu-upd')); }
  }
  async function onChange(e) {
    if (e.target.id !== 'wu-imp' || !e.target.files || !e.target.files[0]) return;
    try { var j = JSON.parse(await e.target.files[0].text()); importData(j); } catch (x) { toast('Die Datei konnte nicht gelesen werden.'); }
  }
  function importData(j) {
    if (!j || j.app !== 'wattsup') { toast('Das ist keine WattsUp-Datei.'); return; }
    Object.keys(j.ls || {}).forEach(function (k) { try { localStorage.setItem(k, j.ls[k]); } catch (e) { } });
    var a = dbAll(), t = now();
    Object.keys(j.db || {}).forEach(function (k) { var path = 'data/users/me/' + k; if (!a[path] || (a[path].ts || 0) < t) a[path] = { d: j.db[k], ts: t }; });
    ls(DBK, a); push();
    toast('Daten übernommen: ' + Object.keys(j.db || {}).length + ' Einträge. WattsUp lädt neu …');
    setTimeout(function () { location.reload(); }, 1500);
  }
  async function exportData() {
    var o = { app: 'wattsup', v: 1, ts: now(), ls: {}, db: {} }, a = dbAll();
    ['tss2', 'log1', 'plans1', 'cz1', 'cfg1', 'mood1', 'wt1', 'fu1', 'zdis', 'act2', 'ichint', 'st_cal'].forEach(function (k) { var v = localStorage.getItem(k); if (v != null) o.ls[k] = v; });
    Object.keys(a).forEach(function (k) { if (!a[k].del && a[k].d != null) o.db[k.split('/').pop()] = a[k].d; });
    await DL.save({ filename: 'wattsup-sicherung-' + new Date().toISOString().slice(0, 10) + '.json', data: JSON.stringify(o) });
  }
  /* Links nach außen (Strava-Aktivitäten, Google-Kalender, Hilfe) an Android übergeben */
  if (CAPN) {
    window.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
      var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
      if (u.origin === location.origin || u.protocol === 'wattsup:') return;
      if (/strava\.com$/.test(u.hostname) && /^\/oauth/.test(u.pathname)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var N = PL.WattsUpNative;
      if (N && N.openUrl) N.openUrl({ url: u.href }).catch(function () { if (PL.Browser) PL.Browser.open({ url: u.href }); });
      else if (PL.Browser) PL.Browser.open({ url: u.href });
    }, true);
  }
  /* Menüeintrag in der App abfangen */
  window.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-k="wu"]');
    if (!t) return; e.preventDefault(); e.stopImmediatePropagation(); WU.open();
  }, true);

  /* ---------- Android: Widget, Benachrichtigungen, Updates ---------- */
  var NAT = PL.WattsUpNative, LN = PL.LocalNotifications, PREF = PL.Preferences, BR = PL.BackgroundRunner;
  var RUN = 'at.christophschmid.wattsup.check', APK = 'https://github.com/christophschmid-design/wattsup/releases/download/apk/wattsup.apk';
  function nOn(k) { return cfg()[k] !== false; }
  var lastSig = '', lastSync = 0, permAsked = false;
  async function notifPerm() {
    if (!LN) return false;
    try { var p = await LN.checkPermissions(); if (p.display === 'granted') return true; if (permAsked) return false; permAsked = true; p = await LN.requestPermissions(); return p.display === 'granted'; } catch (e) { return false; }
  }
  function at(day, h, m) { var d = new Date(day + 'T00:00:00'); d.setHours(h, m || 0, 0, 0); return d; }
  async function schedule(st) {
    if (!LN || !(await notifPerm())) return;
    var ids = [], i; for (i = 0; i < 8; i++) ids.push({ id: 100 + i }); ids.push({ id: 200 }); ids.push({ id: 201 });
    try { await LN.cancel({ notifications: ids }); } catch (e) { }
    var list = [], nowT = now();
    if (nOn('nMood') && st.moodOn) {
      for (i = 0; i < 8; i++) {
        var d = new Date(); d.setDate(d.getDate() + i);
        var day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        var t = at(day, st.mFrom || 5, 0);
        if (t.getTime() <= nowT || (st.md || []).indexOf(day) >= 0) continue;
        list.push({ id: 100 + i, title: 'Guten Morgen! Wie fühlst du dich?', body: 'Kurz das Morgengefühl eintragen, dann passt die Tagesampel.', schedule: { at: t, allowWhileIdle: true }, extra: { k: 'mood' }, smallIcon: 'ic_stat_wattsup' });
      }
    }
    if (nOn('nPlan')) {
      var s = new Date(); s.setDate(s.getDate() + ((7 - s.getDay()) % 7)); s.setHours(19, 0, 0, 0); if (s.getTime() <= nowT) s.setDate(s.getDate() + 7);
      list.push({ id: 200, title: 'Wochenplanung', body: 'Tippen, um die nächste Woche mit Claude zu planen.', schedule: { at: s, allowWhileIdle: true }, extra: { k: 'plan' }, smallIcon: 'ic_stat_wattsup' });
    }
    if (nOn('nWeigh')) {
      var f = new Date(); f.setDate(f.getDate() + ((5 - f.getDay() + 7) % 7)); f.setHours(7, 0, 0, 0);
      var fd = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
      if (f.getTime() <= nowT || (st.wd || []).indexOf(fd(f)) >= 0) f.setDate(f.getDate() + 7);
      list.push({ id: 201, title: 'Ab auf die Waage', body: 'Morgens nüchtern wiegen, WattsUp übernimmt den Wert automatisch.', schedule: { at: f, allowWhileIdle: true }, extra: { k: 'wt' }, smallIcon: 'ic_stat_wattsup' });
    }
    if (list.length) try { await LN.schedule({ notifications: list }); } catch (e) { }
  }
  async function runnerCfg() {
    if (!BR || !stOk()) return;
    var c = cfg(), t = stTok(), lastAct = (window.ACT || []).reduce(function (m, a) { var s = a.start || a.start_local || ''; return s > m ? s : m; }, '');
    try {
      var r = await BR.dispatchEvent({ label: RUN, event: 'config', details: { stId: c.stId, stSec: c.stSec, tok: t, on: nOn('nAct') && !cfg().pushOk, last: '' } });
      if (r && r.tok && t && r.tok.x > t.x) ls('wu_strava', r.tok);
    } catch (e) { }
  }
  window.WU_SYNC = function (st) {
    if (!CAPN) return;
    var sig = JSON.stringify([st.day, st.lv, st.today, st.done, st.tomorrow, st.form, st.fit, st.md, st.wd, st.moodOn, st.mFrom, cfg().nMood, cfg().nPlan, cfg().nWeigh]);
    if (sig === lastSig && now() - lastSync < 600000) return;
    lastSig = sig; lastSync = now();
    if (PREF) PREF.set({ key: 'wu_widget', value: JSON.stringify(st) }).then(function () { if (NAT) NAT.updateWidget(); }).catch(function () { });
    schedule(st);
    runnerCfg();
  };
  if (CAPN && LN) {
    LN.addListener('localNotificationActionPerformed', function (e) { var x = (e && e.notification && e.notification.extra) || {}; goFrom({ k: x.k }); });
  }
  if (CAPN && PL.App) {
    var shown = now();
    PL.App.addListener('appStateChange', function (s) { if (s.isActive && now() - shown > 15 * 60000) location.reload(); if (!s.isActive) shown = now(); });
  }
  /* Gewicht aus Health Connect (Google Health, Renpho) */
  var HC = PL.Health, hcBusy = false;
  function dayOf(iso) { var d = new Date(iso); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  async function hcSync(force) {
    if (!CAPN || hcBusy) return;
    var c = cfg();
    if (!HC) { if (force) toast('Diese App-Version kann Health Connect noch nicht lesen. Bitte zuerst aktualisieren.'); return; }
    var d4 = new Date(); d4.setHours(4, 0, 0, 0); if (d4.getTime() > now()) d4.setDate(d4.getDate() - 1);
    if (!force && (!c.hcOk || c.hcOn === false || (now() - (c.hcLast || 0) < 30 * 60000 && (c.hcLast || 0) > d4.getTime()))) return;
    hcBusy = true;
    try {
      var av = await HC.isAvailable();
      if (!av || !av.available) { if (force) toast('Health Connect ist auf diesem Handy nicht verfügbar' + (av && av.reason ? ': ' + av.reason : '.')); return; }
      if (force) {
        var st = null; try { st = await HC.requestAuthorization({ read: ['weight', 'bodyFat', 'sleep', 'restingHeartRate', 'heartRateVariability'], write: [] }); } catch (e) { }
        if (!st || (st.readAuthorized || []).indexOf('weight') < 0) {
          /* Manche Versionen melden den Status ungenau: Lesen trotzdem versuchen */
          try { await HC.readSamples({ dataType: 'weight', startDate: new Date(now() - 864e5).toISOString(), endDate: new Date().toISOString(), limit: 1 }); }
          catch (e) { toast('Kein Zugriff auf das Gewicht. Bitte in Health Connect bei WattsUp „Gewicht“ erlauben.'); try { if (HC.openHealthConnectSettings) await HC.openHealthConnectSettings(); } catch (x) { } return; }
        }
        setCfg({ hcOk: now(), hcOn: true, hcScope: 2 });
      }
      var r = await HC.readSamples({ dataType: 'weight', startDate: new Date(now() - 30 * 864e5).toISOString(), endDate: new Date().toISOString(), limit: 300, ascending: true });
      var by = {}, bf = {};
      (r && r.samples || []).forEach(function (x) { var d = dayOf(x.startDate), kg = x.unit === 'pound' ? x.value * 0.45359 : x.value; if (!by[d]) by[d] = kg; });
      try {
        var r2 = await HC.readSamples({ dataType: 'bodyFat', startDate: new Date(now() - 30 * 864e5).toISOString(), endDate: new Date().toISOString(), limit: 300, ascending: true });
        (r2 && r2.samples || []).forEach(function (x) { var d = dayOf(x.startDate), v = x.value <= 1 ? x.value * 100 : x.value; if (bf[d] == null) bf[d] = v; });
      } catch (e) { }
      var list = Object.keys(by).concat(Object.keys(bf)).filter(function (d, i, a) { return a.indexOf(d) === i; }).sort().map(function (d) { return [d, by[d] != null ? by[d] : null, bf[d] != null ? bf[d] : null]; });
      for (var i = 0; i < 50 && !window.WU_WT; i++) await new Promise(function (ok) { setTimeout(ok, 300); });
      var n = window.WU_WT ? await window.WU_WT(list) : 0;
      try { await recSync(); } catch (e) { }
      var wl = list.filter(function (x) { return x[1] != null; }), last = wl.length ? wl[wl.length - 1] : null;
      setCfg({ hcLast: now(), hcVal: last ? { d: last[0], kg: Math.round(last[1] * 10) / 10 } : null });
      if (n) toast(n === 1 ? 'Neues Gewicht übernommen: ' + String(Math.round(last[1] * 10) / 10).replace('.', ',') + ' kg' : n + ' Gewichtswerte übernommen.');
      else if (force) toast(list.length ? 'Gewicht ist aktuell.' : 'In den letzten 30 Tagen keine Gewichtswerte gefunden.');
    } catch (e) { if (force) toast('Health Connect: ' + (e.message || e)); }
    finally { hcBusy = false; }
  }
  WU.hcSync = hcSync;
  /* Prüfung: Was liefert Health Connect wirklich? */
  async function hcDiag() {
    var box = document.getElementById('wu-hcd'); if (!box) return;
    var L = [], c = cfg();
    function row(a, b, ok) { L.push('<tr><td>' + E(a) + '</td><td>' + (ok === true ? st(true, 'ok') : ok === false ? st(false, 'fehlt') : '') + ' ' + E(b) + '</td></tr>'); }
    function show() { box.innerHTML = '<table class="wu-tb" style="margin-top:10px">' + L.join('') + '</table><p class="wu-mu">Bitte einen Screenshot davon an Claude schicken.</p>'; }
    box.innerHTML = '<p class="wu-mu">Prüfe …</p>';
    row('App', CAPN ? 'Android-App' : 'Browser (Health Connect gibt es nur in der Android-App)', CAPN);
    if (!CAPN) { show(); return; }
    try { var info = await PL.App.getInfo(); row('App-Version', '1.' + info.build); } catch (e) { }
    row('Baustein Health', HC ? 'vorhanden' : 'fehlt in dieser App-Version', !!HC);
    if (!HC) { show(); return; }
    try { var av = await HC.isAvailable(); row('Health Connect', (av.available ? 'verfügbar' : 'nicht verfügbar') + (av.reason ? ' (' + av.reason + ')' : ''), !!av.available); } catch (e) { row('Health Connect', 'Fehler: ' + (e.message || e), false); }
    row('In WattsUp verbunden', c.hcOk ? 'ja, seit ' + new Date(c.hcOk).toLocaleString('de-AT') + (c.hcScope === 2 ? '' : ' (nur Gewicht, bitte neu verbinden)') : 'nein', !!c.hcOk);
    var types = [['weight', 'Gewicht', 'kg'], ['bodyFat', 'Körperfett', '%'], ['sleep', 'Schlaf', ''], ['restingHeartRate', 'Ruhepuls', 'bpm'], ['heartRateVariability', 'HRV', 'ms']];
    if (HC.checkAuthorization) {
      try { var au = await HC.checkAuthorization({ read: types.map(function (t) { return t[0]; }), write: [] }); var ok = au.readAuthorized || []; row('Freigaben', types.map(function (t) { return t[1] + (ok.indexOf(t[0]) >= 0 ? ' ✓' : ' ✗'); }).join(', ')); } catch (e) { row('Freigaben', 'nicht abfragbar: ' + (e.message || e)); }
    }
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      try {
        var r = await HC.readSamples({ dataType: t[0], startDate: new Date(now() - 30 * 864e5).toISOString(), endDate: new Date().toISOString(), limit: 1000, ascending: false });
        var sm = (r && r.samples) || [], f = sm[0];
        var src = sm.map(function (x) { return x.sourceName || x.sourceId || '?'; }).filter(function (v, j, a) { return a.indexOf(v) === j; }).join(', ');
        row(t[1], sm.length ? sm.length + ' Werte in 30 Tagen, neuester ' + new Date(f.startDate).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + (t[0] !== 'sleep' && f.value != null ? ': ' + (Math.round(f.value * 10) / 10) + ' ' + (f.unit || t[2]) : '') + (src ? ', von ' + src : '') : 'keine Werte in 30 Tagen', sm.length > 0);
      } catch (e) { row(t[1], 'Fehler beim Lesen: ' + (e.message || e), false); }
    }
    row('Letzter Abgleich', c.hcLast ? new Date(c.hcLast).toLocaleString('de-AT') : 'noch nie');
    show();
  }
  /* Schlaf, Ruhepuls, HRV */
  async function hcRead(type, days) {
    try { var r = await HC.readSamples({ dataType: type, startDate: new Date(now() - days * 864e5).toISOString(), endDate: new Date().toISOString(), limit: 1000, ascending: true }); return (r && r.samples) || []; } catch (e) { return []; }
  }
  function stg(x) { return String(x.stage || x.sleepState || x.type || x.state || '').toLowerCase(); }
  function mins(a, b) { return Math.max(0, (new Date(b) - new Date(a)) / 60000); }
  async function recSync() {
    var out = {};
    function O(d) { return out[d] = out[d] || { d: d }; }
    var sl = await hcRead('sleep', 35);
    sl.forEach(function (x) {
      var end = x.endDate || x.startDate; if (!end) return;
      var o = O(dayOf(end)), segs = Array.isArray(x.stages) && x.stages.length ? x.stages : (x.sleepState ? [x] : null);
      if (segs) {
        segs.forEach(function (g) {
          var a = g.startDate || g.start || g.startTime, b = g.endDate || g.end || g.endTime, m = a && b ? mins(a, b) : 0, k = stg(g);
          if (/awake|out/.test(k)) o.awake = (o.awake || 0) + m;
          else if (/inbed|in_bed/.test(k)) { }
          else { o.sl = (o.sl || 0) + m; if (/deep/.test(k)) { o.deep = (o.deep || 0) + m; o.st = true; } else if (/rem/.test(k)) { o.rem = (o.rem || 0) + m; o.st = true; } else if (/light/.test(k)) { o.light = (o.light || 0) + m; o.st = true; } }
        });
      } else { o.sl = (o.sl || 0) + mins(x.startDate, x.endDate); }
    });
    var rh = await hcRead('restingHeartRate', 35), rb = {};
    rh.forEach(function (x) { var d = dayOf(x.startDate); if (x.value > 25 && x.value < 120) rb[d] = rb[d] == null ? x.value : Math.min(rb[d], x.value); });
    Object.keys(rb).forEach(function (d) { O(d).rhr = Math.round(rb[d]); });
    var hv = await hcRead('heartRateVariability', 35), hb = {};
    hv.forEach(function (x) { var d = dayOf(x.startDate); if (x.value > 3 && x.value < 300) (hb[d] = hb[d] || []).push(x.value); });
    Object.keys(hb).forEach(function (d) { O(d).hrv = Math.round(hb[d].reduce(function (a, b) { return a + b; }, 0) / hb[d].length); });
    var list = Object.keys(out).sort().map(function (d) { var o = out[d]; ['sl', 'deep', 'rem', 'light', 'awake'].forEach(function (k) { if (o[k] != null) o[k] = Math.round(o[k]); }); return o; });
    for (var i = 0; i < 50 && !window.WU_REC; i++) await new Promise(function (ok) { setTimeout(ok, 300); });
    if (window.WU_REC && list.length) await window.WU_REC(list);
    setCfg({ recLast: now(), recN: list.length });
  }
  if (CAPN) {
    hcSync(false);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') hcSync(false); });
  }

  /* Skitour-Vorschlag vom Push-Dienst holen (Do bis So, höchstens alle 30 Minuten) */
  async function skiSync(force) {
    var c = cfg(), base = pushBase(), wd = new Date().getDay();
    if (!base || cfg().skiOn === false || (!force && !(wd >= 4 || wd === 0))) return;
    if (!force && now() - (c.skiLast || 0) < 30 * 60000) return;
    try { var r = await http(base + '/ski'); setCfg({ skiLast: now() }); for (var i = 0; i < 50 && !window.WU_SKISET; i++) await new Promise(function (ok) { setTimeout(ok, 300); }); if (window.WU_SKISET && r && r.alle) window.WU_SKISET(r); } catch (e) { }
  }
  WU.skiSync = skiSync;

  /* Zwift über intervals.icu: geplante Zwift-Einheiten der nächsten 7 Tage übertragen.
     Nur Workouts hin, nichts zurück. Läuft nur, wenn sich etwas geändert hat. */
  var IVB = 'https://intervals.icu/api/v1/athlete/0';
  function ivHdr() { return { Authorization: 'Basic ' + btoa('API_KEY:' + cfg().ivKey), 'Content-Type': 'application/json' }; }
  var ivBusy = false;
  async function ivSync(force) {
    var c = cfg();
    if (!c.ivKey || c.ivOn === false || ivBusy || !window.WU_IV) return;
    var d = window.WU_IV(c.ivAdj !== false);
    if (!d) return;
    var ev = d.list.map(function (x) {
      return { category: 'WORKOUT', start_date_local: x.start, type: 'VirtualRide', name: x.name, description: x.desc, filename: x.date + '.zwo', file_contents: x.xml, external_id: 'wu-' + x.date };
    });
    var t0 = new Date(), today = t0.getFullYear() + '-' + ('0' + (t0.getMonth() + 1)).slice(-2) + '-' + ('0' + t0.getDate()).slice(-2);
    var sig = JSON.stringify([today, ev, d.ftp, d.lthr, d.hrmax, c.ivSetOn]);
    if (!force && sig === c.ivSig) return;
    ivBusy = true;
    try {
      if (ev.length) await http(IVB + '/events/bulk?upsert=true', { method: 'POST', headers: ivHdr(), body: JSON.stringify(ev) });
      var ids = ev.map(function (e) { return e.external_id; });
      var stale = (c.ivIds || []).filter(function (id) { return id.slice(3) >= today && ids.indexOf(id) < 0; });
      if (stale.length) await http(IVB + '/events/bulk-delete', { method: 'PUT', headers: ivHdr(), body: JSON.stringify(stale.map(function (id) { return { external_id: id }; })) });
      try { await ivSettings(d, force); } catch (e2) { setCfg({ ivSetMsg: 'Fehler: ' + ((e2 && e2.message) || e2) }); }
      setCfg({ ivSig: sig, ivIds: ids, ivLast: now(), ivN: ev.length, ivAdjNow: (d.list[0] && d.list[0].date === today && d.list[0].adj) || '', ivErr: '' });
      if (force) toast(ev.length ? ev.length + (ev.length === 1 ? ' Zwift-Einheit' : ' Zwift-Einheiten') + ' an intervals.icu übertragen.' : 'Keine Zwift-Einheiten in den nächsten 7 Tagen.' + (stale.length ? ' Alte Einträge entfernt.' : ''));
    } catch (e) {
      var m = e && e.status === 401 || e && e.status === 403 ? 'API-Schlüssel ungültig' : (!CAPN && e && e.code === 'network' ? 'Im Browser blockiert, bitte in der Android-App übertragen' : (e && e.message) || String(e));
      setCfg({ ivErr: m });
      if (force) toast('intervals.icu: ' + m);
    } finally { ivBusy = false; }
  }
  /* FTP, Schwellenpuls und Maximalpuls aus WattsUp in die Rad-Einstellungen von intervals.icu schreiben */
  async function ivSettings(d, force) {
    var c = cfg(), want = { ftp: Number(d.ftp) || 0, lthr: Number(d.lthr) || 0, max_hr: Number(d.hrmax) || 0 };
    if (c.ivSetOn === false || !want.ftp) return '';
    var sig = JSON.stringify(want);
    if (!force && sig === c.ivSetSig) return '';
    var list = await http(IVB + '/sport-settings', { headers: ivHdr() }) || [];
    var ss = list.filter(function (x) { return (x.types || []).indexOf('Ride') >= 0 || (x.types || []).indexOf('VirtualRide') >= 0; })[0];
    if (!ss) return '';
    var body = {}, ch = [];
    if (ss.ftp !== want.ftp) { body.ftp = want.ftp; ch.push('FTP ' + want.ftp + ' W'); }
    if (ss.indoor_ftp && ss.indoor_ftp !== want.ftp) { body.indoor_ftp = want.ftp; }
    if (want.lthr && ss.lthr !== want.lthr) { body.lthr = want.lthr; ch.push('Schwellenpuls ' + want.lthr); }
    if (want.max_hr && ss.max_hr !== want.max_hr) { body.max_hr = want.max_hr; ch.push('HFmax ' + want.max_hr); }
    if (Object.keys(body).length) await http(IVB + '/sport-settings/' + ss.id + '?recalcHrZones=true', { method: 'PUT', headers: ivHdr(), body: JSON.stringify(body) });
    setCfg({ ivSetSig: sig, ivSetLast: now(), ivSetMsg: ch.length ? ch.join(', ') : 'unverändert' });
    if (body.ftp) { setCfg({ zwFtp: want.ftp }); zwFtpBanner(); }
    if (ch.length) toast('intervals.icu aktualisiert: ' + ch.join(', ') + '.');
    return ch.join(', ');
  }
  /* Neue FTP: bleibt sichtbar, bis bestätigt ist, dass sie in Zwift eingetragen wurde */
  function zwFtpBanner() {
    var f = cfg().zwFtp, old = document.getElementById('wu-zftp');
    if (!f) { if (old) old.remove(); return; }
    if (old) return;
    addCss();
    var b = document.createElement('div'); b.id = 'wu-zftp'; b.className = 'wu-upd';
    if (document.getElementById('wu-upd')) b.style.bottom = 'calc(env(safe-area-inset-bottom,0px) + 96px)';
    b.innerHTML = '<div><b>Neue FTP ' + f + ' W auch in Zwift eintragen</b><span>intervals.icu ist schon aktualisiert. Zwift lässt sich nur von Hand ändern: im Profil bei FTP.</span></div><button class="wu-b" data-wu="zftp">In Zwift erledigt</button>';
    b.addEventListener('click', function (e) { if (!e.target.closest('[data-wu="zftp"]')) return; setCfg({ zwFtp: null, zwFtpOk: f }); b.remove(); toast('Danke, FTP ' + f + ' W in Zwift bestätigt.'); });
    document.body.appendChild(b);
  }
  setTimeout(zwFtpBanner, 3000);
  WU.ivSync = ivSync;
  window.WU_IVSTAT = function (d) { var c = cfg(); if (!c.ivKey || c.ivOn === false) return null; var t0 = new Date(), td = t0.getFullYear() + '-' + ('0' + (t0.getMonth() + 1)).slice(-2) + '-' + ('0' + t0.getDate()).slice(-2); return { ok: (c.ivIds || []).indexOf('wu-' + d) >= 0, adj: d === td ? c.ivAdjNow || '' : '' }; };
  /* Stündliches Wetter für die Karte „Wetter und Kleidung“ */
  var HRC = {};
  window.WU_HOURLY = async function (d) {
    if (HRC[d] && Date.now() - HRC[d].ts < 3600000) return HRC[d].v;
    var u = 'https://api.open-meteo.com/v1/forecast?' + qs({ latitude: GEO.lat, longitude: GEO.lon, hourly: 'temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m', daily: 'sunset', timezone: 'Europe/Vienna', start_date: d, end_date: d });
    var j = await http(u, {});
    var h = j && j.hourly || {}, v = { t: h.time || [], tt: h.temperature_2m || [], at: h.apparent_temperature || [], pp: h.precipitation_probability || [], ws: h.wind_speed_10m || [], wd: h.wind_direction_10m || [], ss: j && j.daily && j.daily.sunset && j.daily.sunset[0] };
    HRC[d] = { ts: Date.now(), v: v };
    return v;
  };
  setTimeout(function () { ivSync(false); }, 6000);
  setInterval(function () { if (document.visibilityState === 'visible') ivSync(false); }, 60000);
  window.WU_SKI_ON = function () { return cfg().skiOn !== false; };
  setTimeout(function () { skiSync(false); }, 2500);

  /* Sprung aus einer Benachrichtigung direkt in den passenden Dialog */
  var T0 = now();
  function goFrom(o) {
    if (!o || (o.k !== 'mood' && o.k !== 'act' && o.k !== 'plan' && o.k !== 'ski' && o.k !== 'coach')) { if (now() - T0 > 8000) location.reload(); return; }
    try { sessionStorage.setItem('wu_go', JSON.stringify({ k: o.k, id: o.id || null, t: now() })); } catch (e) { }
    if (now() - T0 > 8000) location.reload(); else goRun();
  }
  function goRun() {
    var o = null; try { o = JSON.parse(sessionStorage.getItem('wu_go') || 'null'); } catch (e) { }
    if (!o || now() - o.t > 120000) { try { sessionStorage.removeItem('wu_go'); } catch (e) { } return; }
    var t0 = now();
    function done() { try { sessionStorage.removeItem('wu_go'); } catch (e) { } }
    (function tick() {
      if (now() - t0 > 25000) { done(); return; }
      if (!window.WU_OPEN || !window.WU_STATE) { setTimeout(tick, 400); return; }
      if (o.k === 'coach') { done(); WU.close(); window.WU_OPEN('coach'); return; }
      if (o.k === 'ski') { done(); WU.close(); skiSync(true).then(function () { window.WU_OPEN('ski'); }); return; }
      if (o.k === 'plan') { done(); WU.close(); var nm = new Date(); nm.setDate(nm.getDate() + ((8 - nm.getDay()) % 7 || 7)); window.WU_OPEN('w:' + nm.getFullYear() + '-' + ('0' + (nm.getMonth() + 1)).slice(-2) + '-' + ('0' + nm.getDate()).slice(-2)); return; }
      if (o.k === 'mood') { done(); WU.close(); var go = function () { window.WU_OPEN('mood'); }; if (typeof hcSync === 'function' && cfg().hcOk) { Promise.race([hcSync(false), new Promise(function (r) { setTimeout(r, 6000); })]).then(go, go); } else go(); return; }
      var L = window.WU_ACTS ? window.WU_ACTS() : [], a = o.id ? L.filter(function (x) { return x.id === String(o.id); })[0] : null;
      if (!a && o.id && now() - t0 < 20000) { setTimeout(tick, 600); return; }
      if (!a) { var srt = L.slice().sort(function (x, y) { return x.day < y.day ? 1 : -1; }); a = srt.filter(function (x) { return !x.rated; })[0] || srt[0]; }
      done(); if (a) { WU.close(); window.WU_OPEN('a:' + a.id); }
    })();
  }
  goRun();
  /* Neue App-Version */
  var UPD = null;
  async function checkUpdate(force) {
    if (!CAPN || !PL.App) return null;
    var last = lg('wu_updchk', { t: 0, v: 0 });
    var info = await PL.App.getInfo(), cur = Number(info.build) || 0, latest = last.v;
    if (force || now() - last.t > 6 * 3600000) {
      try {
        var r = await fetch('https://api.github.com/repos/christophschmid-design/wattsup/releases/tags/apk', { headers: { Accept: 'application/vnd.github+json' } });
        if (r.ok) { var j = await r.json(), m = /Version 1\.(\d+)/.exec(j.body || ''); if (m) latest = Number(m[1]); ls('wu_updchk', { t: now(), v: latest }); }
      } catch (e) { }
    }
    UPD = { cur: cur, latest: latest, newer: latest > cur };
    if (UPD.newer) updBanner();
    return UPD;
  }
  function updBanner() {
    addCss(); if (document.getElementById('wu-upd') || lg('wu_updskip', 0) === UPD.latest) return;
    var b = document.createElement('div'); b.id = 'wu-upd'; b.className = 'wu-upd';
    b.innerHTML = '<div><b>Neue App-Version 1.' + UPD.latest + '</b><span>Installiert: 1.' + UPD.cur + '</span></div><button class="wu-b" data-wu="upd">Jetzt aktualisieren</button><button class="wu-x" data-wu="updx" aria-label="Später">×</button>';
    b.addEventListener('click', function (e) { var k = e.target.closest('[data-wu]'); if (!k) return; if (k.getAttribute('data-wu') === 'updx') { ls('wu_updskip', UPD.latest); b.remove(); } else doUpdate(b); });
    document.body.appendChild(b);
  }
  async function doUpdate(el) {
    if (!NAT) { location.href = APK; return; }
    try {
      var ok = await NAT.canInstall();
      if (!ok.allowed) { toast('Bitte erlauben, dass WattsUp Apps installieren darf, dann erneut tippen.'); await NAT.openInstallSettings(); return; }
      var lab = el && el.querySelector('b'); if (lab) lab.textContent = 'Wird geladen …';
      var h = await NAT.addListener('progress', function (e) { if (lab) lab.textContent = 'Wird geladen … ' + e.pct + ' %'; });
      await NAT.installApk({ url: APK });
      try { h.remove(); } catch (e) { }
      if (lab) lab.textContent = 'Installation bestätigen';
    } catch (e) { toast(e.message || 'Update fehlgeschlagen'); }
  }
  WU.checkUpdate = checkUpdate; WU.doUpdate = doUpdate;
  /* Push über Strava-Webhook, Cloudflare und Firebase */
  var FM = PL.FirebaseMessaging;
  function pushBase() { return String(cfg().pushUrl || '').trim().replace(/\/+$/, ''); }
  async function pushTopic(on) {
    var c = cfg(); if (!FM || !c.pushTopic) return;
    try { if (on) await FM.subscribeToTopic({ topic: c.pushTopic }); else await FM.unsubscribeFromTopic({ topic: c.pushTopic }); } catch (e) { }
  }
  async function pushActivate() {
    var c = cfg(), url = pushBase();
    if (!FM) { toast('Diese App-Version kann noch keine Push-Nachrichten. Bitte zuerst aktualisieren.'); return; }
    if (!/^https:\/\//.test(url)) { toast('Bitte zuerst die Adresse des Push-Dienstes eintragen.'); return; }
    if (!stOk()) { toast('Bitte zuerst Strava verbinden.'); return; }
    var p = await FM.requestPermissions();
    if (p.receive !== 'granted') { toast('Benachrichtigungen sind für WattsUp nicht erlaubt.'); return; }
    toast('Push wird eingerichtet …');
    var a = await athlete(), topic = 'wattsup_' + a.id;
    await FM.subscribeToTopic({ topic: topic });
    if (cfg().skiOn !== false) try { await FM.subscribeToTopic({ topic: topic + '_ski' }); } catch (e) { }
    var base = 'https://www.strava.com/api/v3/push_subscriptions', au = qs({ client_id: c.stId, client_secret: c.stSec });
    var ex = await http(base + '?' + au) || [], has = false;
    for (var i = 0; i < ex.length; i++) {
      if (ex[i].callback_url === url) has = true;
      else await http(base + '/' + ex[i].id + '?' + au, { method: 'DELETE' });
    }
    if (!has) await http(base, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs({ client_id: c.stId, client_secret: c.stSec, callback_url: url, verify_token: 'wattsup' }) });
    setCfg({ pushOk: now(), pushTopic: topic, pushUrl: url });
    runnerCfg();
    await pushTest();
  }
  /* Nachricht an das Handy (z. B. vom Coach), auch von Tablet oder Surface */
  window.WU_NOTIFY = async function (title, body, k) {
    var base = pushBase(); if (!/^https:\/\//.test(base)) return false;
    var id = String(cfg().pushTopic || '').split('_')[1]; if (!id) { try { id = String((await athlete()).id); } catch (e) { return false; } }
    var r = await http(base + '/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: id, t: String(title || '').slice(0, 60), b: String(body || '').slice(0, 220), k: k || 'coach' }) });
    return !!(r && r.ok);
  };
  async function pushTest() {
    var c = cfg(), id = String(c.pushTopic || '').split('_')[1];
    var r = await http(pushBase() + '/test?athlete=' + encodeURIComponent(id));
    toast(r && r.ok ? 'Push ist aktiv. Die Test-Nachricht sollte gleich erscheinen.' : 'Test fehlgeschlagen: ' + (r && r.error || ''));
  }
  if (CAPN && FM && cfg().pushOk && cfg().pushTopic && cfg().skiOn !== false && !cfg().skiSub) { FM.subscribeToTopic({ topic: cfg().pushTopic + '_ski' }).then(function () { setCfg({ skiSub: 1 }); }).catch(function () { }); }
  if (CAPN && FM) {
    FM.addListener('notificationActionPerformed', function (e) { var d = (e && e.notification && e.notification.data) || {}; goFrom({ k: d.k, id: d.id }); });
    FM.addListener('notificationReceived', function (e) { var n = e && e.notification; if (n && n.title) toast(n.title + (n.body ? ': ' + n.body : '')); });
  }

  /* ---------- Neue Fassung der Web-Version sofort laden ---------- */
  (function freshCheck() {
    var me = document.querySelector('meta[name="wu-build"]'), cur = me && me.content;
    if (!cur || RET) return;
    fetch('build.json?t=' + now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.b || j.b === cur) { try { sessionStorage.removeItem('wu_fresh'); } catch (e) { } return; }
      var n = 0; try { n = Number(sessionStorage.getItem('wu_fresh') || 0); sessionStorage.setItem('wu_fresh', n + 1); } catch (e) { }
      if (n < 2) location.replace(HOME + '?b=' + j.b);
    }).catch(function () { });
  })();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var me = document.querySelector('meta[name="wu-build"]'), cur = me && me.content; if (!cur) return;
    fetch('build.json?t=' + now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.b && j.b !== cur) location.replace(HOME + '?b=' + j.b); }).catch(function () { });
  });

  /* ---------- Start ---------- */
  var startP = (async function () {
    if (RET) { var r = await handleReturn(RET); if (r === 'stop') return 'stop'; }
    ready();
  })();
  window.WU_START = startP;
  document.addEventListener('DOMContentLoaded', function () {
    startP.then(function (r) {
      if (r === 'stop') return;
      checkUpdate(false);
      var c = cfg();
      if (!stOk() || !c.aKey || !gOk()) setTimeout(function () { WU.open(!stOk() ? 'Willkommen bei WattsUp. Verbinde zuerst Strava, dann Google und hinterlege den Schlüssel für Claude.' : !gOk() ? 'Google ist noch nicht verbunden. Ohne Google gibt es keinen Kalender und keinen Abgleich zwischen Geräten.' : 'Für die Planung fehlt noch der Schlüssel für die Claude-Schnittstelle.'); }, 600);
    });
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { clearTimeout(pushT); push(); } });
})();
