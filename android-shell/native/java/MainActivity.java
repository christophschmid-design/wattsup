package at.christophschmid.wattsup;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WattsUpNative.class);
        super.onCreate(savedInstanceState);

        // Inhalt unterhalb der Statusleiste und oberhalb der Navigationsleiste halten
        // (Android 15 zieht Apps sonst bis an den Rand).
        View web = getBridge().getWebView();
        final View host = (View) web.getParent();
        host.setBackgroundColor(Color.parseColor("#0F2236"));
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#0F2236"));
        WindowInsetsControllerCompat ctl = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        ctl.setAppearanceLightStatusBars(false);
        ctl.setAppearanceLightNavigationBars(false);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        final int bars = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
        ViewCompat.setOnApplyWindowInsetsListener(host, (v, insets) -> {
            Insets b = insets.getInsets(bars);
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(b.left, b.top, b.right, Math.max(b.bottom, ime.bottom));
            // Leisten und Tastatur sind hier über das Padding erledigt. Die Tastatur nicht
            // zusätzlich an die Webansicht weiterreichen, sonst zieht sie ihre Höhe ein
            // zweites Mal ab (Fenster nur noch ca. 140 px hoch, Coach-Eingabe verschwindet).
            return new WindowInsetsCompat.Builder(insets).setInsets(bars | WindowInsetsCompat.Type.ime(), Insets.NONE).build();
        });
        ViewCompat.requestApplyInsets(host);
    }
}
