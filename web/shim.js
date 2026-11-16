/* WattsUp, eigenständige Laufzeit.
   Ersetzt die Claude-Laufzeit (window.claude.use) durch direkte Zugriffe auf
   Strava, Google Kalender und Drive, Open-Meteo und die Claude-Schnittstelle.
   Die App selbst bleibt unverändert. */
(function () {
  'use strict';
  var VER = 'web-1';
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
  function stOk() { var c = cfg(); return !!(c.stId && c.stSec && stTok()); }
  function stConnect() {
    var c = cfg();
    if (!c.stId || !c.stSec) { WU.open('Bitte zuerst Client-ID und Client-Secret von Strava eintragen.'); return; }
    location.href = SV + '/oauth/authorize?' + qs({ client_id: c.stId, redirect_uri: HOME, response_type: 'code', approval_prompt: 'auto', scope: 'read,activity:read_all,profile:read_all', state: 'strava' });
  }
  async function stExchange(code) {
    var c = cfg();
    var j = await http(SV + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: c.stId, client_secret: c.stSec, code: code, grant_type: 'authorization_code' }) });
    ls('wu_strava', { a: j.access_token, r: j.refresh_token, x: j.expires_at, who: j.athlete && (j.athlete.firstname || '') });
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
      if (id) { var tk = await gToken(); var r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media', { headers: { Authorization: 'Bearer ' + tk } }); if (r.ok) { var rem = await r.json(); ls(DBK, merge(dbAll(), (rem && rem.docs) || {})); } }
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
  function usd(v) { return v.toFixed(v < 1 ? 3 : 2).replace('.', ',') + ' $'; }
  async function ask(input, opts) {
    var c = cfg(); opts = opts || {};
    if (!c.aKey) throw fail('not_granted', 'Kein Schlüssel für die Claude-Schnittstelle eingetragen');
    var model = c.once || c.model || 'claude-sonnet-5-5', M = MODELS[model] || MODELS['claude-sonnet-5-5'];
    var lim = Number(c.limit || 0), ms = monthSum();
    if (lim > 0 && ms >= lim && !c.over) throw fail('rate_limited', 'Monatsgrenze von ' + usd(lim) + ' erreicht. Im Menü unter Verbindungen und Kosten anpassen.');
    var msgs = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
    var body = { model: model, max_tokens: opts.maxTokens || 16000, messages: msgs };
    if (opts.json) body.system = 'Antworte ausschließlich mit einem einzigen gültigen JSON-Objekt. Kein Markdown, keine Codeblöcke, kein Text davor oder danach.';
    var j = await http('https://api.anthropic.com/v1/messages', { method: 'POST', signal: opts.signal, headers: { 'Content-Type': 'application/json', 'x-api-key': c.aKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) });
    var u = j.usage || {}, inp = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1, out = u.output_tokens || 0;
    var cost = (inp * M.i + out * M.o) / 1e6, list = costs();
    list.push({ ts: now(), model: model, i: u.input_tokens || 0, o: out, usd: cost }); if (list.length > 400) list = list.slice(-400); ls('wu_cost', list);
    if (c.once) setCfg({ once: null });
    toast('Planung mit ' + M.n + ': ' + usd(cost) + (lim > 0 ? ', Monat ' + usd(monthSum()) + ' von ' + usd(lim) : ', Monat ' + usd(monthSum())));
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
    var p = new URLSearchParams(location.search), code = p.get('code'), st = p.get('state'), er = p.get('error');
    if (!st || (!code && !er)) return null;
    history.replaceState(null, '', HOME);
    return { code: code, st: st, err: er };
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
      if (r.st === 'strava') { await stExchange(r.code); toast('Strava ist verbunden.'); }
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

  /* ---------- Oberfläche: Verbindungen und Kosten ---------- */
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var CSS = '.wu-ov[hidden],.wu-t[hidden]{display:none!important}.wu-ov{position:fixed;inset:0;z-index:9999;background:rgba(8,18,30,.55);display:flex;align-items:flex-end;justify-content:center}' +
    '.wu-sh{background:var(--bg,#f3f5f8);color:var(--tx,#0f2236);width:100%;max-width:640px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:18px 16px 28px;box-sizing:border-box;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    '@media(min-width:700px){.wu-ov{align-items:center}.wu-sh{border-radius:22px}}' +
    '.wu-sh h2{margin:0 0 4px;font-size:1.25rem}.wu-sh h3{margin:18px 0 8px;font-size:1rem}.wu-mu{color:#5b6b7b;font-size:.88rem;margin:4px 0}' +
    '.wu-c{background:var(--card,#fff);border-radius:16px;padding:12px 14px;margin:10px 0;box-shadow:0 1px 4px rgba(15,34,54,.08)}' +
    '.wu-sh label{display:block;font-size:.82rem;color:#5b6b7b;margin:8px 0 3px}.wu-sh input,.wu-sh select{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cfd8e2;border-radius:10px;font:inherit;background:#fff;color:#0f2236}' +
    '.wu-b{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:10px 16px;font:600 .92rem system-ui;background:#1a6be0;color:#fff;margin:10px 8px 0 0;cursor:pointer}.wu-b.alt{background:#e3ebf5;color:#0f2236}' +
    '.wu-st{display:inline-block;font-size:.78rem;font-weight:700;padding:3px 9px;border-radius:999px;margin-left:6px}.wu-ok{background:#d9f5e8;color:#0b7a4b}.wu-no{background:#fde4df;color:#b2361f}.wu-wa{background:#fff1d6;color:#9a6200}' +
    '.wu-x{float:right;border:0;background:#e3ebf5;border-radius:50%;width:34px;height:34px;font-size:18px;cursor:pointer;color:#0f2236}.wu-cp{font:12px ui-monospace,monospace;background:#e9eef4;padding:6px 8px;border-radius:8px;word-break:break-all;display:block;margin-top:4px}' +
    '.wu-t{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translateX(-50%);background:#0f2236;color:#fff;padding:10px 16px;border-radius:12px;font:14px system-ui;z-index:10000;max-width:88vw;box-shadow:0 6px 18px rgba(0,0,0,.3)}' +
    '.wu-tb{width:100%;border-collapse:collapse;font-size:.86rem}.wu-tb td{padding:4px 0;border-bottom:1px solid #e3e9f0}.wu-tb td:last-child{text-align:right}';
  function addCss() { if (document.getElementById('wu-css')) return; var s = document.createElement('style'); s.id = 'wu-css'; s.textContent = CSS; document.head.appendChild(s); }
  var tT = null;
  function toast(m) { addCss(); var t = document.querySelector('.wu-t'); if (!t) { t = document.createElement('div'); t.className = 'wu-t'; document.body.appendChild(t); } t.textContent = m; t.hidden = false; clearTimeout(tT); tT = setTimeout(function () { t.hidden = true; }, 4000); }
  function st(ok, txt) { return '<span class="wu-st ' + (ok === true ? 'wu-ok' : ok === 'w' ? 'wu-wa' : 'wu-no') + '">' + txt + '</span>'; }
  function fld(id, lab, val, type, ph) { return '<label for="' + id + '">' + lab + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + E(val || '') + '" placeholder="' + E(ph || '') + '" autocomplete="off" autocapitalize="off" spellcheck="false">'; }
  function render(note) {
    var c = cfg(), m = monthKey(now()), lst = costs().filter(function (x) { return monthKey(x.ts) === m; }), sum = monthSum(), lim = Number(c.limit || 0);
    var sy = SYNC.st === 'ok' ? st(true, 'abgeglichen ' + new Date(SYNC.ts).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })) : SYNC.st === 'err' ? st(false, 'Fehler') : st('w', 'aus');
    return '<button class="wu-x" data-wu="close" aria-label="Schließen">×</button><h2>Verbindungen und Kosten</h2><p class="wu-mu">Alle Schlüssel bleiben nur auf diesem Gerät. Anleitung: <a href="https://github.com/christophschmid-design/wattsup/blob/main/docs/EINRICHTUNG.md" target="_blank" rel="noopener">Einrichtung Schritt für Schritt</a></p>' +
      (note ? '<p class="wu-c" style="background:#fff1d6">' + E(note) + '</p>' : '') +
      '<div class="wu-c"><h3 style="margin-top:0">Strava ' + (stOk() ? st(true, 'verbunden') : st(false, 'nicht verbunden')) + '</h3>' +
      fld('wu-stId', 'Client-ID', c.stId) + fld('wu-stSec', 'Client-Secret', c.stSec, 'password') +
      '<p class="wu-mu">Bei Strava als „Authorization Callback Domain“ eintragen:<code class="wu-cp">' + E(location.host) + '</code></p>' +
      '<button class="wu-b" data-wu="st">' + (stOk() ? 'Neu verbinden' : 'Mit Strava verbinden') + '</button>' + (stOk() ? '<button class="wu-b alt" data-wu="stx">Trennen</button>' : '') + '</div>' +
      '<div class="wu-c"><h3 style="margin-top:0">Google Kalender und Abgleich ' + (gOk() ? st(true, 'verbunden') : st(false, 'nicht verbunden')) + '</h3>' +
      fld('wu-gId', 'Client-ID', c.gId) + fld('wu-gSec', 'Client-Secret', c.gSec, 'password') + fld('wu-cal', 'Kalender-ID', c.cal || CAL0) +
      '<p class="wu-mu">Bei Google als „Autorisierte Weiterleitungs-URI“ eintragen:<code class="wu-cp">' + E(HOME) + '</code></p>' +
      '<p class="wu-mu">Abgleich zwischen Geräten über einen versteckten Ordner in deinem Google Drive: ' + sy + (SYNC.st === 'err' ? '<br>' + E(SYNC.msg) : '') + '</p>' +
      '<button class="wu-b" data-wu="g">' + (gOk() ? 'Neu verbinden' : 'Mit Google verbinden') + '</button>' + (gOk() ? '<button class="wu-b alt" data-wu="sync">Jetzt abgleichen</button><button class="wu-b alt" data-wu="gx">Trennen</button>' : '') + '</div>' +
      '<div class="wu-c"><h3 style="margin-top:0">Claude für die Planung ' + (c.aKey ? st(true, 'Schlüssel hinterlegt') : st(false, 'kein Schlüssel')) + '</h3>' +
      fld('wu-aKey', 'API-Schlüssel (beginnt mit sk-ant-)', c.aKey, 'password') +
      '<label for="wu-model">Modell für die Planung</label><select id="wu-model">' + Object.keys(MODELS).map(function (k) { var M = MODELS[k]; return '<option value="' + k + '"' + ((c.model || 'claude-sonnet-5-5') === k ? ' selected' : '') + '>' + M.n + ' (' + String(M.i).replace('.', ',') + ' $ / ' + String(M.o).replace('.', ',') + ' $ pro Mio. Tokens)</option>'; }).join('') + '</select>' +
      '<label for="wu-once">Nur die nächste Planung gründlicher</label><select id="wu-once"><option value="">Nein, Standardmodell</option><option value="claude-opus-5-5"' + (c.once === 'claude-opus-5-5' ? ' selected' : '') + '>Ja, mit Opus 5.5</option><option value="claude-fable-5-2"' + (c.once === 'claude-fable-5-2' ? ' selected' : '') + '>Ja, mit Fable 5.2</option></select>' +
      fld('wu-limit', 'Monatsgrenze in $ (0 = keine)', c.limit != null ? c.limit : 3, 'text', '3') + '</div>' +
      '<div class="wu-c"><h3 style="margin-top:0">Kosten ' + (m) + '</h3><p style="margin:0"><b>' + usd(sum) + '</b> für ' + lst.length + (lst.length === 1 ? ' Planung' : ' Planungen') + (lim > 0 ? ', Grenze ' + usd(lim) + (sum >= lim ? ' ' + st(false, 'erreicht') : sum >= lim * .8 ? ' ' + st('w', 'über 80 %') : '') : '') + '</p>' +
      (lst.length ? '<table class="wu-tb">' + lst.slice(-6).reverse().map(function (x) { return '<tr><td>' + new Date(x.ts).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ', ' + (MODELS[x.model] ? MODELS[x.model].n : x.model) + '</td><td>' + usd(x.usd) + '</td></tr>'; }).join('') + '</table>' : '') +
      '<p class="wu-mu">Berechnet aus dem gemeldeten Verbrauch und der Preisliste. Maßgeblich ist die Abrechnung in der Anthropic Console.</p></div>' +
      '<div class="wu-c"><h3 style="margin-top:0">Daten</h3><p class="wu-mu">Daten aus der Claude-Version übernehmen: dort im Menü „Daten für WattsUp exportieren“ und die Datei hier wählen.</p><input type="file" id="wu-imp" accept=".json,.txt,application/json,text/plain"><button class="wu-b alt" data-wu="exp">Sicherung exportieren</button></div>' +
      '<button class="wu-b" data-wu="save">Speichern</button><button class="wu-b alt" data-wu="close">Schließen</button><p class="wu-mu">WattsUp ' + VER + (CAPN ? ', Android' : ', Browser') + '</p>';
  }
  function saveForm() {
    function v(id) { var e = document.getElementById(id); return e ? e.value.trim() : undefined; }
    var lim = parseFloat(String(v('wu-limit') || '0').replace(',', '.'));
    setCfg({ stId: v('wu-stId'), stSec: v('wu-stSec'), gId: v('wu-gId'), gSec: v('wu-gSec'), cal: v('wu-cal') || CAL0, aKey: v('wu-aKey'), model: v('wu-model'), once: v('wu-once') || null, limit: isNaN(lim) ? 0 : lim });
  }
  var WU = {
    open: function (note) { addCss(); var o = document.getElementById('wu-ov'); if (!o) { o = document.createElement('div'); o.id = 'wu-ov'; o.className = 'wu-ov'; document.body.appendChild(o); o.addEventListener('click', onClick); o.addEventListener('change', onChange); } o.innerHTML = '<div class="wu-sh" role="dialog" aria-modal="true">' + render(note) + '</div>'; o.hidden = false; },
    close: function () { var o = document.getElementById('wu-ov'); if (o) o.hidden = true; },
    toast: toast, exportData: exportData
  };
  window.WU = WU;
  async function onClick(e) {
    if (e.target.id === 'wu-ov') { WU.close(); return; }
    var b = e.target.closest('[data-wu]'); if (!b) return; var k = b.getAttribute('data-wu');
    if (k === 'close') { saveForm(); WU.close(); return; }
    saveForm();
    if (k === 'save') { toast('Gespeichert. WattsUp lädt neu …'); setTimeout(function () { location.reload(); }, 900); return; }
    if (k === 'st') stConnect();
    if (k === 'stx') { ls('wu_strava', null); WU.open(); }
    if (k === 'g') gConnect();
    if (k === 'gx') { ls('wu_google', null); syncSt('aus'); WU.open(); }
    if (k === 'sync') { await pull(); await push(); WU.open(); toast(SYNC.st === 'ok' ? 'Abgeglichen.' : 'Abgleich fehlgeschlagen.'); }
    if (k === 'exp') exportData();
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
  /* Menüeintrag in der App abfangen */
  window.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-k="wu"]');
    if (!t) return; e.preventDefault(); e.stopImmediatePropagation(); WU.open();
  }, true);

  /* ---------- Start ---------- */
  var startP = (async function () {
    if (RET) { var r = await handleReturn(RET); if (r === 'stop') return 'stop'; }
    ready();
  })();
  window.WU_START = startP;
  document.addEventListener('DOMContentLoaded', function () {
    startP.then(function (r) {
      if (r === 'stop') return;
      var c = cfg();
      if (!stOk() || !c.aKey || !gOk()) setTimeout(function () { WU.open(!stOk() ? 'Willkommen bei WattsUp. Verbinde zuerst Strava, dann Google und hinterlege den Schlüssel für Claude.' : !gOk() ? 'Google ist noch nicht verbunden. Ohne Google gibt es keinen Kalender und keinen Abgleich zwischen Geräten.' : 'Für die Planung fehlt noch der Schlüssel für die Claude-Schnittstelle.'); }, 600);
    });
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { clearTimeout(pushT); push(); } });
})();
