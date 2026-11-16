package at.christophschmid.wattsup;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
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
        ViewCompat.setOnApplyWindowInsetsListener(host, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(b.left, b.top, b.right, Math.max(b.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(host);
    }
}
