import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gizmovault.app',
  appName: 'GizmoVault',
  webDir: '../dist/client',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
