package at.christophschmid.wattsup;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WattsUpNative.class);
        super.onCreate(savedInstanceState);
    }
}
