package at.christophschmid.wattsup;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

/** Startbildschirm-Widget: Tagesampel, heutige Einheit und Coach-Spruch. */
public class WattsUpWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) draw(c, m, id);
    }

    static String sg(int x) { return x > 0 ? "+" + x : String.valueOf(x); }

    static void draw(Context c, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.wattsup_widget);
        String amp = "Tagesampel", today = "WattsUp öffnen", sub = "", coach = "";
        int col = 0xFF8899AA;
        try {
            SharedPreferences p = c.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String s = p.getString("wu_widget", null);
            if (s != null) {
                JSONObject j = new JSONObject(s);
                String now = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
                if (now.equals(j.optString("day"))) {
                    int lv = j.optInt("lv", -1);
                    amp = j.optString("amp", "Tagesampel");
                    col = lv == 0 ? 0xFF3DDC97 : lv == 1 ? 0xFFFFB547 : lv == 2 ? 0xFFFF6B57 : 0xFF8899AA;
                    String t = j.optString("today", ""), done = j.optString("done", ""), tm = j.optString("tomorrow", "");
                    String tt = j.optString("time", "");
                    today = done.length() > 0 ? "Erledigt: " + done : t.length() > 0 ? "Heute" + (tt.length() > 0 ? " " + tt : "") + ": " + t : "Heute frei";
                    String cq = j.optString("coach", "");
                    if (cq.length() > 0) coach = "\u201E" + cq + "\u201C";
                    StringBuilder b = new StringBuilder();
                    if (!j.isNull("form")) b.append("Form ").append(sg(j.optInt("form")));
                    if (!j.isNull("fit")) b.append(b.length() > 0 ? " · " : "").append("Fitness ").append(j.optInt("fit"));
                    if (tm.length() > 0) b.append(b.length() > 0 ? " · " : "").append("Morgen: ").append(tm);
                    sub = b.toString();
                } else {
                    today = "Für heute WattsUp öffnen";
                }
            }
        } catch (Exception e) { /* Widget bleibt im Grundzustand */ }
        v.setTextViewText(R.id.wu_amp, amp);
        v.setTextViewText(R.id.wu_today, today);
        v.setTextViewText(R.id.wu_sub, sub);
        v.setTextViewText(R.id.wu_coach, coach);
        v.setInt(R.id.wu_dot, "setColorFilter", col);
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.wu_root, pi);
        m.updateAppWidget(id, v);
    }

    public static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WattsUpWidget.class));
        for (int id : ids) draw(c, m, id);
    }
}
