import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.digitalid.app',
  appName: 'Digital ID',
  webDir: 'out',
  server: {
    url: 'https://digital-id-eta.vercel.app/login',
    cleartext: true
  },
  plugins: {
    Camera: {
      allowEditing: false,
      saveToGallery: false,
      quality: 85
    },
    Filesystem: {}
  }
};

export default config;
