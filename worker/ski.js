// Skitour-Vorschlag fürs Wochenende: Lawinenlage (Lawinenwarndienst Salzburg) und Wetter (Open-Meteo).
// Die Liste enthält bekannte Touren im Raum Salzburg; Verhältnisse vor Ort immer selbst prüfen.
export const TOUREN = [
  // Flachgau, Tennengau, Osterhorngruppe
  { n: 'Gaisberg', g: 'Osterhorn', top: 1287, start: 700, hm: 600, lat: 47.805, lon: 13.110, max: 4, art: 'Pistentour, auch bei wenig Schnee' },
  { n: 'Zwölferhorn', g: 'Osterhorn', top: 1522, start: 560, hm: 950, lat: 47.743, lon: 13.355, max: 4, art: 'Pistentour' },
  { n: 'Schmittenstein', g: 'Osterhorn', top: 1695, start: 900, hm: 800, lat: 47.690, lon: 13.230, max: 3, art: 'einfach, Wald und Almgelände' },
  { n: 'Trattberg', g: 'Osterhorn', top: 1757, start: 1000, hm: 750, lat: 47.640, lon: 13.280, max: 3, art: 'Klassiker, mäßig steil' },
  { n: 'Postalm, Pitscherberg', g: 'Osterhorn', top: 1745, start: 1270, hm: 500, lat: 47.620, lon: 13.400, max: 3, art: 'kurz und einfach, viele Varianten' },
  // Lammertal, Dachstein West
  { n: 'Gerzkopf', g: 'Dachstein', top: 1728, start: 900, hm: 830, lat: 47.520, lon: 13.380, max: 3, art: 'einfache Almtour' },
  // Hochkönig
  { n: 'Hochkeil', g: 'Hochkönig', top: 1782, start: 1100, hm: 680, lat: 47.390, lon: 13.110, max: 3, art: 'einfach, viel begangen' },
  { n: 'Hochkönig', g: 'Hochkönig', top: 2941, start: 1500, hm: 1450, lat: 47.420, lon: 13.060, max: 2, art: 'hochalpin, lang, nur bei stabilen Verhältnissen' },
  // Pinzgau, Kitzbüheler Alpen
  { n: 'Schwalbenwand', g: 'Kitzbühel', top: 2011, start: 1050, hm: 960, lat: 47.400, lon: 12.860, max: 3, art: 'sanfte Grasbergtour' },
  { n: 'Hundstein', g: 'Kitzbühel', top: 2117, start: 1000, hm: 1100, lat: 47.360, lon: 12.920, max: 2, art: 'lange Grasbergtour' },
  { n: 'Gaisstein', g: 'Kitzbühel', top: 2363, start: 1300, hm: 1060, lat: 47.330, lon: 12.530, max: 2, art: 'Klassiker im Oberpinzgau' },
  { n: 'Schmittenhöhe', g: 'Kitzbühel', top: 1965, start: 760, hm: 1200, lat: 47.330, lon: 12.740, max: 4, art: 'Pistentour, viele Höhenmeter' },
  // Gastein, Großarl
  { n: 'Draugstein', g: 'Großarl', top: 2356, start: 1050, hm: 1300, lat: 47.240, lon: 13.300, max: 2, art: 'Klassiker im Großarltal' },
  { n: 'Gamskarkogel', g: 'Gastein', top: 2467, start: 1100, hm: 1360, lat: 47.140, lon: 13.110, max: 2, art: 'lang, viele Höhenmeter' },
  { n: 'Graukogel', g: 'Gastein', top: 2492, start: 1250, hm: 1240, lat: 47.110, lon: 13.150, max: 2, art: 'Gasteiner Klassiker' },
  { n: 'Stubnerkogel', g: 'Gastein', top: 2246, start: 1100, hm: 1150, lat: 47.110, lon: 13.100, max: 4, art: 'Pistentour' },
  // Radstädter Tauern, Obertauern
  { n: 'Seekarspitze', g: 'Radstädter', top: 2350, start: 1740, hm: 610, lat: 47.250, lon: 13.540, max: 2, art: 'kurz, hochalpin, schneesicher' },
  { n: 'Gamsleitenspitze', g: 'Radstädter', top: 2359, start: 1740, hm: 620, lat: 47.240, lon: 13.560, max: 2, art: 'kurz, schneesicher' },
  { n: 'Hochfeind', g: 'Radstädter', top: 2687, start: 1200, hm: 1490, lat: 47.270, lon: 13.480, max: 2, art: 'lang und anspruchsvoll' },
  // Lungau
  { n: 'Speiereck', g: 'Lungau', top: 2411, start: 1100, hm: 1300, lat: 47.150, lon: 13.700, max: 2, art: 'sonnig, oft gute Verhältnisse' },
  { n: 'Preber', g: 'Lungau', top: 2740, start: 1500, hm: 1240, lat: 47.210, lon: 13.860, max: 2, art: 'Lungauer Paradetour' },
  { n: 'Aineck', g: 'Lungau', top: 2210, start: 1640, hm: 570, lat: 47.060, lon: 13.620, max: 4, art: 'Pistentour am Katschberg' }
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
      let sc = (snowOk ? 40 : -100) + (avOk ? 30 : -100) + (dryOk ? 20 : 0) + (windOk ? 5 : -10) + (x.code <= 2 ? 10 : 0) + (lv ? (t.max - lv) * 6 : 0) + (t.hm >= 800 && t.hm <= 1300 ? 10 : Math.max(0, 10 - Math.abs(t.hm - 1050) / 80));
      res.push({ tour: t.n, top: t.top, hm: t.hm, art: t.art, day: x.day, wetter: WMO[x.code] || '', tmax: Math.round(x.tmax), schnee_cm: x.snow == null ? null : Math.round(x.snow * 100), wind: Math.round(x.wind), stufe: lv, stufe_text: lv ? LN[lv] : 'kein Lagebericht', ok: snowOk && avOk && windOk, score: Math.round(sc) });
    });
  }
  res.sort((a, b) => b.score - a.score);
  const seen = {}, ok = res.filter(r => r.ok && !seen[r.tour] && (seen[r.tour] = 1));
  return { erstellt: new Date(now).toISOString(), lagebericht: !!b, wochenende: iso(sat), vorschlaege: ok.slice(0, 8), alle: res.slice(0, 20), touren: TOUREN.length };
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
