package at.christophschmid.wattsup;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Heute-Widget (4×1 und 4×2): morgens das Morgengefühl in drei Schritten, nach der Einheit die
 * gefühlte Belastung (1 bis 10), sonst Tagesampel, heutige Einheit und Coach-Zeile.
 * Eingaben landen in „wu_widget_in“ und werden von der App beim nächsten Öffnen übernommen.
 */
public class WattsUpWidget extends AppWidgetProvider {
    static final String TAP = "at.christophschmid.wattsup.WIDGET_TAP";
    static final String STORE = "CapacitorStorage";
    static final String LOCAL = "wu_widget_local";
    static final int[] BTN = {R.id.wb1, R.id.wb2, R.id.wb3, R.id.wb4, R.id.wb5, R.id.wb6, R.id.wb7, R.id.wb8, R.id.wb9, R.id.wb10};
    static final String[] MOOD_G = {"😫", "😕", "😐", "🙂", "💪"};

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) draw(c, m, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) {
        draw(c, m, id);
    }

    @Override
    public void onReceive(Context c, Intent i) {
        if (TAP.equals(i.getAction())) {
            try { tap(c, i.getStringExtra("q"), i.getStringExtra("k"), i.getStringExtra("n"), i.getIntExtra("v", 0)); } catch (Exception e) { /* nichts */ }
            refresh(c);
            return;
        }
        super.onReceive(c, i);
    }

    static String today() { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()); }

    static String sg(int x) { return x > 0 ? "+" + x : String.valueOf(x); }

    static JSONObject read(Context c, String prefs, String key) {
        try {
            String s = c.getSharedPreferences(prefs, Context.MODE_PRIVATE).getString(key, null);
            return s == null ? new JSONObject() : new JSONObject(s);
        } catch (Exception e) { return new JSONObject(); }
    }

    static void write(Context c, String prefs, String key, JSONObject o) {
        c.getSharedPreferences(prefs, Context.MODE_PRIVATE).edit().putString(key, o.toString()).apply();
    }

    /** Lokaler Widget-Stand: heutiges Morgengefühl (auch halb ausgefüllt) und beantwortete Belastungen. */
    static JSONObject local(Context c) {
        JSONObject l = read(c, LOCAL, "s");
        try {
            if (!today().equals(l.optString("day"))) {
                JSONObject r = l.optJSONObject("rpe");
                l = new JSONObject();
                l.put("day", today());
                l.put("rpe", r == null ? new JSONObject() : r);
            }
            if (l.optJSONObject("rpe") == null) l.put("rpe", new JSONObject());
        } catch (Exception e) { /* nichts */ }
        return l;
    }

    static void tap(Context c, String q, String k, String n, int v) throws Exception {
        JSONObject l = local(c);
        JSONObject out = read(c, STORE, "wu_widget_in");
        if ("g".equals(q) || "s".equals(q) || "b".equals(q)) {
            l.put(q, v);
            if (l.has("g") && l.has("s") && l.has("b")) {
                JSONObject md = new JSONObject();
                md.put("day", today()); md.put("g", l.getInt("g")); md.put("s", l.getInt("s")); md.put("b", l.getInt("b"));
                md.put("ts", System.currentTimeMillis());
                out.put("mood", md);
                write(c, STORE, "wu_widget_in", out);
            }
        } else if ("r".equals(q) || "x".equals(q)) {
            l.getJSONObject("rpe").put(k, "x".equals(q) ? 0 : v);
            if ("r".equals(q)) {
                JSONArray a = out.optJSONArray("rpe");
                if (a == null) a = new JSONArray();
                JSONObject r = new JSONObject();
                r.put("k", k); r.put("v", v); r.put("n", n == null ? "" : n); r.put("day", today()); r.put("ts", System.currentTimeMillis());
                a.put(r);
                out.put("rpe", a);
                write(c, STORE, "wu_widget_in", out);
            }
        }
        // Alte Antworten nach drei Tagen vergessen
        JSONObject rp = l.getJSONObject("rpe");
        if (rp.length() > 30) l.put("rpe", new JSONObject());
        write(c, LOCAL, "s", l);
    }

    static PendingIntent btn(Context c, int req, String q, String k, String n, int v) {
        Intent i = new Intent(c, WattsUpWidget.class);
        i.setAction(TAP);
        i.putExtra("q", q); i.putExtra("k", k); i.putExtra("n", n); i.putExtra("v", v);
        return PendingIntent.getBroadcast(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent open(Context c, int req, String k) {
        Intent i = new Intent(c, MainActivity.class);
        if (k != null) { i.setAction(Intent.ACTION_VIEW); i.setData(Uri.parse("wattsup://go?k=" + k)); }
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static boolean small(AppWidgetManager m, int id) {
        try {
            Bundle o = m.getAppWidgetOptions(id);
            int h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
            if (h == 0) h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110);
            return h < 100;
        } catch (Exception e) { return false; }
    }

    static int lvColor(int lv) { return lv == 0 ? 0xFF3DDC97 : lv == 1 ? 0xFFFFB547 : lv == 2 ? 0xFFFF6B57 : 0xFF8899AA; }

    static void draw(Context c, AppWidgetManager m, int id) {
        boolean sm = small(m, id);
        RemoteViews v = new RemoteViews(c.getPackageName(), sm ? R.layout.wattsup_widget_s : R.layout.wattsup_widget);
        String t = today();
        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        long now = System.currentTimeMillis();
        JSONObject j = read(c, STORE, "wu_widget"), l = local(c);
        boolean fresh = t.equals(j.optString("day"));
        v.setOnClickPendingIntent(R.id.wu_root, open(c, 900, null));
        v.setOnClickPendingIntent(R.id.wu_coachbtn, open(c, 901, "coach"));

        // 1. Morgengefühl
        String step = null;
        boolean moodLocal = l.has("g") && l.has("s") && l.has("b");
        boolean moodApp = fresh ? !j.optBoolean("moodNeed", true) : false;
        if (j.optBoolean("moodOn", true) && !moodApp && !moodLocal && hour >= j.optInt("mFrom", 5) && hour < j.optInt("mUntil", 12)) {
            step = !l.has("g") ? "g" : !l.has("s") ? "s" : "b";
        }
        // 2. Gefühlte Belastung
        JSONObject rq = null;
        if (step == null) {
            JSONArray q = j.optJSONArray("rpeQ");
            JSONObject done = l.optJSONObject("rpe");
            String y = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(now - 86400000L));
            if (q != null) for (int i = 0; i < q.length() && rq == null; i++) {
                JSONObject x = q.optJSONObject(i);
                if (x == null) continue;
                String d = x.optString("day");
                if (!(t.equals(d) || y.equals(d))) continue;
                if (x.optString("k").startsWith("p:") && !t.equals(d)) continue;
                if (x.optLong("at", 0) > now) continue;
                if (done != null && done.has(x.optString("k"))) continue;
                rq = x;
            }
        }

        // Neue Aktivität per Push gemeldet, App noch nicht geöffnet: sofort nach der Belastung fragen
        if (step == null && rq == null) {
            try {
                JSONObject ac = read(c, STORE, "wu_widget_act"), done = l.optJSONObject("rpe");
                String aid = ac.optString("id", "");
                boolean appKnows = j.optLong("ts", 0) > ac.optLong("ts", 0);
                JSONArray q = j.optJSONArray("rpeQ");
                boolean inQ = false;
                if (q != null) for (int i = 0; i < q.length(); i++) { JSONObject x = q.optJSONObject(i); if (x != null && aid.equals(x.optString("k"))) inQ = true; }
                if (aid.length() > 0 && t.equals(ac.optString("day")) && (done == null || (!done.has(aid) && !done.has("p:" + t))) && (!appKnows || inQ)) {
                    rq = new JSONObject();
                    String n = fresh ? j.optString("today", "") : "";
                    rq.put("k", aid); rq.put("n", n.length() > 0 ? n.replaceAll("^\\uD83D\\uDD11\\s*", "") : "deine Einheit"); rq.put("day", t); rq.put("at", 0);
                }
            } catch (Exception e) { /* nichts */ }
        }
        if (step != null || rq != null) {
            v.setViewVisibility(R.id.wu_info, View.GONE);
            v.setViewVisibility(R.id.wu_ask, View.VISIBLE);
            String qt, qs, qq, k = "", n = "";
            int cnt;
            if (step != null) {
                qq = step; cnt = 5;
                if ("g".equals(step)) { qt = "Wie geht's dir?"; qs = "1/3 · dann Schlaf und Beine"; }
                else if ("s".equals(step)) { qt = "Wie geschlafen?"; qs = "2/3 · 1 sehr schlecht bis 5 sehr gut"; }
                else { qt = "Beine?"; qs = "3/3 · 1 schwer bis 5 frisch"; }
                v.setViewVisibility(R.id.wu_skip, View.GONE);
            } else {
                qq = "r"; cnt = 10; k = rq.optString("k"); n = rq.optString("n");
                qt = "Wie hart war " + n + "?";
                qs = (t.equals(rq.optString("day")) ? "" : "Gestern · ") + "1 sehr leicht bis 10 maximal";
                v.setViewVisibility(R.id.wu_skip, k.startsWith("p:") ? View.VISIBLE : View.GONE);
                v.setOnClickPendingIntent(R.id.wu_skip, btn(c, 950, "x", k, n, 0));
            }
            if (sm) {
                if ("g".equals(qq)) qt = "Wie geht's dir? · 1/3";
                else if ("s".equals(qq)) qt = "Schlaf? 1 sehr schlecht · 5 sehr gut · 2/3";
                else if ("b".equals(qq)) qt = "Beine? 1 schwer · 5 frisch · 3/3";
                else qt = n + ": wie hart? 1 leicht · 10 maximal";
            }
            v.setTextViewText(R.id.wu_q, qt);
            v.setTextViewText(R.id.wu_qs, qs);
            for (int i = 0; i < BTN.length; i++) {
                if (i < cnt) {
                    v.setViewVisibility(BTN[i], View.VISIBLE);
                    v.setTextViewText(BTN[i], "g".equals(qq) ? MOOD_G[i] : String.valueOf(i + 1));
                    v.setOnClickPendingIntent(BTN[i], btn(c, 1000 + i, qq, k, n, i + 1));
                } else v.setViewVisibility(BTN[i], View.GONE);
            }
            m.updateAppWidget(id, v);
            return;
        }

        // 3. Ampel, Einheit, Coach
        v.setViewVisibility(R.id.wu_info, View.VISIBLE);
        v.setViewVisibility(R.id.wu_ask, View.GONE);
        String amp = "Tagesampel", title = "WattsUp öffnen", sub = "", coach = "";
        int lv = -1;
        try {
            if (fresh) {
                lv = j.optInt("lv", -1);
                if (moodLocal && j.optBoolean("moodNeed", false)) {
                    String a = j.optString("a125", "");
                    int ix = (l.getInt("g") - 1) * 25 + (l.getInt("s") - 1) * 5 + (l.getInt("b") - 1);
                    if (a.length() == 125) lv = a.charAt(ix) - '0';
                }
                JSONArray al = j.optJSONArray("ampL");
                amp = lv >= 0 && al != null && lv < al.length() ? al.getString(lv) : j.optString("amp", "Tagesampel");
                String td = j.optString("today", ""), dn = j.optString("done", ""), tm = j.optString("tomorrow", ""), tt = j.optString("time", "");
                JSONObject rp = l.optJSONObject("rpe");
                int myRpe = rp != null ? rp.optInt("p:" + t, -1) : -1;
                if (dn.length() > 0) title = "✓ " + dn;
                else if (myRpe > 0) title = "✓ " + td + " · RPE " + myRpe;
                else if (td.length() > 0) title = (tt.length() > 0 ? tt + " · " : "") + td;
                else title = "Heute frei";
                StringBuilder b = new StringBuilder();
                if (!j.isNull("form")) b.append("Form ").append(sg(j.optInt("form")));
                if (!j.isNull("fit") && !sm) b.append(b.length() > 0 ? " · " : "").append("Fitness ").append(j.optInt("fit"));
                b.append(b.length() > 0 ? " · " : "").append("Morgen: ").append(tm.length() > 0 ? tm : "frei");
                sub = b.toString();
                String cq = j.optString("coach", "");
                if (cq.length() > 0) coach = "„" + cq + "“";
                if (sm && j.optBoolean("coachNew", false) && coach.length() > 0) sub = coach;
            } else if (j.length() > 0) {
                String y = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(now - 86400000L));
                if (y.equals(j.optString("day"))) {
                    // App seit gestern nicht offen: Plan von gestern für heute, Ampel erst nach dem Öffnen
                    String tm = j.optString("tomorrow", ""), tt = j.optString("timeT", "");
                    title = tm.length() > 0 ? (tt.length() > 0 ? tt + " · " : "") + tm : "Heute frei";
                    amp = "Ampel nach dem Öffnen";
                    sub = moodLocal ? "Morgengefühl gespeichert, kommt beim Öffnen in die App" : "";
                } else title = "Für heute WattsUp öffnen";
            }
        } catch (Exception e) { /* Grundzustand */ }
        v.setTextViewText(R.id.wu_amp, amp + "  " + new SimpleDateFormat("EE d.M.", Locale.GERMAN).format(new Date()));
        v.setTextViewText(R.id.wu_today, title);
        v.setTextViewText(R.id.wu_sub, sub);
        v.setTextViewText(R.id.wu_coach, coach);
        v.setInt(R.id.wu_dot, "setColorFilter", lvColor(lv));
        m.updateAppWidget(id, v);
    }

    public static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WattsUpWidget.class));
        for (int id : ids) draw(c, m, id);
        WattsUpWeekWidget.refresh(c);
    }
}
