import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.bratkartoffeln.rpsarena',
  appName: 'RPS Arena',
  webDir: 'dist/android',
  backgroundColor: '#14191d',
  loggingBehavior: 'debug',
  server: {
    // This is the secure origin of the locally bundled client, not the game server.
    hostname: 'localhost',
    androidScheme: 'https',
    cleartext: false,
    errorPath: 'unsupported-webview.html',
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    // Keep aligned with the Android-only Vite build target.
    minWebViewVersion: 107,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
      hidden: false,
    },
  },
};

export default config;
