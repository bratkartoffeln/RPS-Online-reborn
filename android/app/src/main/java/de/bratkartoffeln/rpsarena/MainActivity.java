package de.bratkartoffeln.rpsarena;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        // Capacitor's SystemBars plugin handles display cutouts, the IME and CSS insets.
        // Enable the same edge-to-edge behavior on every supported Android version.
        EdgeToEdge.enable(
            this,
            SystemBarStyle.dark(Color.TRANSPARENT),
            SystemBarStyle.dark(Color.TRANSPARENT)
        );
        super.onCreate(savedInstanceState);
    }
}
