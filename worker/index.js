import { skiCheck, skiText } from './ski.js';
// WattsUp Push: empfängt Meldungen von Strava und schickt eine Push-Nachricht ans Handy.
// Keine Speicherung: Das Handy hört auf das Thema "wattsup_<Strava-Athleten-ID>".

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

export default {
  // Freitags: Skitour-Vorschlag fürs Wochenende (nur Dezember bis April)
  async scheduled(event, env, ctx) {
    const m = new Date().getUTCMonth() + 1;
    if (!env.ATHLETE) return;
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

    // Meldung von Strava
    if (req.method === 'POST') {
      const ev = await req.json().catch(() => null);
      if (ev && ev.object_type === 'activity' && ev.aspect_type === 'create' && ev.owner_id) {
        ctx.waitUntil(push(env, ev.owner_id, 'Neue Aktivität auf Strava', 'Kurz in WattsUp bewerten?', { k: 'act', id: String(ev.object_id) }).catch(e => console.log(e.message)));
      }
      return new Response('ok');
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
