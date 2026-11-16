/* Nur in der Claude-Version: Daten für die eigenständige WattsUp-App exportieren */
(function () {
  var KEYS = ['tss2', 'log1', 'plans1', 'cz1', 'cfg1', 'mood1', 'wt1', 'fu1', 'zdis', 'act2', 'ichint', 'st_cal'];
  async function run(el) {
    var sp = el && el.querySelector('span'), say = function (t) { if (sp) sp.textContent = t; };
    try {
      say('Wird zusammengestellt …');
      var o = { app: 'wattsup', v: 1, ts: Date.now(), ls: {}, db: {} };
      KEYS.forEach(function (k) { try { var v = localStorage.getItem(k); if (v != null) o.ls[k] = v; } catch (e) { } });
      var u = await window.claude.use('user'), d = await window.claude.use('db');
      if (u && d) {
        var id = await u.id(), sn = await d.collection('data/users/' + id).get();
        sn.docs.forEach(function (q) { o.db[q.id] = q.data(); });
      }
      var dl = await window.claude.use('downloads');
      if (!dl) { say('Speichern ist in dieser Ansicht nicht möglich.'); return; }
      var name = 'wattsup-daten-' + new Date().toISOString().slice(0, 10), txt = JSON.stringify(o);
      try { await dl.save({ filename: name + '.json', data: txt }); }
      catch (e) { await dl.save({ filename: name + '.txt', data: txt }); }
      say('Gespeichert: ' + Object.keys(o.db).length + ' Einträge. In der neuen App unter Verbindungen und Kosten importieren.');
    } catch (e) { say('Export fehlgeschlagen: ' + (e && e.message || e)); }
  }
  window.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-k="wux"]');
    if (!t) return; e.preventDefault(); e.stopImmediatePropagation(); run(t);
  }, true);
})();
