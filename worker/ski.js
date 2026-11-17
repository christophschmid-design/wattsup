// Skitour-Vorschlag fürs Wochenende: Lawinenlage (Lawinenwarndienst Salzburg) und Wetter (Open-Meteo).
// Die Liste enthält bekannte Touren im Raum Salzburg; Verhältnisse vor Ort immer selbst prüfen.
export const TOUREN = [
  { n: 'Gaisberg', g: 'Osterhorn', top: 1287, start: 700, hm: 600, lat: 47.805, lon: 13.110, max: 4, art: 'Pistentour, auch bei wenig Schnee und hoher Lawinengefahr' },
  { n: 'Zwölferhorn', g: 'Osterhorn', top: 1522, start: 560, hm: 950, lat: 47.743, lon: 13.355, max: 4, art: 'Pistentour, sicher bei jeder Lawinenlage' },
  { n: 'Trattberg', g: 'Osterhorn', top: 1757, start: 1000, hm: 750, lat: 47.640, lon: 13.280, max: 2, art: 'Klassiker, mäßig steil' },
  { n: 'Gerzkopf', g: 'Dachstein', top: 1728, start: 900, hm: 830, lat: 47.520, lon: 13.380, max: 2, art: 'einfache Almtour' },
  { n: 'Hochkeil', g: 'Hochkönig', top: 1782, start: 1100, hm: 680, lat: 47.390, lon: 13.110, max: 3, art: 'einfach, viel begangen' },
  { n: 'Hundstein', g: 'Kitzbühel', top: 2117, start: 1000, hm: 1100, lat: 47.360, lon: 12.920, max: 2, art: 'lange Grasbergtour' },
  { n: 'Seekarspitze', g: 'Radstädter', top: 2350, start: 1740, hm: 610, lat: 47.250, lon: 13.540, max: 2, art: 'kurz, hochalpin, schneesicher' },
  { n: 'Gamskarkogel', g: 'Gastein', top: 2467, start: 1100, hm: 1360, lat: 47.140, lon: 13.110, max: 2, art: 'lang, viele Höhenmeter' }
];
const LV = { low: 1, moderate: 2, considerable: 3, high: 4, very_high: 5 };
const LN = ['', 'gering (1)', 'mäßig (2)', 'erheblich (3)', 'groß (4)', 'sehr groß (5)'];
const WMO = { 0: 'sonnig', 1: 'überwiegend sonnig', 2: 'teils bewölkt', 3: 'bewölkt', 45: 'Nebel', 48: 'Nebel', 51: 'Niesel', 53: 'Niesel', 55: 'Niesel', 61: 'Regen', 63: 'Regen', 65: 'starker Regen', 71: 'Schneefall', 73: 'Schneefall', 75: 'starker Schneefall', 77: 'Schneegriesel', 80: 'Schauer', 81: 'Schauer', 82: 'starke Schauer', 85: 'Schneeschauer', 86: 'Schneeschauer', 95: 'Gewitter', 96: 'Gewitter', 99: 'Gewitter' };

function iso(d) { return d.toISOString().slice(0, 10); }
function nextSat(now) { const d = new Date(now); d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7)); return d; }

async function bulletin(day) {
  const r = await fetch(`https://static.avalanche.report/eaws_bulletins/${day}/${day}-AT-05.json`);
  if (!r.ok) return null;
  return r.json();
}
function dangerFor(b, t) {
  if (!b || !b.bulletins) return null;
  const kw = t.g.toLowerCase();
  let hit = b.bulletins.filter(x => (x.regions || []).some(r => (r.name || '').toLowerCase().includes(kw)));
  if (!hit.length) hit = b.bulletins;
  let lv = 0;
  hit.forEach(x => (x.dangerRatings || []).forEach(d => {
    const lo = d.elevation && d.elevation.lowerBound ? Number(d.elevation.lowerBound) : -1, up = d.elevation && d.elevation.upperBound ? Number(d.elevation.upperBound) : 9999;
    if (t.top >= lo && t.start <= up) lv = Math.max(lv, LV[d.mainValue] || 0);
  }));
  return lv || null;
}
async function weather(t, sat) {
  const sun = new Date(sat); sun.setUTCDate(sun.getUTCDate() + 1);
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${t.lat}&longitude=${t.lon}&elevation=${t.start}&daily=weather_code,temperature_2m_max,precipitation_sum,wind_speed_10m_max&hourly=snow_depth&timezone=Europe%2FVienna&start_date=${iso(sat)}&end_date=${iso(sun)}`;
  const r = await fetch(u); if (!r.ok) return null; const j = await r.json(), d = j.daily || {}, h = j.hourly || {};
  return (d.time || []).map((day, i) => {
    const k = (h.time || []).indexOf(day + 'T12:00');
    return { day, code: d.weather_code[i], tmax: d.temperature_2m_max[i], pr: d.precipitation_sum[i], wind: d.wind_speed_10m_max[i], snow: k >= 0 ? h.snow_depth[k] : null };
  });
}
export async function skiCheck(now = Date.now()) {
  const sat = nextSat(now), today = iso(new Date(now));
  const b = await bulletin(iso(sat)).catch(() => null) || await bulletin(today).catch(() => null);
  const res = [];
  for (const t of TOUREN) {
    const lv = dangerFor(b, t), w = await weather(t, sat).catch(() => null);
    (w || []).forEach(x => {
      const snowOk = x.snow != null && x.snow >= 0.2, dryOk = x.pr < 2 && x.code < 61, windOk = x.wind < 50, avOk = lv == null ? t.max >= 4 : lv <= t.max;
      let sc = (snowOk ? 40 : -100) + (avOk ? 30 : -100) + (dryOk ? 20 : 0) + (windOk ? 5 : -10) + (x.code <= 2 ? 10 : 0) + Math.min(10, t.hm / 120);
      res.push({ tour: t.n, top: t.top, hm: t.hm, art: t.art, day: x.day, wetter: WMO[x.code] || '', tmax: Math.round(x.tmax), schnee_cm: x.snow == null ? null : Math.round(x.snow * 100), wind: Math.round(x.wind), stufe: lv, stufe_text: lv ? LN[lv] : 'kein Lagebericht', ok: snowOk && avOk && windOk, score: Math.round(sc) });
    });
  }
  res.sort((a, b) => b.score - a.score);
  const ok = res.filter(r => r.ok);
  return { erstellt: new Date(now).toISOString(), lagebericht: !!b, wochenende: iso(sat), vorschlaege: ok.slice(0, 5), alle: res.slice(0, 12) };
}
export function skiText(r) {
  const tage = { 6: 'Sa', 0: 'So' }, dn = d => tage[new Date(d + 'T12:00:00Z').getUTCDay()] || d;
  if (!r.vorschlaege.length) {
    const s = r.alle[0];
    return { title: 'Skitouren am Wochenende: eher nicht', body: s ? `Zu wenig Schnee oder zu hohe Lawinengefahr${r.lagebericht ? '' : ' (noch kein Lagebericht)'}. Alternative: lange Einheit Rennrad, Wanderung oder Zwift.` : 'Keine Daten verfügbar.' };
  }
  const v = r.vorschlaege[0];
  return { title: `Skitour ${dn(v.day)}: ${v.tour}`, body: `${v.wetter}, ${v.tmax}°, Lawinengefahr ${v.stufe_text}, ${v.schnee_cm} cm Schnee am Start, ${v.hm} Hm. Details in WattsUp.` };
}
