package at.christophschmid.wattsup;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** Wochen-Widget (4×2): Mo bis So mit erledigt, geplant und frei, dazu Wochenbelastung gegen Ziel. */
public class WattsUpWeekWidget extends AppWidgetProvider {
    static final int[] CELL = {R.id.wd1, R.id.wd2, R.id.wd3, R.id.wd4, R.id.wd5, R.id.wd6, R.id.wd7};
    static final int[] LAB = {R.id.wl1, R.id.wl2, R.id.wl3, R.id.wl4, R.id.wl5, R.id.wl6, R.id.wl7};
    static final int[] SYM = {R.id.ws1, R.id.ws2, R.id.ws3, R.id.ws4, R.id.ws5, R.id.ws6, R.id.ws7};
    static final String[] DN = {"Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"};

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) draw(c, m, id);
    }

    static void draw(Context c, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.wattsup_week);
        Intent i = new Intent(c, MainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse("wattsup://go?k=woche"));
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.ww_root, PendingIntent.getActivity(c, 920, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        String head = "Woche", tss = "", ph = "";
        int pct = 0;
        JSONArray d = null;
        String today = WattsUpWidget.today();
        try {
            JSONObject j = WattsUpWidget.read(c, WattsUpWidget.STORE, "wu_widget"), w = j.optJSONObject("wk");
            if (w != null) {
                head = "KW " + w.optInt("kw");
                ph = w.optString("ph", "");
                int dn = w.optInt("done"), zl = w.optInt("ziel");
                tss = dn + (zl > 0 ? " / " + zl : "") + " TSS";
                pct = zl > 0 ? Math.min(100, Math.round(dn * 100f / zl)) : 0;
                d = w.optJSONArray("d");
            }
        } catch (Exception e) { /* Grundzustand */ }
        v.setTextViewText(R.id.ww_kw, head);
        v.setTextViewText(R.id.ww_ph, ph);
        v.setTextViewText(R.id.ww_tss, tss);
        v.setProgressBar(R.id.ww_bar, 100, pct, false);
        for (int k = 0; k < 7; k++) {
            String lab = DN[k], sym = "–";
            int st = 2;
            boolean tdy = false;
            if (d != null && k < d.length()) {
                JSONObject x = d.optJSONObject(k);
                if (x != null) {
                    sym = x.optString("s", sym);
                    st = x.optInt("c", 2);
                    tdy = today.equals(x.optString("d"));
                }
            }
            v.setTextViewText(LAB[k], lab);
            v.setTextViewText(SYM[k], sym);
            v.setTextColor(SYM[k], st == 0 ? 0xFF3DDC97 : st == 3 ? 0xFFFF6B57 : st == 1 ? 0xFFFFFFFF : 0xFF8899AA);
            v.setInt(CELL[k], "setBackgroundResource", tdy ? R.drawable.wu_cell_today : st == 0 ? R.drawable.wu_cell_done : R.drawable.wu_cell);
        }
        m.updateAppWidget(id, v);
    }

    public static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WattsUpWeekWidget.class));
        for (int id : ids) draw(c, m, id);
    }
}
