import { skiCheck, skiText } from './ski.js';
/* ---------- Coach bei geschlossener App (v43) ----------
   Die App schickt beim Öffnen einen kleinen Stand (Plan der nächsten 14 Tage, erledigte Tage, Rennen).
   Strava meldet neue Aktivitäten. Stündlich prüft der Worker ein paar Regeln und schickt höchstens
   eine Nachricht pro Tag. Gespeichert wird nur dieser Stand, im Durable Object des Sportlers. */
import { DurableObject } from 'cloudflare:workers';
export class CoachDO extends DurableObject {
  async get() {
    const [snap, sec, acts, sent] = await Promise.all(['snap', 'sec', 'acts', 'sent'].map(k => this.ctx.storage.get(k)));
    return { snap: snap || null, sec: sec || null, acts: acts || [], sent: sent || {} };
  }
  async sync(j) {
    const sec = await this.ctx.storage.get('sec');
    if (sec && sec !== j.s) return { ok: false, error: 'secret' };
    if (!sec) await this.ctx.storage.put('sec', j.s);
    await this.ctx.storage.put('snap', { on: j.on !== false, open: Number(j.open) || Date.now(), plan: (j.plan || []).slice(0, 21), done: (j.done || []).slice(-14), next: !!j.next, races: (j.races || []).slice(0, 4), ts: Date.now() });
    return { ok: true };
  }
  async act(day) {
    const a = (await this.ctx.storage.get('acts')) || [];
    if (a.indexOf(day) < 0) { a.push(day); await this.ctx.storage.put('acts', a.slice(-30)); }
  }
  async mark(day, k) {
    const s = (await this.ctx.storage.get('sent')) || {};
    s[day] = k; const keys = Object.keys(s).sort(); while (keys.length > 40) delete s[keys.shift()];
    await this.ctx.storage.put('sent', s);
  }
}
function vie(d) {
  const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' }).formatToParts(d).forEach(x => p[x.type] = x.value);
  return { day: p.year + '-' + p.month + '-' + p.day, h: Number(p.hour) % 24, wd: p.weekday };
}
function ddiff(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }
function pick(l, seed) { let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0; return l[h % l.length]; }
function coachRule(st, now) {
  const s = st.snap; if (!s || !s.on) return null;
  const L = vie(now), t = L.day, p = (s.plan || []).find(x => x.d === t), done = (s.done || []).indexOf(t) >= 0 || st.acts.indexOf(t) >= 0;
  if (st.sent[t]) return null;
  const r = (s.races || []).map(x => ({ n: x.n, d: x.d, in: ddiff(t, x.d) })).filter(x => x.in >= 0).sort((a, b) => a.in - b.in)[0];
  if (L.h === 7) {
    if (r && r.in === 0) return { k: 'race', t: r.n + ': heit is da Tog', b: pick(['Gib Gas und speib erst im Ziel. Pacing-Plan im Kopf, Riegel im Trikot.', 'Heit wird obgrechnet. Locker oofonga, hintn raus Gas.'], t) };
    if (r && [100, 50, 30, 14, 7, 3, 1].indexOf(r.in) >= 0) return { k: 'count', t: 'No ' + r.in + (r.in === 1 ? ' Tog' : ' Tog') + ' bis ' + r.n, b: pick(['Jeda Tog zöd, a de foin.', 'Jetzt nur net deppat wern.', 'S\'Timmelsjoch wart net af Hosnscheißer.'], t) };
    if (p && (p.k === 'hard' || p.k === 'long')) return { k: 'am', t: 'Heit: ' + p.t, b: (p.time ? p.time + ' Uhr. ' : '') + (p.k === 'hard' ? 'Heit duats weh. Vorher kurz s\'Morgengefühl eintragen, dann passt da Coach an.' : 'Lange Einheit. Vagiss s\'Essn net und d\'Sitzcreme a net.') };
  }
  if (L.h === 21 && p && p.tss > 0 && !done) return { k: 'miss', t: p.t + ' ausglassn?', b: 'Passiert. Sag ma kurz, wos los woa, dann plan i um.' };
  if (L.h === 18 && L.wd === 'Sun' && !s.next) return { k: 'plan', t: 'Wochenplanung steht an', b: 'Fia nächste Woch is no nix plant. Zwoa Minutn, dann passt des.' };
  if (L.h === 12 && now - (s.open || 0) > 4 * 864e5) return { k: 'away', t: 'Lebst no?', b: 'Seit ' + Math.floor((now - s.open) / 864e5) + ' Tog nix vo dir ghört. Schau kurz eine, dann passt da Plan wieda.' };
  return null;
}

// WattsUp Push: empfängt Meldungen von Strava und schickt eine Push-Nachricht ans Handy.
// Das Handy hört auf das Thema "wattsup_<Strava-Athleten-ID>". Gespeichert wird nur der Coach-Stand (siehe CoachDO).

const VERIFY = 'wattsup';

function b64u(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToBuf(pem) {
  const b = atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u.buffer;
}

let cached = null;
async function googleToken(sa) {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey('pkcs8', pemToBuf(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + claim));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + claim + '.' + b64u(sig)
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google-Anmeldung fehlgeschlagen: ' + JSON.stringify(j));
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

async function push(env, athlete, title, body, data) {
  const sa = JSON.parse(env.FCM_SA);
  const tok = await googleToken(sa);
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        topic: 'wattsup_' + athlete,
        notification: { title, body },
        data: data || {},
        android: { priority: 'HIGH', notification: { icon: 'ic_stat_wattsup', color: '#3DDC97' } }
      }
    })
  });
  if (!r.ok) throw new Error('FCM ' + r.status + ': ' + (await r.text()));
}

// Stille Datennachricht (ohne Anzeige), damit das Widget sofort nach der Belastung fragt
async function pushData(env, athlete, data) {
  const sa = JSON.parse(env.FCM_SA);
  const tok = await googleToken(sa);
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { topic: 'wattsup_' + athlete, data: data || {}, android: { priority: 'HIGH' } } })
  });
  if (!r.ok) throw new Error('FCM ' + r.status + ': ' + (await r.text()));
}

export default {
  // Freitags: Skitour-Vorschlag fürs Wochenende (nur Dezember bis April)
  async scheduled(event, env, ctx) {
    const m = new Date().getUTCMonth() + 1, now = new Date(event.scheduledTime || Date.now());
    if (!env.ATHLETE) return;
    // Coach-Regeln (stündlich)
    if (env.COACH) ctx.waitUntil((async () => {
      const stub = env.COACH.get(env.COACH.idFromName(env.ATHLETE)), st = await stub.get(), r = coachRule(st, now.getTime());
      if (!r) return;
      await push(env, env.ATHLETE, r.t, r.b, { k: 'coach' });
      await stub.mark(vie(now).day, r.k);
    })().catch(e => console.log('coach', e.message)));
    // Skitour nur freitags 17 Uhr UTC
    if (!(now.getUTCDay() === 5 && now.getUTCHours() === 17)) return;
    ctx.waitUntil((async () => {
      const r = await skiCheck();
      if (!r.lagebericht && m > 4 && m < 12) return; // außerhalb der Saison ohne Lagebericht keine Nachricht
      const t = skiText(r); await push(env, env.ATHLETE + '_ski', t.title, t.body, { k: 'ski' });
    })().catch(e => console.log(e.message)));
  },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const cors = { 'Access-Control-Allow-Origin': '*' };

    // Strava prüft die Adresse beim Einrichten
    if (req.method === 'GET' && url.searchParams.get('hub.mode') === 'subscribe') {
      if (url.searchParams.get('hub.verify_token') !== VERIFY) return new Response('forbidden', { status: 403 });
      return Response.json({ 'hub.challenge': url.searchParams.get('hub.challenge') });
    }

    // Machbarkeitstest Karoo-Coach (nur für die Testphase)
    if (url.pathname === '/coach-test') {
      if (url.searchParams.get('k') !== 'wu-karoo-test-7f3a') return new Response('forbidden', { status: 403 });
      if (req.method === 'GET') {
        return Response.json({
          name: 'Test: 5 × 8 min Sweetspot',
          stand: new Date().toISOString(),
          steps: [
            { t: 'Einfahren', s: 900, lo: 150, hi: 170 },
            { t: 'Intervall', s: 480, lo: 235, hi: 245, n: 5, pause: 240 },
            { t: 'Ausfahren', s: 600, lo: 120, hi: 150 }
          ]
        });
      }
      if (req.method === 'POST') {
        const j = await req.json().catch(() => ({}));
        const sum = String(j.sum || '').slice(0, 400);
        try {
          await push(env, env.ATHLETE, 'Karoo-Test ' + String(j.v || '').slice(0, 12), sum || 'leer', { k: 'test' });
          return Response.json({ ok: true });
        } catch (e) { return Response.json({ ok: false, error: e.message }, { status: 500 }); }
      }
      return new Response('method', { status: 405 });
    }

    // Stand für den Coach bei geschlossener App
    if (url.pathname === '/coach-sync') {
      if (req.method === 'OPTIONS') return new Response(null, { headers: Object.assign({ 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }, cors) });
      if (req.method !== 'POST' || !env.COACH) return new Response('nein', { status: 405, headers: cors });
      const j = await req.json().catch(() => ({}));
      if (String(j.a) !== String(env.ATHLETE) || !/^[0-9a-f]{32}$/.test(String(j.s || ''))) return new Response('bad', { status: 400, headers: cors });
      const r = await env.COACH.get(env.COACH.idFromName(env.ATHLETE)).sync(j);
      return Response.json(r, { status: r.ok ? 200 : 403, headers: cors });
    }

    // Nachricht aus der App an das Handy (Coach, Wochenrückblick)
    if (url.pathname === '/notify') {
      if (req.method === 'OPTIONS') return new Response(null, { headers: Object.assign({ 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }, cors) });
      if (req.method !== 'POST') return new Response('method', { status: 405, headers: cors });
      const j = await req.json().catch(() => ({}));
      const a = String(j.a || ''), k = String(j.k || 'coach');
      if (!/^\d+$/.test(a) || !/^(coach|plan)$/.test(k)) return new Response('bad', { status: 400, headers: cors });
      try {
        await push(env, a, String(j.t || 'WattsUp').slice(0, 60), String(j.b || '').slice(0, 220), { k });
        return Response.json({ ok: true }, { headers: cors });
      } catch (e) { return Response.json({ ok: false, error: e.message }, { status: 500, headers: cors }); }
    }

    // Meldung von Strava
    if (req.method === 'POST') {
      const ev = await req.json().catch(() => null);
      if (ev && ev.object_type === 'activity' && ev.aspect_type === 'create' && ev.owner_id && env.COACH && String(ev.owner_id) === String(env.ATHLETE)) {
        ctx.waitUntil(env.COACH.get(env.COACH.idFromName(env.ATHLETE)).act(vie(new Date((ev.event_time || Date.now() / 1000) * 1000)).day).catch(e => console.log(e.message)));
      }
      if (ev && ev.object_type === 'activity' && ev.aspect_type === 'create' && ev.owner_id) {
        ctx.waitUntil(push(env, ev.owner_id, 'Neue Aktivität auf Strava', 'Kurz in WattsUp bewerten?', { k: 'act', id: String(ev.object_id) }).catch(e => console.log(e.message)));
        ctx.waitUntil(pushData(env, ev.owner_id, { k: 'wact', id: String(ev.object_id) }).catch(e => console.log(e.message)));
      }
      return new Response('ok');
    }

    // Routen für Outdoor-Einheiten (v51): Rennrad-Routing über BRouter, Adresssuche über Nominatim
    if (url.pathname === '/route') {
      const ll = url.searchParams.get('lonlats') || '', pr = url.searchParams.get('profile') || 'fastbike';
      if (!/^-?\d+(\.\d+)?,-?\d+(\.\d+)?(\|-?\d+(\.\d+)?,-?\d+(\.\d+)?){1,8}$/.test(ll) || !/^[a-z-]{3,40}$/.test(pr)) return new Response('bad', { status: 400, headers: cors });
      const u = 'https://brouter.de/brouter?lonlats=' + encodeURIComponent(ll) + '&profile=' + pr + '&alternativeidx=0&format=geojson';
      const ck = new Request(u), cache = caches.default;
      let r = await cache.match(ck);
      if (!r) {
        const up = await fetch(u, { headers: { 'User-Agent': 'WattsUp-Trainingsapp (privat)' } });
        const t = await up.text();
        if (!up.ok) return new Response(t.slice(0, 300), { status: 502, headers: cors });
        r = new Response(t, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=604800' } });
        ctx.waitUntil(cache.put(ck, r.clone()));
      }
      return new Response(r.body, { headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'max-age=86400' }, cors) });
    }
    if (url.pathname === '/rgeo') {
      const la = Number(url.searchParams.get('lat')), lo = Number(url.searchParams.get('lon'));
      if (!isFinite(la) || !isFinite(lo)) return new Response('bad', { status: 400, headers: cors });
      const u = 'https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&lat=' + la.toFixed(4) + '&lon=' + lo.toFixed(4), ck = new Request(u), cache = caches.default;
      let r = await cache.match(ck);
      if (!r) {
        const up = await fetch(u, { headers: { 'User-Agent': 'WattsUp-Trainingsapp (privat)', 'Accept-Language': 'de' } });
        const j = up.ok ? await up.json() : {}, a = j.address || {};
        const nm = [a.road || a.path || a.cycleway || a.hamlet || '', a.village || a.suburb || a.town || a.city_district || a.city || ''].filter(Boolean).join(', ');
        r = new Response(JSON.stringify({ name: nm || j.display_name || '' }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=2592000' } });
        ctx.waitUntil(cache.put(ck, r.clone()));
      }
      return new Response(r.body, { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    if (url.pathname === '/geo') {
      const q = (url.searchParams.get('q') || '').slice(0, 160);
      if (q.length < 3) return new Response('bad', { status: 400, headers: cors });
      const up = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), { headers: { 'User-Agent': 'WattsUp-Trainingsapp (privat)', 'Accept-Language': 'de' } });
      const j = up.ok ? await up.json() : [];
      return Response.json(j[0] ? { lat: Number(j[0].lat), lon: Number(j[0].lon), name: j[0].display_name } : { error: 'nicht gefunden' }, { headers: cors });
    }

    // Skitour-Vorschlag für die App
    if (url.pathname === '/ski') {
      try { return Response.json(await skiCheck(), { headers: Object.assign({ 'Cache-Control': 'max-age=1800' }, cors) }); }
      catch (e) { return Response.json({ error: e.message }, { status: 500, headers: cors }); }
    }

    // Test aus der App
    if (url.pathname === '/test') {
      const a = url.searchParams.get('athlete');
      if (!/^\d+$/.test(a || '')) return new Response('athlete fehlt', { status: 400, headers: cors });
      try {
        await push(env, a, 'WattsUp Push funktioniert', 'Neue Aktivitäten werden ab jetzt sofort gemeldet.', { k: 'test' });
        return Response.json({ ok: true }, { headers: cors });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500, headers: cors });
      }
    }

    return new Response('WattsUp Push läuft' + (env.FCM_SA ? '' : ' (FCM_SA fehlt)'), { headers: cors });
  }
};
