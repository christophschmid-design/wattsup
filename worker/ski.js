// Skitour-Vorschlag fürs Wochenende: Lawinenlage (Lawinenwarndienst Salzburg) und Wetter (Open-Meteo).
// Die Liste enthält bekannte Touren im Raum Salzburg; Verhältnisse vor Ort immer selbst prüfen.
export const TOUREN = [
  // Flachgau, Tennengau, Osterhorngruppe
  { r: 'AT-05', n: 'Gaisberg', g: 'Osterhorn', top: 1287, start: 700, hm: 600, lat: 47.805, lon: 13.110, max: 4, art: 'Pistentour, auch bei wenig Schnee' },
  { r: 'AT-05', n: 'Zwölferhorn', g: 'Osterhorn', top: 1522, start: 560, hm: 950, lat: 47.743, lon: 13.355, max: 4, art: 'Pistentour' },
  { r: 'AT-05', n: 'Schmittenstein', g: 'Osterhorn', top: 1695, start: 900, hm: 800, lat: 47.690, lon: 13.230, max: 3, art: 'einfach, Wald und Almgelände' },
  { r: 'AT-05', n: 'Trattberg', g: 'Osterhorn', top: 1757, start: 1000, hm: 750, lat: 47.640, lon: 13.280, max: 3, art: 'Klassiker, mäßig steil' },
  { r: 'AT-05', n: 'Postalm, Pitscherberg', g: 'Osterhorn', top: 1745, start: 1270, hm: 500, lat: 47.620, lon: 13.400, max: 3, art: 'kurz und einfach, viele Varianten' },
  // Lammertal, Dachstein West
  { r: 'AT-05', n: 'Gerzkopf', g: 'Dachstein', top: 1728, start: 900, hm: 830, lat: 47.520, lon: 13.380, max: 3, art: 'einfache Almtour' },
  // Hochkönig
  { r: 'AT-05', n: 'Hochkeil', g: 'Hochkönig', top: 1782, start: 1100, hm: 680, lat: 47.390, lon: 13.110, max: 3, art: 'einfach, viel begangen' },
  { r: 'AT-05', n: 'Hochkönig', g: 'Hochkönig', top: 2941, start: 1500, hm: 1450, lat: 47.420, lon: 13.060, max: 2, art: 'hochalpin, lang, nur bei stabilen Verhältnissen' },
  // Pinzgau, Kitzbüheler Alpen
  { r: 'AT-05', n: 'Schwalbenwand', g: 'Kitzbühel', top: 2011, start: 1050, hm: 960, lat: 47.400, lon: 12.860, max: 3, art: 'sanfte Grasbergtour' },
  { r: 'AT-05', n: 'Hundstein', g: 'Kitzbühel', top: 2117, start: 1000, hm: 1100, lat: 47.360, lon: 12.920, max: 2, art: 'lange Grasbergtour' },
  { r: 'AT-05', n: 'Gaisstein', g: 'Kitzbühel', top: 2363, start: 1300, hm: 1060, lat: 47.330, lon: 12.530, max: 2, art: 'Klassiker im Oberpinzgau' },
  { r: 'AT-05', n: 'Schmittenhöhe', g: 'Kitzbühel', top: 1965, start: 760, hm: 1200, lat: 47.330, lon: 12.740, max: 4, art: 'Pistentour, viele Höhenmeter' },
  // Gastein, Großarl
  { r: 'AT-05', n: 'Draugstein', g: 'Großarl', top: 2356, start: 1050, hm: 1300, lat: 47.240, lon: 13.300, max: 2, art: 'Klassiker im Großarltal' },
  { r: 'AT-05', n: 'Gamskarkogel', g: 'Gastein', top: 2467, start: 1100, hm: 1360, lat: 47.140, lon: 13.110, max: 2, art: 'lang, viele Höhenmeter' },
  { r: 'AT-05', n: 'Graukogel', g: 'Gastein', top: 2492, start: 1250, hm: 1240, lat: 47.110, lon: 13.150, max: 2, art: 'Gasteiner Klassiker' },
  { r: 'AT-05', n: 'Stubnerkogel', g: 'Gastein', top: 2246, start: 1100, hm: 1150, lat: 47.110, lon: 13.100, max: 4, art: 'Pistentour' },
  // Radstädter Tauern, Obertauern
  { r: 'AT-05', n: 'Seekarspitze', g: 'Radstädter', top: 2350, start: 1740, hm: 610, lat: 47.250, lon: 13.540, max: 2, art: 'kurz, hochalpin, schneesicher' },
  { r: 'AT-05', n: 'Gamsleitenspitze', g: 'Radstädter', top: 2359, start: 1740, hm: 620, lat: 47.240, lon: 13.560, max: 2, art: 'kurz, schneesicher' },
  { r: 'AT-05', n: 'Hochfeind', g: 'Radstädter', top: 2687, start: 1200, hm: 1490, lat: 47.270, lon: 13.480, max: 2, art: 'lang und anspruchsvoll' },
  // Lungau
  { r: 'AT-05', n: 'Speiereck', g: 'Lungau', top: 2411, start: 1100, hm: 1300, lat: 47.150, lon: 13.700, max: 2, art: 'sonnig, oft gute Verhältnisse' },
  { r: 'AT-05', n: 'Preber', g: 'Lungau', top: 2740, start: 1500, hm: 1240, lat: 47.210, lon: 13.860, max: 2, art: 'Lungauer Paradetour' },
  { r: 'AT-05', n: 'Aineck', g: 'Lungau', top: 2210, start: 1640, hm: 570, lat: 47.060, lon: 13.620, max: 4, art: 'Pistentour am Katschberg' },
  // Bayern (Berchtesgaden, Chiemgau, Mangfallgebirge)
  { r: 'DE-BY', n: 'Jenner', g: 'Berchtesgaden', top: 1874, start: 630, hm: 1250, lat: 47.577, lon: 13.023, max: 4, art: 'Pistentour am Königssee' },
  { r: 'DE-BY', n: 'Schneibstein', g: 'Berchtesgaden', top: 2276, start: 1100, hm: 1200, lat: 47.565, lon: 13.070, max: 2, art: 'Klassiker über dem Königssee' },
  { r: 'DE-BY', n: 'Hochgern', g: 'Chiemgau', top: 1748, start: 640, hm: 1100, lat: 47.730, lon: 12.550, max: 3, art: 'Chiemgauer Klassiker' },
  { r: 'DE-BY', n: 'Rotwand', g: 'Mangfall', top: 1884, start: 1100, hm: 800, lat: 47.650, lon: 11.930, max: 3, art: 'beliebt am Spitzingsee' },
  { r: 'DE-BY', n: 'Hirschberg', g: 'Mangfall', top: 1670, start: 800, hm: 870, lat: 47.660, lon: 11.730, max: 3, art: 'einfach, über dem Tegernsee' },
  // Tirol
  { r: 'AT-07', n: 'Hohe Salve', g: 'Kitzbühel', top: 1829, start: 620, hm: 1200, lat: 47.470, lon: 12.130, max: 4, art: 'Pistentour' },
  { r: 'AT-07', n: 'Schafsiedel', g: 'Kitzbühel', top: 2447, start: 1300, hm: 1100, lat: 47.310, lon: 12.030, max: 2, art: 'Kelchsauer Klassiker' },
  { r: 'AT-07', n: 'Kellerjoch', g: 'Tux', top: 2344, start: 1260, hm: 1100, lat: 47.300, lon: 11.750, max: 2, art: 'über dem Inntal' },
  { r: 'AT-07', n: 'Gilfert', g: 'Tux', top: 2506, start: 1470, hm: 1050, lat: 47.270, lon: 11.790, max: 2, art: 'Tuxer Klassiker' },
  { r: 'AT-07', n: 'Glungezer', g: 'Tux', top: 2677, start: 1400, hm: 1250, lat: 47.210, lon: 11.530, max: 2, art: 'Innsbrucker Hausberg' },
  { r: 'AT-07', n: 'Pirchkogel', g: 'Stubai', top: 2828, start: 2020, hm: 800, lat: 47.210, lon: 11.030, max: 2, art: 'Kühtai, schneesicher' },
  // Steiermark
  { r: 'AT-06', n: 'Planai', g: 'Schladming', top: 1906, start: 750, hm: 1150, lat: 47.390, lon: 13.700, max: 4, art: 'Pistentour' },
  { r: 'AT-06', n: 'Karlspitze', g: 'Wölzer', top: 2097, start: 1600, hm: 500, lat: 47.400, lon: 14.190, max: 3, art: 'Planneralm, einfach' },
  { r: 'AT-06', n: 'Gumpeneck', g: 'Wölzer', top: 2226, start: 1000, hm: 1200, lat: 47.380, lon: 14.030, max: 2, art: 'Sölktäler Klassiker' },
  { r: 'AT-06', n: 'Großer Bösenstein', g: 'Rottenmanner', top: 2448, start: 1270, hm: 1180, lat: 47.430, lon: 14.480, max: 2, art: 'Hohentauern, aussichtsreich' }
];
const LV = { low: 1, moderate: 2, considerable: 3, high: 4, very_high: 5 };
const LN = ['', 'gering (1)', 'mäßig (2)', 'erheblich (3)', 'groß (4)', 'sehr groß (5)'];
const WMO = { 0: 'sonnig', 1: 'überwiegend sonnig', 2: 'teils bewölkt', 3: 'bewölkt', 45: 'Nebel', 48: 'Nebel', 51: 'Niesel', 53: 'Niesel', 55: 'Niesel', 61: 'Regen', 63: 'Regen', 65: 'starker Regen', 71: 'Schneefall', 73: 'Schneefall', 75: 'starker Schneefall', 77: 'Schneegriesel', 80: 'Schauer', 81: 'Schauer', 82: 'starke Schauer', 85: 'Schneeschauer', 86: 'Schneeschauer', 95: 'Gewitter', 96: 'Gewitter', 99: 'Gewitter' };

function iso(d) { return d.toISOString().slice(0, 10); }
function nextSat(now) { const d = new Date(now); d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7)); return d; }

async function bulletin(day, reg) {
  const r = await fetch(`https://static.avalanche.report/eaws_bulletins/${day}/${day}-${reg}.json`);
  if (!r.ok) return null;
  return r.json();
}
export const REGIONEN = { 'AT-05': 'Salzburg', 'DE-BY': 'Bayern', 'AT-07': 'Tirol', 'AT-06': 'Steiermark' };
const GURU = 'https://www.skitourenguru.ch/';
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
  const B = {};
  for (const reg of Object.keys(REGIONEN)) B[reg] = await bulletin(iso(sat), reg).catch(() => null) || await bulletin(today, reg).catch(() => null);
  const res = [];
  for (const t of TOUREN) {
    const b = B[t.r], lv = dangerFor(b, t), w = await weather(t, sat).catch(() => null);
    (w || []).forEach(x => {
      const snowOk = x.snow != null && x.snow >= 0.2, dryOk = x.pr < 2 && x.code < 61, windOk = x.wind < 50, avOk = lv == null ? t.max >= 4 : lv <= t.max;
      let sc = (snowOk ? 40 : -100) + (avOk ? 30 : -100) + (dryOk ? 20 : 0) + (windOk ? 5 : -10) + (x.code <= 2 ? 10 : 0) + (lv ? (t.max - lv) * 6 : 0) + (t.hm >= 800 && t.hm <= 1300 ? 10 : Math.max(0, 10 - Math.abs(t.hm - 1050) / 80)) - (t.max >= 4 ? 12 : 0);
      const grund = [!snowOk ? 'zu wenig Schnee' : '', !avOk ? 'Lawinengefahr zu hoch für diese Tour' : '', !windOk ? 'starker Wind' : '', !dryOk ? 'Niederschlag' : ''].filter(Boolean).join(', ');
      res.push({ tour: t.n, region: REGIONEN[t.r], guru: GURU, top: t.top, hm: t.hm, art: t.art, day: x.day, wetter: WMO[x.code] || '', tmax: Math.round(x.tmax), schnee_cm: x.snow == null ? null : Math.round(x.snow * 100), wind: Math.round(x.wind), stufe: lv, stufe_text: lv ? LN[lv] : 'kein Lagebericht', ok: snowOk && avOk && windOk, grund, piste: t.max >= 4, score: Math.round(sc) });
    });
  }
  res.sort((a, b) => b.score - a.score);
  const seen = {}, ok = res.filter(r => r.ok && !seen[r.tour] && (seen[r.tour] = 1));
  return { erstellt: new Date(now).toISOString(), lagebericht: Object.values(B).some(Boolean), lageberichte: Object.keys(B).filter(k => B[k]).map(k => REGIONEN[k]), wochenende: iso(sat), vorschlaege: ok.slice(0, 8), alle: res, touren: TOUREN.length };
}
export function skiText(r) {
  const tage = { 6: 'Sa', 0: 'So' }, dn = d => tage[new Date(d + 'T12:00:00Z').getUTCDay()] || d;
  if (!r.vorschlaege.length) {
    const s = r.alle[0];
    return { title: 'Skitouren am Wochenende: eher nicht', body: s ? `Zu wenig Schnee oder zu hohe Lawinengefahr${r.lagebericht ? '' : ' (noch kein Lagebericht)'}. Alternative: lange Einheit Rennrad, Wanderung oder Zwift.` : 'Keine Daten verfügbar.' };
  }
  const v = r.vorschlaege[0];
  return { title: `Skitour ${dn(v.day)}: ${v.tour} (${v.region})`, body: `${v.wetter}, ${v.tmax}°, Lawinengefahr ${v.stufe_text}, ${v.schnee_cm} cm Schnee am Start, ${v.hm} Hm. Details in WattsUp.` };
}
