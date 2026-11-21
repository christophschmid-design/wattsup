package at.christophschmid.wattsup;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.RemoteMessage;
import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService;
import java.util.Map;
import org.json.JSONObject;

/**
 * Wie der Dienst des Firebase-Plugins, zusätzlich: Meldet der Server eine neue Strava-Aktivität
 * (stille Datennachricht), merkt sich das Widget sie und fragt sofort nach der gefühlten Belastung,
 * auch wenn die App geschlossen ist.
 */
public class WattsUpMessagingService extends MessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage msg) {
        super.onMessageReceived(msg);
        try {
            Map<String, String> d = msg.getData();
            if (d != null && "wact".equals(d.get("k")) && d.get("id") != null) {
                JSONObject o = new JSONObject();
                o.put("id", d.get("id"));
                o.put("day", WattsUpWidget.today());
                o.put("ts", System.currentTimeMillis());
                getSharedPreferences(WattsUpWidget.STORE, MODE_PRIVATE).edit().putString("wu_widget_act", o.toString()).apply();
                WattsUpWidget.refresh(this);
            }
        } catch (Exception e) { /* Widget bleibt wie es ist */ }
    }
}
