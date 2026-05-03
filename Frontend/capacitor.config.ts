import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.digitalid.app',
  appName: 'Digital ID',
  webDir: 'out',
  server: {
    url: 'https://digital-id-eta.vercel.app/',
    cleartext: true
  }
};

export default config;
