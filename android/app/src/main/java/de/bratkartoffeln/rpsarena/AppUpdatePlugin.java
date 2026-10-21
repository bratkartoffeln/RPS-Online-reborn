package de.bratkartoffeln.rpsarena;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Let the system browser download the APK and Android confirm its installation. */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    @PluginMethod
    public void openDownload(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.matches("https://github\\.com/bratkartoffeln/RPS-Online-reborn/releases/download/v?\\d+\\.\\d+\\.\\d+/RPS-Arena-\\d+\\.\\d+\\.\\d+-debug\\.apk")) {
            call.reject("Ungültige Update-Adresse.");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException exception) {
            call.reject("Kein Browser zum Herunterladen der APK verfügbar.");
        }
    }
}
